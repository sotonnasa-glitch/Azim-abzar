-- Fix order tracking / cancellation / return state consistency.
-- Applied to the live database during the 2026-09-27 hardening pass.

create or replace function private.azim_request_order_cancel_core(
  p_order_code text, p_mobile text, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code text := upper(trim(coalesce(p_order_code,'')));
  v_mobile text := private.azim_normalize_mobile(p_mobile);
  v_reason text := trim(coalesce(p_reason,''));
  v_order public.orders%rowtype;
  v_request public.order_action_requests%rowtype;
begin
  if not (
    v_code ~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{5}$' and length(v_code)=24
    or
    v_code ~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}$' and length(v_code)=43
  ) then
    return jsonb_build_object('ok',false,'message','شناسه سفارش نامعتبر است.');
  end if;

  if not (v_mobile ~ '^09[0-9]{9}$' and length(v_mobile)=11) then
    return jsonb_build_object('ok',false,'message','شماره موبایل معتبر وارد کنید.');
  end if;

  if length(v_reason)<2 or length(v_reason)>300 then
    return jsonb_build_object('ok',false,'message','دلیل لغو را وارد کنید.');
  end if;

  select o.* into v_order
  from public.orders o
  left join public.customers c on c.id=o.customer_id
  where upper(o.order_code)=v_code
    and (
      private.azim_normalize_mobile(coalesce(c.mobile,''))=v_mobile
      or private.azim_normalize_mobile(coalesce(o.customer_mobile,''))=v_mobile
    )
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'message','اطلاعات سفارش و شماره موبایل مطابقت ندارد.');
  end if;

  if v_order.status in ('shipped','delivered','cancelled')
     or v_order.shipping_status in ('shipped','delivered') then
    return jsonb_build_object('ok',false,'message','این سفارش دیگر قابل لغو نیست؛ برای سفارش تحویل‌شده از مرجوعی کالا استفاده کنید.');
  end if;

  select * into v_request
  from public.order_action_requests
  where order_id=v_order.id and request_type='cancel' and status='pending'
  order by created_at desc limit 1;

  if found then
    return jsonb_build_object(
      'ok',true,'request_id',v_request.id,'status',v_request.status,
      'message','درخواست لغو قبلاً ثبت شده و در حال بررسی است.'
    );
  end if;

  insert into public.order_action_requests(
    order_id,request_type,status,reason,customer_mobile,refund_status
  )
  values(
    v_order.id,'cancel','pending',v_reason,v_mobile,
    case when v_order.payment_status in ('paid','partially_refunded')
         then 'pending' else 'not_required' end
  )
  returning * into v_request;

  return jsonb_build_object(
    'ok',true,'request_id',v_request.id,'status',v_request.status,
    'message','درخواست لغو ثبت شد؛ فروشگاه آن را بررسی می‌کند.'
  );
end;
$function$;

