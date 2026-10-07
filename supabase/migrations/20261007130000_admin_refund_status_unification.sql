create or replace function private.azim_order_refund_summary(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_open public.payment_refunds%rowtype;
  v_failed public.payment_refunds%rowtype;
  v_latest_cancel public.order_action_requests%rowtype;
  v_latest_return public.order_return_requests%rowtype;
  v_refunded bigint := 0;
  v_pending bigint := 0;
  v_status text := 'none';
  v_label text := 'عودت وجه ندارد';
  v_message text := 'برای این سفارش عودت وجهی ثبت نشده است.';
  v_source text := null;
  v_amount_total bigint := 0;
  v_amount_refunded bigint := 0;
  v_amount_pending bigint := 0;
  v_updated_at timestamptz := null;
begin
  if p_order_id is null then
    return jsonb_build_object('status','none','label','عودت وجه ندارد','message','شناسه سفارش معتبر نیست.');
  end if;

  select * into v_order from public.orders where id=p_order_id;
  if not found then
    return jsonb_build_object('status','none','label','عودت وجه ندارد','message','سفارش پیدا نشد.');
  end if;

  v_amount_total := greatest(0,coalesce(v_order.total,0));

  select * into v_open
  from public.payment_refunds
  where order_id=v_order.id
    and status in ('requested','pending','processing')
  order by updated_at desc, created_at desc
  limit 1;

  select * into v_failed
  from public.payment_refunds
  where order_id=v_order.id
    and status in ('failed','review_required')
  order by updated_at desc, created_at desc
  limit 1;

  select coalesce(sum(pr.amount),0)::bigint into v_refunded
  from public.payment_refunds pr
  where pr.order_id=v_order.id and pr.status='refunded';

  select coalesce(sum(pr.amount),0)::bigint into v_pending
  from public.payment_refunds pr
  where pr.order_id=v_order.id and pr.status in ('requested','pending','processing');

  v_amount_refunded := least(v_amount_total,v_refunded);
  v_amount_pending := greatest(0,least(v_amount_total-v_amount_refunded,v_pending));

  select * into v_latest_cancel
  from public.order_action_requests
  where order_id=v_order.id and request_type='cancel' and refund_status is not null
  order by updated_at desc, created_at desc
  limit 1;

  select * into v_latest_return
  from public.order_return_requests
  where order_id=v_order.id and refund_status is not null
  order by updated_at desc, created_at desc
  limit 1;

  if v_open.id is not null then
    v_status := v_open.status;
    v_label := case v_status
      when 'requested' then 'درخواست عودت ثبت شده'
      when 'pending' then 'در انتظار پردازش عودت'
      when 'processing' then 'در حال پردازش عودت'
      else 'در انتظار عودت'
    end;
    v_message := case v_status
      when 'requested' then 'درخواست عودت ثبت شده و هنوز اجرای نهایی آن تأیید نشده است.'
      when 'pending' then 'عودت وجه در سامانه ثبت شده و منتظر پردازش درگاه است.'
      when 'processing' then 'عودت وجه در حال پردازش است و هنوز نهایی نشده است.'
      else 'عودت وجه هنوز نهایی نشده است.'
    end;
    v_source := coalesce(v_open.source_type,'online');
    v_updated_at := coalesce(v_open.updated_at,v_open.created_at);

  elsif v_failed.id is not null and v_order.payment_status not in ('refunded','partially_refunded') then
    v_status := case when v_failed.status='review_required' then 'review_required' else 'failed' end;
    v_label := case v_status
      when 'review_required' then 'نیازمند بررسی عودت'
      else 'عودت ناموفق'
    end;
    v_message := case v_status
      when 'review_required' then 'عودت وجه با مغایرت مواجه شده و نیاز به بررسی مدیر دارد.'
      else coalesce(v_failed.error_message,'پردازش عودت وجه ناموفق بوده است.')
    end;
    v_source := coalesce(v_failed.source_type,'online');
    v_updated_at := coalesce(v_failed.updated_at,v_failed.created_at);

  elsif v_order.payment_status='refunded' then
    v_status := 'refunded';
    v_label := 'عودت وجه انجام شد';
    v_message := 'کل مبلغ قابل‌استرداد سفارش عودت شده است.';
    v_source := coalesce(
      (select pr.source_type from public.payment_refunds pr
       where pr.order_id=v_order.id and pr.status='refunded'
       order by pr.updated_at desc, pr.created_at desc limit 1),
      case when v_order.payment_method='online' then 'online' else 'manual' end
    );
    v_amount_refunded := greatest(v_amount_refunded,v_amount_total);
    v_updated_at := v_order.updated_at;

  elsif v_order.payment_status='partially_refunded' then
    v_status := 'partially_refunded';
    v_label := 'بخشی از وجه عودت شد';
    v_message := 'بخشی از مبلغ سفارش عودت شده و مانده پرداخت نزد فروشگاه ثبت است.';
    v_source := coalesce(
      (select pr.source_type from public.payment_refunds pr
       where pr.order_id=v_order.id
       order by pr.updated_at desc, pr.created_at desc limit 1),
      case when v_order.payment_method='online' then 'online' else 'manual' end
    );
    v_updated_at := v_order.updated_at;

  elsif v_latest_return.refund_status='pending' or v_latest_cancel.refund_status='pending' then
    v_status := 'pending';
    v_label := 'در انتظار پردازش عودت';
    v_message := 'درخواست عودت ثبت شده و هنوز پرداخت برگشتی نهایی نشده است.';
    v_source := case when v_latest_return.refund_status='pending' then 'return' else 'cancel' end;
    v_updated_at := greatest(
      coalesce(v_latest_return.updated_at,'epoch'::timestamptz),
      coalesce(v_latest_cancel.updated_at,'epoch'::timestamptz)
    );
  end if;

  return jsonb_build_object(
    'status',v_status,'label',v_label,'message',v_message,'source',v_source,
    'amount_total',v_amount_total,'amount_refunded',v_amount_refunded,
    'amount_pending',v_amount_pending,'updated_at',nullif(v_updated_at,'epoch'::timestamptz),
    'terminal',v_status in ('none','refunded','partially_refunded','failed')
  );
end;
$function$;

revoke all on function private.azim_order_refund_summary(uuid) from public,anon,authenticated;

create or replace function public.azim_admin_order_refund_summary(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text,'sales'::text]) then
    raise exception using message='دسترسی مشاهده وضعیت عودت وجه ندارید.';
  end if;
  return private.azim_order_refund_summary(p_order_id);
