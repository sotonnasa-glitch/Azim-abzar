-- Admin-panel counterpart of the secure Telegram cancelled-order restore flow.
-- Requires an authenticated AAL2 admin/sales session and records the acting user.

create or replace function private.azim_admin_restore_cancelled_order_core(
  p_order_code text,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_order public.orders%rowtype;
  v_open_refund_count integer := 0;
  v_new_payment_status text;
  v_now timestamptz := now();
  v_actor_ref text := left(coalesce(nullif(trim(coalesce(p_actor_ref,'')),''), auth.uid()::text, ''), 120);
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text,'sales'::text]) then
    raise exception using message='نقش شما اجازه بازگردانی سفارش را ندارد.';
  end if;

  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای بازگردانی سفارش، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;

  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then
    raise exception using message='سفارش پیدا نشد.';
  end if;

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
      payment_status=v_new_payment_status,
      paid_at=null,
      updated_at=v_now
  where id=v_order.id;

  insert into public.audit_logs(actor_id,action,entity,entity_id,metadata)
  values(
    auth.uid(),
    'admin_restore_cancelled_order',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'status_before','cancelled',
      'status_after','pending',
      'shipping_before',v_order.shipping_status,
      'shipping_after','pending',
      'payment_before',v_order.payment_status,
      'payment_after',v_new_payment_status,
      'tracking_cleared',true,
      'actor_ref',v_actor_ref
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,
    'order_code',v_order.order_code,
    'status',v_order.status,
    'payment_status',v_order.payment_status,
    'payment_method',v_order.payment_method,
    'shipping_status',v_order.shipping_status
  );
end;
$function$;

create or replace function public.azim_admin_restore_cancelled_order(
  p_order_code text,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
begin
  return private.azim_admin_restore_cancelled_order_core(p_order_code,p_actor_ref);
end;
$function$;

revoke all on function public.azim_admin_restore_cancelled_order(text,text) from public;
revoke all on function public.azim_admin_restore_cancelled_order(text,text) from anon;
grant execute on function public.azim_admin_restore_cancelled_order(text,text) to authenticated;

-- Admin order shipping consistency: keep the admin order editor aligned with the
-- Telegram shipping state machine. Legacy 11-argument order-save RPC is retired
-- for authenticated clients; the new 13-argument form carries tracking URL/carrier.

create or replace function public.azim_save_order_with_discount(
  p_order_id uuid default null,
  p_order_code text default null,
  p_customer_id uuid default null,
  p_status text default 'pending',
  p_payment_status text default 'unpaid',
  p_shipping_status text default 'pending',
  p_shipping_cost bigint default 0,
  p_tracking_code text default null,
  p_notes text default null,
  p_discount_code text default null,
  p_items jsonb default '[]'::jsonb,
  p_tracking_url text default null,
  p_shipping_carrier text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
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
  if v_shipping='packed' and v_status<>'processing' then
    raise exception using message='وضعیت «بسته‌بندی شده» فقط برای سفارش در حال آماده‌سازی مجاز است.';
  end if;
  if v_shipping='shipped' then
    if v_status<>'shipped' then
      raise exception using message='وضعیت «تحویل به شرکت ارسال» باید با وضعیت سفارش «ارسال شده» هماهنگ باشد.';
    end if;
    if v_tracking_code is null then
      raise exception using message='برای ارسال، کد مرسوله اجباری است.';
    end if;
    if v_tracking_url is null or v_tracking_url !~* '^https?://[^[:space:]]+$' then
      raise exception using message='برای ارسال، لینک کامل پیگیری معتبر اجباری است.';
    end if;
    if v_shipping_carrier is null then
      raise exception using message='برای ارسال، نام شرکت ارسال اجباری است.';
    end if;
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
  if v_order_id is null then
    raise exception using message='ثبت سفارش انجام نشد.';
  end if;

  update public.orders
  set tracking_url=v_tracking_url,
      shipping_carrier=v_shipping_carrier,
      updated_at=now()
  where id=v_order_id;

  return v_result || jsonb_build_object(
    'tracking_url',v_tracking_url,
    'shipping_carrier',v_shipping_carrier
  );
end;
$function$;

revoke all on function public.azim_save_order_with_discount(
  uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb
) from public,anon,authenticated;

revoke all on function public.azim_save_order_with_discount(
  uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb,text,text
) from public,anon;
grant execute on function public.azim_save_order_with_discount(
  uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb,text,text
) to authenticated;