create or replace function private.azim_request_order_return_core(
  p_order_code text, p_mobile text, p_order_item_id uuid,
  p_quantity integer, p_reason text, p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code text := upper(trim(coalesce(p_order_code,'')));
  v_mobile text := private.azim_normalize_mobile(p_mobile);
  v_reason text := trim(coalesce(p_reason,''));
  v_details text := nullif(trim(coalesce(p_details,'')),'');
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_used integer := 0;
  v_request public.order_return_requests%rowtype;
  v_merch_net bigint := 0;
  v_item_full_refund bigint := 0;
  v_unit_refund bigint := 0;
  v_prior_reserved bigint := 0;
  v_remaining_refundable bigint := 0;
begin
  if not (
    v_code ~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{5}$' and length(v_code)=24
    or
    v_code ~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}$' and length(v_code)=43
  ) then
    return jsonb_build_object('ok',false,'message','شناسه سفارش نامعتبر است.');
  end if;

  if not (v_mobile ~ '^09[0-9]{9}$' and length(v_mobile)=11) then
    return jsonb_build_object('ok',false,'message','شماره موبایل معتبر وارد کنید.');
  end if;

  if p_quantity is null or p_quantity<1 then
    return jsonb_build_object('ok',false,'message','تعداد مرجوعی نامعتبر است.');
  end if;

  if length(v_reason)<2 or length(v_reason)>300 then
    return jsonb_build_object('ok',false,'message','دلیل مرجوعی را وارد کنید.');
  end if;

  if v_details is not null and length(v_details)>1000 then
    return jsonb_build_object('ok',false,'message','توضیحات مرجوعی بیش از حد طولانی است.');
  end if;

  select o.* into v_order
  from public.orders o
  left join public.customers c on c.id=o.customer_id
  where upper(o.order_code)=v_code
    and (
      private.azim_normalize_mobile(coalesce(c.mobile,''))=v_mobile
      or private.azim_normalize_mobile(coalesce(o.customer_mobile,''))=v_mobile
    )
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'message','اطلاعات سفارش و شماره موبایل مطابقت ندارد.');
  end if;

  if v_order.status<>'delivered' or v_order.shipping_status<>'delivered' then
    return jsonb_build_object('ok',false,'message','مرجوعی فقط بعد از تحویل کامل سفارش قابل ثبت است.');
  end if;

  if v_order.delivered_at is null or now() > v_order.delivered_at + interval '7 days' then
    return jsonb_build_object('ok',false,'message','مهلت ثبت مرجوعی این سفارش (۷ روز پس از تحویل) به پایان رسیده است.');
  end if;

  select * into v_item
  from public.order_items
  where id=p_order_item_id and order_id=v_order.id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'message','قلم سفارش پیدا نشد.');
  end if;

  select coalesce(sum(r.quantity),0)::integer into v_used
  from public.order_return_requests r
  where r.order_item_id=v_item.id and r.status<>'rejected';

  if p_quantity>greatest(0,v_item.quantity-v_used) then
    return jsonb_build_object(
      'ok',false,
      'message','تعداد قابل مرجوعی این کالا حداکثر '||
        greatest(0,v_item.quantity-v_used)||' عدد است.'
    );
  end if;

  if exists(
    select 1 from public.order_return_requests r
    where r.order_item_id=v_item.id
      and r.status in ('pending','approved','received')
  ) then
    return jsonb_build_object('ok',false,'message','برای این کالا یک درخواست مرجوعی در حال بررسی وجود دارد.');
  end if;

  v_merch_net := greatest(0,coalesce(v_order.subtotal,0)-coalesce(v_order.discount,0));

  if coalesce(v_order.subtotal,0)>0 then
    v_item_full_refund :=
      floor(
        greatest(0,coalesce(v_item.line_total,0))
        * v_merch_net
        / v_order.subtotal
      )::bigint;
  else
    v_item_full_refund := 0;
  end if;

  v_unit_refund :=
    case
      when coalesce(v_item.quantity,0)>0
      then floor(v_item_full_refund::numeric / v_item.quantity)::bigint
      else 0
    end;

  select coalesce(sum(r.refund_amount),0)::bigint into v_prior_reserved
  from public.order_return_requests r
  where r.order_id=v_order.id
    and r.status<>'rejected'
    and r.refund_status in ('pending','refunded');

  v_remaining_refundable :=
    greatest(0,coalesce(v_order.total,0)-coalesce(v_order.shipping_cost,0)-v_prior_reserved);

  insert into public.order_return_requests(
    order_id,order_item_id,quantity,reason,details,status,
    refund_status,refund_amount,customer_mobile
  )
  values(
    v_order.id,v_item.id,p_quantity,v_reason,v_details,'pending',
    case when v_order.payment_status in ('paid','partially_refunded')
         then 'pending' else 'not_required' end,
    case
      when v_order.payment_status in ('paid','partially_refunded')
      then least(
        v_remaining_refundable,
        greatest(0,v_unit_refund*p_quantity)
      )
      else 0
    end,
    v_mobile
  )
  returning * into v_request;

  return jsonb_build_object(
    'ok',true,'request_id',v_request.id,'status',v_request.status,
    'refund_amount',v_request.refund_amount,
    'message','درخواست مرجوعی این کالا ثبت شد و فروشگاه آن را بررسی می‌کند.'
  );
end;
$function$;