end;
$function$;

revoke all on function public.azim_admin_order_refund_summary(uuid) from public,anon;
grant execute on function public.azim_admin_order_refund_summary(uuid) to authenticated;

create or replace function public.azim_admin_order_refund_summaries(p_order_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text,'sales'::text]) then
    raise exception using message='دسترسی مشاهده وضعیت عودت وجه ندارید.';
  end if;

  return coalesce((
    select jsonb_object_agg(x.id::text,x.summary)
    from (
      select o.id, private.azim_order_refund_summary(o.id) as summary
      from public.orders o
      where p_order_ids is not null and o.id = any(p_order_ids)
    ) x
  ),'{}'::jsonb);
end;
$function$;

revoke all on function public.azim_admin_order_refund_summaries(uuid[]) from public,anon;
grant execute on function public.azim_admin_order_refund_summaries(uuid[]) to authenticated;

create or replace function public.azim_order_status(p_order_code text, p_mobile text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
  v_order_id uuid;
begin
  v_result := private.azim_order_status(p_order_code,p_mobile);
  if coalesce(v_result->>'found','false') <> 'true' then
    return v_result;
  end if;

  select id into v_order_id
  from public.orders
  where upper(order_code)=upper(trim(coalesce(v_result->>'order_code','')))
  limit 1;

  return v_result || jsonb_build_object(
    'refund_summary',private.azim_order_refund_summary(v_order_id)
  );
end;
$function$;

grant execute on function public.azim_order_status(text,text) to anon,authenticated;