create or replace function private.azim_order_status(
  p_order_code text, p_mobile text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code text := upper(trim(coalesce(p_order_code,'')));
  v_mobile text := private.azim_normalize_mobile(p_mobile);
  v_ip inet := null;
  v_ip_text text := split_part(
    coalesce(current_setting('request.headers',true)::json->>'x-forwarded-for',''),
    ',',1
  );
  v_result jsonb;
begin
  if not (
    (v_code ~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{5}$' and length(v_code)=24)
    or
    (v_code ~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}$' and length(v_code)=43)
  ) then
    return jsonb_build_object('found',false,'message','شناسه سفارش نامعتبر است.');
  end if;

  if v_mobile !~ '^09[0-9]{9}$' then
    return jsonb_build_object('found',false,'message','شماره موبایل معتبر وارد کنید.');
  end if;

  begin
    v_ip := nullif(trim(v_ip_text),'')::inet;
  exception when others then
    v_ip := null;
  end;

  if v_ip is not null and (
    select count(*) from private.azim_order_tracking_rate_limits
    where ip=v_ip and created_at > now()-interval '10 minutes'
  ) >= 30 then
    return jsonb_build_object(
      'found',false,'rate_limited',true,
      'message','تعداد درخواست‌های پیگیری زیاد است؛ چند دقیقه بعد دوباره تلاش کنید.'
    );
  end if;

  insert into private.azim_order_tracking_rate_limits(ip) values(v_ip);

  select jsonb_build_object(
    'found',true,
    'order_code',o.order_code,
    'status',o.status,
    'payment_status',o.payment_status,
    'payment_method',o.payment_method,
    'shipping_status',o.shipping_status,
    'tracking_code',nullif(o.tracking_code,''),
    'tracking_url',nullif(o.tracking_url,''),
    'shipping_carrier',nullif(o.shipping_carrier,''),
    'total',o.total,
    'created_at',o.created_at,
    'updated_at',o.updated_at,
    'delivered_at',o.delivered_at,
    'return_deadline_at',
      case
        when o.status='delivered' and o.shipping_status='delivered' and o.delivered_at is not null
        then o.delivered_at + interval '7 days'
        else null
      end,
    'return_available',
      o.status='delivered'
      and o.shipping_status='delivered'
      and o.delivered_at is not null
      and now() <= o.delivered_at + interval '7 days',
    'can_retry_payment',
      o.payment_method='online'
      and o.payment_status in ('failed','cancelled')
      and o.status <> 'cancelled'
      and o.shipping_status not in ('shipped','delivered'),
    'can_cancel',
      o.status in ('pending','confirmed','processing')
      and o.shipping_status not in ('shipped','delivered'),
    'cancel_request_status',(
      select r.status from public.order_action_requests r
      where r.order_id=o.id and r.request_type='cancel'
      order by r.created_at desc limit 1
    ),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'product_name',i.product_name,'sku',i.sku,'quantity',i.quantity,
        'unit_price',i.unit_price,'line_total',i.line_total,'variant',i.variant,
        'returnable_quantity',greatest(0,i.quantity-coalesce((
          select sum(r.quantity) from public.order_return_requests r
          where r.order_item_id=i.id and r.status<>'rejected'
        ),0)),
        'return_requests',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',rr.id,'quantity',rr.quantity,'reason',rr.reason,'details',rr.details,
            'status',rr.status,'refund_status',rr.refund_status,'refund_amount',rr.refund_amount,
            'created_at',rr.created_at,'updated_at',rr.updated_at
          ) order by rr.created_at desc)
          from public.order_return_requests rr where rr.order_item_id=i.id
        ),'[]'::jsonb)
      ) order by i.id)
      from public.order_items i where i.order_id=o.id
    ),'[]'::jsonb)
  ) into v_result
  from public.orders o
  left join public.customers c on c.id=o.customer_id
  where upper(o.order_code)=v_code
    and (
      private.azim_normalize_mobile(coalesce(c.mobile,''))=v_mobile
      or private.azim_normalize_mobile(coalesce(o.customer_mobile,''))=v_mobile
    )
  limit 1;

  if v_result is null then
    return jsonb_build_object('found',false,'message','اطلاعات سفارش و شماره موبایل مطابقت ندارد.');
  end if;

  return v_result;
end;
$function$;

create or replace function public.azim_telegram_transition_order(
  p_order_code text, p_next_status text,
  p_reason text default null, p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_next text := lower(trim(coalesce(p_next_status,'')));
  v_prev text;
  v_prev_shipping text;
  v_now timestamptz := now();
  v_tx public.payment_transactions%rowtype;
  v_open_refund public.payment_refunds%rowtype;
  v_refunded bigint := 0;
  v_remaining bigint := 0;
  v_refund jsonb;
  v_cancel_refund_status text := 'not_required';
begin
  perform private.azim_prepare_telegram_audit_actor();

  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then raise exception using message='سفارش پیدا نشد.'; end if;

  if v_next not in ('pending','confirmed','processing','shipped','delivered','cancelled') then
    raise exception using message='وضعیت سفارش نامعتبر است.';
  end if;

  v_prev := v_order.status;
  v_prev_shipping := v_order.shipping_status;

  if not exists (
    select 1 from (
      values
        ('pending','confirmed'),('pending','cancelled'),
        ('confirmed','processing'),('confirmed','cancelled'),
        ('processing','shipped'),('processing','cancelled'),
        ('shipped','delivered')
    ) x(from_status,to_status)
    where x.from_status=v_order.status and x.to_status=v_next
  ) then
    raise exception using message='این تغییر وضعیت سفارش مجاز نیست.';
  end if;

  if v_next='shipped' and v_order.shipping_status not in ('shipped','delivered') then
    raise exception using message='اول وضعیت ارسال را «ارسال شد» ثبت کنید.';
  end if;

  if v_next='delivered' and v_order.shipping_status<>'delivered' then
    raise exception using message='اول وضعیت ارسال را «تحویل شد» ثبت کنید.';
  end if;

  if v_order.payment_method='online'
     and v_next in ('processing','shipped','delivered')
     and v_order.payment_status<>'paid' then
    raise exception using message='سفارش آنلاین تا تأیید واقعی پرداخت قابل پردازش یا ارسال نیست.';
  end if;

  if v_next='cancelled' then
    v_cancel_refund_status :=
      case when v_order.payment_status in ('paid','partially_refunded')
           then 'pending' else 'not_required' end;
  end if;

  update public.orders
  set status=v_next,
      shipping_status=case when v_next='cancelled' then 'pending' else shipping_status end,
      delivered_at=case when v_next='cancelled' then null else delivered_at end,
      updated_at=v_now
  where id=v_order.id;

  if v_next='cancelled'
     and v_order.payment_method='online'
     and v_order.payment_status in ('paid','partially_refunded') then

    select * into v_tx
    from public.payment_transactions pt
    where pt.order_id=v_order.id
      and pt.status in ('paid','partially_refunded')
    order by pt.created_at desc
    limit 1
    for update;

    if not found then
      raise exception using message='سفارش آنلاین پرداخت‌شده است اما تراکنش موفق برای آن پیدا نشد؛ لغو برای حفظ وضعیت مالی متوقف شد.';
    end if;

    select * into v_open_refund
    from public.payment_refunds pr
    where pr.transaction_id=v_tx.id
      and pr.status in ('requested','pending','processing')
    order by pr.created_at desc
    limit 1
    for update;

    if not found then
      select coalesce(sum(pr.amount),0)::bigint into v_refunded
      from public.payment_refunds pr
      where pr.transaction_id=v_tx.id and pr.status='refunded';

      v_remaining := greatest(0,v_tx.amount-v_refunded);

      if v_remaining>0 then
        v_refund := public.azim_create_online_refund_request(
          v_tx.id,v_remaining,
          coalesce(nullif(trim(p_reason),'') ,'لغو سفارش توسط پنل تلگرام'),
          'telegram-order-cancel:'||v_order.id::text
        );

        update public.payment_refunds
        set source_type='cancel',source_request_id=null,updated_at=v_now
        where id=(v_refund->>'refund_id')::uuid;
      else
        v_cancel_refund_status := 'not_required';
      end if;
    end if;
  end if;

  update public.order_action_requests
  set status='approved',
      refund_status=case
        when v_order.payment_method='online'
         and v_order.payment_status in ('paid','partially_refunded')
        then 'pending'
        else v_cancel_refund_status
      end,
      admin_notes=coalesce(admin_notes,'لغو سفارش از مسیر مدیریت تلگرام ثبت شد.'),
      updated_at=v_now
  where order_id=v_order.id
    and request_type='cancel'
    and status='pending';

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_order_status','orders',v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'status_before',v_prev,'status_after',v_next,
      'shipping_before',v_prev_shipping,
      'shipping_after',case when v_next='cancelled' then 'pending' else v_order.shipping_status end,
      'reason',left(coalesce(p_reason,''),500),
      'actor_ref',left(coalesce(p_actor_ref,''),120)
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,'order_code',v_order.order_code,'status',v_order.status,
    'payment_status',v_order.payment_status,'payment_method',v_order.payment_method,
    'shipping_status',v_order.shipping_status,
    'refund_requested',(
      v_next='cancelled'
      and exists(
        select 1 from public.payment_refunds pr
        where pr.order_id=v_order.id
          and pr.status in ('requested','pending','processing')
          and coalesce(pr.source_type,'') in ('admin','cancel')
      )
    )
  );
end;
$function$;

create or replace function public.azim_telegram_restore_cancelled_order(
  p_order_code text, p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_open_refund_count integer := 0;
  v_new_payment_status text;
  v_now timestamptz := now();
begin
  perform private.azim_prepare_telegram_audit_actor();

  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then raise exception using message='سفارش پیدا نشد.'; end if;
  if v_order.status <> 'cancelled' then
    raise exception using message='فقط سفارش‌های لغوشده قابل بازگردانی هستند.';
  end if;

  select count(*) into v_open_refund_count
  from public.payment_refunds pr
  where pr.order_id=v_order.id
    and pr.status in ('requested','pending','processing');

  if v_open_refund_count > 0 then
    raise exception using message='برای این سفارش هنوز عودت وجه در حال پردازش است؛ تا نهایی شدن عودت، بازگردانی سفارش مجاز نیست.';
  end if;

  if v_order.payment_method='online' then
    if v_order.payment_status in ('paid','partially_refunded') then
      raise exception using message='وضعیت مالی سفارش آنلاین هنوز تسویه نشده است؛ ابتدا وضعیت عودت وجه را نهایی کنید.';
    end if;

    if v_order.payment_status='refunded' then
      v_new_payment_status := 'cancelled';
    elsif v_order.payment_status in ('failed','cancelled','unpaid','pending') then
      v_new_payment_status := v_order.payment_status;
    else
      v_new_payment_status := 'unpaid';
    end if;
  else
    v_new_payment_status := case
      when v_order.payment_status in ('refunded','failed','cancelled') then 'unpaid'
      else coalesce(v_order.payment_status,'unpaid')
    end;
  end if;

  if v_order.payment_method='online'
     and v_order.payment_status='refunded'
     and v_new_payment_status='cancelled' then
    perform set_config('azim.payment_transition','refund_verified',true);
  end if;

  update public.orders
  set status='pending',
      shipping_status='pending',
      tracking_code=null,
      tracking_url=null,
      shipping_carrier=null,
      delivered_at=null,
      payment_status=v_new_payment_status,
      paid_at=null,
      updated_at=v_now
  where id=v_order.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_restore_cancelled_order','orders',v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'status_before','cancelled','status_after','pending',
      'shipping_before',v_order.shipping_status,'shipping_after','pending',
      'payment_before',v_order.payment_status,'payment_after',v_new_payment_status,
      'tracking_cleared',true,'delivered_at_cleared',true,
      'actor_ref',left(coalesce(p_actor_ref,''),120)
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,'order_code',v_order.order_code,'status',v_order.status,
    'payment_status',v_order.payment_status,'payment_method',v_order.payment_method,
    'shipping_status',v_order.shipping_status
  );
end;
$function$;

create or replace function public.azim_save_order_with_discount(
  p_order_id uuid,
  p_order_code text,
  p_customer_id uuid,
  p_status text,
  p_payment_status text,
  p_shipping_status text,
  p_shipping_cost bigint,
  p_tracking_code text,
  p_notes text,
  p_discount_code text,
  p_items jsonb,
  p_tracking_url text,
  p_shipping_carrier text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_order_id uuid;
  v_result jsonb;
  v_status text := lower(trim(coalesce(p_status,'pending')));
  v_shipping text := lower(trim(coalesce(p_shipping_status,'pending')));
  v_tracking_code text := nullif(trim(coalesce(p_tracking_code,'')),'');
  v_tracking_url text := nullif(trim(coalesce(p_tracking_url,'')),'');
  v_shipping_carrier text := nullif(trim(coalesce(p_shipping_carrier,'')),'');
begin
  if not private.has_azim_role(array['owner','admin','sales']) then
    raise exception using message='دسترسی ثبت سفارش ندارید.';
  end if;

  if v_status not in ('pending','confirmed','processing','shipped','delivered','cancelled') then
    raise exception using message='وضعیت سفارش نامعتبر است.';
  end if;

  if v_shipping not in ('pending','packed','shipped','delivered') then
    raise exception using message='وضعیت ارسال نامعتبر است.';
  end if;

  if p_order_id is not null then
    perform 1 from public.orders where id=p_order_id for update;
    if not found then raise exception using message='سفارش پیدا نشد.'; end if;
  end if;

  if v_status='cancelled' then
    v_shipping := 'pending';
    v_tracking_code := null;
    v_tracking_url := null;
    v_shipping_carrier := null;
  end if;

  if v_shipping='packed' and v_status<>'processing' then
    raise exception using message='وضعیت «بسته‌بندی شده» فقط برای سفارش در حال آماده‌سازی مجاز است.';
  end if;

  if v_shipping='shipped' then
    if v_status<>'shipped' then
      raise exception using message='وضعیت «تحویل به شرکت ارسال» باید با وضعیت سفارش «ارسال شده» هماهنگ باشد.';
    end if;
    if v_tracking_code is null then raise exception using message='برای ارسال، کد مرسوله اجباری است.'; end if;
    if v_tracking_url is null or v_tracking_url !~* '^https?://[^[:space:]]+$' then
      raise exception using message='برای ارسال، لینک کامل پیگیری معتبر اجباری است.';
    end if;
    if v_shipping_carrier is null then raise exception using message='برای ارسال، نام شرکت ارسال اجباری است.'; end if;
  end if;

  if v_shipping='delivered' then
    if v_status<>'delivered' then
      raise exception using message='وضعیت «تحویل شده» باید با وضعیت سفارش «تحویل شده» هماهنگ باشد.';
    end if;
    if v_tracking_code is null or v_tracking_url is null or v_shipping_carrier is null then
      raise exception using message='برای تحویل شده، اطلاعات کامل مرسوله باید ثبت شده باشد.';
    end if;
  end if;

  if v_status='shipped' and v_shipping<>'shipped' then
    raise exception using message='سفارش ارسال شده باید وضعیت ارسال «تحویل به شرکت ارسال» داشته باشد.';
  end if;

  if v_status='delivered' and v_shipping<>'delivered' then
    raise exception using message='سفارش تحویل شده باید وضعیت ارسال «تحویل شده» داشته باشد.';
  end if;

  if v_status='cancelled' and v_shipping in ('shipped','delivered') then
    raise exception using message='سفارش لغوشده نمی‌تواند وضعیت ارسال شده یا تحویل شده داشته باشد.';
  end if;

  v_result := private.azim_save_order_with_discount_core(
    p_order_id,p_order_code,p_customer_id,v_status,p_payment_status,
    v_shipping,p_shipping_cost,v_tracking_code,p_notes,p_discount_code,p_items
  );

  v_order_id := nullif(v_result->>'order_id','')::uuid;
  if v_order_id is null then raise exception using message='ثبت سفارش انجام نشد.'; end if;

  update public.orders
  set tracking_url=v_tracking_url,
      shipping_carrier=v_shipping_carrier,
      delivered_at=case when v_status='cancelled' then null else delivered_at end,
      updated_at=now()
  where id=v_order_id;

  return v_result || jsonb_build_object(
    'tracking_url',v_tracking_url,'shipping_carrier',v_shipping_carrier
  );
end;
$function$;

create or replace function public.azim_telegram_handle_cancel_request(
  p_request_id uuid, p_action text, p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_req public.order_action_requests%rowtype;
  v_order public.orders%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_refund jsonb;
  v_open_refund public.payment_refunds%rowtype;
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_now timestamptz:=now();
  v_refund_status text;
  v_remaining bigint:=0;
  v_refunded bigint:=0;
begin
  perform private.azim_prepare_telegram_audit_actor();

  select * into v_req from public.order_action_requests where id=p_request_id for update;
  if not found then raise exception using message='درخواست لغو پیدا نشد.'; end if;
  if v_req.request_type<>'cancel' then raise exception using message='این درخواست از نوع لغو نیست.'; end if;

  select * into v_order from public.orders where id=v_req.order_id for update;
  if not found then raise exception using message='سفارش مرتبط با درخواست پیدا نشد.'; end if;

  if v_action='approve' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل تأیید نیست.'; end if;

    if v_order.status not in ('pending','confirmed','processing')
       or v_order.shipping_status in ('shipped','delivered') then
      raise exception using message='این سفارش دیگر قبل از ارسال قابل لغو نیست.';
    end if;

    v_refund_status:=case
      when v_order.payment_status in ('paid','partially_refunded') then 'pending'
      else 'not_required'
    end;

    update public.orders
    set status='cancelled',shipping_status='pending',delivered_at=null,updated_at=v_now
    where id=v_order.id;

    if v_order.payment_method='online' and v_refund_status='pending' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id and status in ('paid','partially_refunded')
      order by created_at desc limit 1 for update;

      if not found then
        raise exception using message='پرداخت آنلاین ثبت شده اما تراکنش موفق برای عودت پیدا نشد؛ لغو برای حفظ وضعیت مالی متوقف شد.';
      end if;

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id and status in ('requested','pending','processing')
      order by created_at desc limit 1 for update;

      if not found then
        select coalesce(sum(amount),0)::bigint into v_refunded
        from public.payment_refunds
        where transaction_id=v_tx.id and status='refunded';

        v_remaining:=greatest(0,v_tx.amount-v_refunded);

        if v_remaining>0 then
          v_refund:=public.azim_create_online_refund_request(
            v_tx.id,v_remaining,'عودت وجه لغو سفارش از پنل تلگرام',
            'telegram-cancel-request:'||p_request_id::text
          );
          update public.payment_refunds
          set source_type='cancel',source_request_id=p_request_id,updated_at=v_now
          where id=(v_refund->>'refund_id')::uuid;
        else
          v_refund_status:='not_required';
        end if;
      end if;
    end if;

    update public.order_action_requests
    set status='approved',refund_status=v_refund_status,handled_by=null,updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_cancel_approved','order_action_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'refund_status',v_refund_status,'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object(
      'ok',true,'action','approve','order_code',v_order.order_code,'status','cancelled',
      'payment_status',case when v_order.payment_status='pending' then 'unpaid' else v_order.payment_status end,
      'refund_status',v_refund_status
    );
  end if;

  if v_action='reject' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل رد نیست.'; end if;

    update public.order_action_requests set status='rejected',updated_at=v_now where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_cancel_rejected','order_action_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object('ok',true,'action','reject','order_code',v_order.order_code,'status','rejected');
  end if;

  if v_action='refund' then
    if v_req.status<>'approved' or v_req.refund_status<>'pending'
       or v_order.payment_status not in ('paid','partially_refunded') then
      raise exception using message='این درخواست در وضعیت لازم برای عودت وجه نیست.';
    end if;

    if v_order.payment_method='online' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id and status in ('paid','partially_refunded')
      order by created_at desc limit 1 for update;

      if not found then raise exception using message='تراکنش پرداخت موفق برای این سفارش پیدا نشد.'; end if;

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id and status in ('requested','pending','processing')
      order by created_at desc limit 1 for update;

      if not found then
        select coalesce(sum(amount),0)::bigint into v_refunded
        from public.payment_refunds
        where transaction_id=v_tx.id and status='refunded';

        v_remaining:=greatest(0,v_tx.amount-v_refunded);

        if v_remaining<=0 then
          update public.order_action_requests set refund_status='refunded',updated_at=v_now where id=v_req.id;
          return jsonb_build_object('ok',true,'action','refund','order_code',v_order.order_code,'refund_status','refunded','already_refunded',true);
        end if;

        v_refund:=public.azim_create_online_refund_request(
          v_tx.id,v_remaining,'عودت وجه لغو سفارش از پنل تلگرام',
          'telegram-cancel-request-refund:'||p_request_id::text
        );

        update public.payment_refunds
        set source_type='cancel',source_request_id=p_request_id,updated_at=v_now
        where id=(v_refund->>'refund_id')::uuid;
      end if;

      insert into public.audit_logs(action,entity,entity_id,metadata)
      values(
        'telegram_cancel_refund_requested','order_action_requests',p_request_id::text,
        jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
          'actor_ref',left(coalesce(p_actor_ref,''),120))
      );

      return jsonb_build_object(
        'ok',true,'action','refund','order_code',v_order.order_code,
        'refund_status','pending','payment_status',v_order.payment_status
      );
    end if;

    update public.orders set payment_status='refunded',updated_at=v_now where id=v_order.id;
    update public.order_action_requests set refund_status='refunded',updated_at=v_now where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_offline_cancel_refund','order_action_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object(
      'ok',true,'action','refund','order_code',v_order.order_code,
      'refund_status','refunded','payment_status','refunded'
    );
  end if;

  raise exception using message='عملیات لغو نامعتبر است.';
end;
$function$;

create or replace function public.azim_telegram_handle_return_request(
  p_request_id uuid, p_action text, p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_req public.order_return_requests%rowtype;
  v_order public.orders%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_refund jsonb;
  v_open_refund public.payment_refunds%rowtype;
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_now timestamptz:=now();
  v_refunded bigint:=0;
  v_total_refund bigint:=0;
  v_remaining bigint:=0;
begin
  perform private.azim_prepare_telegram_audit_actor();

  select * into v_req from public.order_return_requests where id=p_request_id for update;
  if not found then raise exception using message='درخواست مرجوعی پیدا نشد.'; end if;

  select * into v_order from public.orders where id=v_req.order_id for update;
  if not found then raise exception using message='سفارش مرتبط با درخواست پیدا نشد.'; end if;

  if v_action='approve' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل تأیید نیست.'; end if;
    if v_order.status<>'delivered' or v_order.shipping_status<>'delivered' then
      raise exception using message='مرجوعی فقط برای سفارش تحویل‌شده قابل تأیید است.';
    end if;

    update public.order_return_requests
    set status='approved',
        refund_status=case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
        updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_return_approved','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'refund_status',case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
        'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object(
      'ok',true,'action','approve','order_code',v_order.order_code,
      'status','approved',
      'refund_status',case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end
    );
  end if;

  if v_action='reject' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل رد نیست.'; end if;
    update public.order_return_requests set status='rejected',updated_at=v_now where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_return_rejected','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object('ok',true,'action','reject','order_code',v_order.order_code,'status','rejected');
  end if;

  if v_action='received' then
    if v_req.status<>'approved' then raise exception using message='اول باید درخواست مرجوعی تأیید شده باشد.'; end if;

    update public.order_return_requests
    set status=case when refund_status='pending' then 'received' else 'closed' end,
        updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_return_received','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'refund_status',v_req.refund_status,'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object(
      'ok',true,'action','received','order_code',v_order.order_code,
      'status',case when v_req.refund_status='pending' then 'received' else 'closed' end,
      'refund_status',v_req.refund_status
    );
  end if;

  if v_action='refund' then
    if v_req.status<>'received' or v_req.refund_status<>'pending'
       or v_order.payment_status not in ('paid','partially_refunded') then
      raise exception using message='این مرجوعی هنوز در وضعیت لازم برای عودت وجه نیست.';
    end if;

    if v_order.payment_method='online' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id and status in ('paid','partially_refunded')
      order by created_at desc limit 1 for update;

      if not found then raise exception using message='تراکنش پرداخت موفق برای این سفارش پیدا نشد.'; end if;

      v_total_refund:=greatest(0,coalesce(v_req.refund_amount,0));

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id and status in ('requested','pending','processing')
      order by created_at desc limit 1 for update;

      if not found then
        select coalesce(sum(amount),0)::bigint into v_refunded
        from public.payment_refunds
        where transaction_id=v_tx.id and status='refunded';

        v_remaining:=greatest(0,v_tx.amount-v_refunded);

        if v_total_refund<=0 or v_total_refund>v_remaining then
          raise exception using message='مبلغ عودت این مرجوعی از مانده قابل استرداد بیشتر است.';
        end if;

        v_refund:=public.azim_create_online_refund_request(
          v_tx.id,v_total_refund,'عودت وجه مرجوعی از پنل تلگرام',
          'telegram-return-request:'||p_request_id::text
        );

        update public.payment_refunds
        set source_type='return',source_request_id=p_request_id,updated_at=v_now
        where id=(v_refund->>'refund_id')::uuid;
      end if;

      insert into public.audit_logs(action,entity,entity_id,metadata)
      values(
        'telegram_return_refund_requested','order_return_requests',p_request_id::text,
        jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
          'amount',v_total_refund,'actor_ref',left(coalesce(p_actor_ref,''),120))
      );

      return jsonb_build_object(
        'ok',true,'action','refund','order_code',v_order.order_code,
        'status','received','refund_status','pending','amount',v_total_refund
      );
    end if;

    select coalesce(sum(refund_amount),0)::bigint into v_refunded
    from public.order_return_requests
    where order_id=v_order.id and refund_status='refunded' and id<>v_req.id;

    if v_refunded+v_req.refund_amount > v_order.total then
      raise exception using message='مجموع عودت مرجوعی از مبلغ سفارش بیشتر می‌شود.';
    end if;

    update public.orders
    set payment_status=case when v_refunded+v_req.refund_amount>=v_order.total
      then 'refunded' else 'partially_refunded' end,
        updated_at=v_now
    where id=v_order.id;

    update public.order_return_requests
    set refund_status='refunded',status='closed',updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_offline_return_refund','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'amount',v_req.refund_amount,'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object(
      'ok',true,'action','refund','order_code',v_order.order_code,
      'status','closed','refund_status','refunded',
      'payment_status',case when v_refunded+v_req.refund_amount>=v_order.total
        then 'refunded' else 'partially_refunded' end
    );
  end if;

  raise exception using message='عملیات مرجوعی نامعتبر است.';
end;
$function$;
