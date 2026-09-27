-- Telegram shipment hardening: tracking metadata must exist before packed -> shipped.
-- The live database function was updated together with this migration.

create or replace function public.azim_telegram_transition_shipping(
  p_order_code text,
  p_next_shipping text,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_order public.orders%rowtype;
  v_next text := lower(trim(coalesce(p_next_shipping,'')));
  v_prev text;
  v_now timestamptz := now();
begin
  perform private.azim_prepare_telegram_audit_actor();

  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then raise exception using message='سفارش پیدا نشد.'; end if;

  if v_next not in ('pending','packed','shipped','delivered') then
    raise exception using message='وضعیت ارسال نامعتبر است.';
  end if;

  if not exists (
    select 1 from (
      values ('pending','packed'),('packed','shipped'),('shipped','delivered')
    ) x(from_status,to_status)
    where x.from_status=v_order.shipping_status and x.to_status=v_next
  ) then
    raise exception using message='این تغییر وضعیت ارسال مجاز نیست.';
  end if;

  if v_order.payment_method='online'
     and v_next in ('packed','shipped','delivered')
     and v_order.payment_status<>'paid' then
    raise exception using message='سفارش آنلاین تا تأیید واقعی پرداخت قابل بسته‌بندی/ارسال نیست.';
  end if;

  if v_next='shipped' then
    if nullif(trim(coalesce(v_order.tracking_code,'')),'') is null then
      raise exception using message='برای «تحویل به شرکت ارسال» ثبت کد مرسوله اجباری است.';
    end if;
    if nullif(trim(coalesce(v_order.tracking_url,'')),'') is null then
      raise exception using message='برای «تحویل به شرکت ارسال» ثبت لینک پیگیری اجباری است.';
    end if;
    if nullif(trim(coalesce(v_order.shipping_carrier,'')),'') is null then
      raise exception using message='برای «تحویل به شرکت ارسال» نام شرکت ارسال اجباری است.';
    end if;
  end if;

  v_prev:=v_order.shipping_status;

  update public.orders
  set shipping_status=v_next, updated_at=v_now
  where id=v_order.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_shipping_status',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'shipping_before',v_prev,
      'shipping_after',v_next,
      'actor_ref',left(coalesce(p_actor_ref,''),120)
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,'order_code',v_order.order_code,'status',v_order.status,
    'payment_status',v_order.payment_status,'shipping_status',v_order.shipping_status,
    'payment_method',v_order.payment_method
  );
end;
$function$;

create or replace function public.azim_telegram_set_tracking(
  p_order_code text,
  p_tracking_code text,
  p_tracking_url text default null,
  p_shipping_carrier text default null,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_order public.orders%rowtype;
  v_now timestamptz := now();
  v_code text := trim(coalesce(p_tracking_code,''));
  v_url text := trim(coalesce(p_tracking_url,''));
  v_carrier text := trim(coalesce(p_shipping_carrier,''));
  v_previous_status text;
  v_previous_shipping text;
  v_is_existing_shipped boolean := false;
begin
  perform private.azim_prepare_telegram_audit_actor();

  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then raise exception using message='سفارش پیدا نشد.'; end if;
  if v_code='' then raise exception using message='کد مرسوله نمی‌تواند خالی باشد.'; end if;
  if length(v_code)>120 then raise exception using message='کد مرسوله بیش از حد طولانی است.'; end if;

  if v_url='' then
    raise exception using message='لینک پیگیری برای ثبت مرسوله الزامی است.';
  end if;
  if v_url !~* '^https?://' then
    raise exception using message='لینک پیگیری باید با http:// یا https:// شروع شود.';
  end if;
  if length(v_url)>500 then raise exception using message='لینک پیگیری بیش از حد طولانی است.'; end if;

  if v_carrier='' then
    raise exception using message='نام شرکت ارسال برای ثبت مرسوله الزامی است.';
  end if;
  if length(v_carrier)>80 then raise exception using message='نام شرکت ارسال بیش از حد طولانی است.'; end if;

  v_previous_status:=v_order.status;
  v_previous_shipping:=v_order.shipping_status;
  v_is_existing_shipped := v_order.status='shipped' and v_order.shipping_status='shipped';

  if v_order.status in ('cancelled','delivered') then
    raise exception using message='این سفارش دیگر قابل ثبت یا ویرایش اطلاعات مرسوله نیست.';
  end if;

  if v_is_existing_shipped then
    if v_order.payment_method='online' and v_order.payment_status<>'paid' then
      raise exception using message='سفارش آنلاین ارسال‌شده بدون تأیید واقعی پرداخت قابل ویرایش نیست.';
    end if;
  else
    if v_order.status<>'processing' or v_order.shipping_status<>'packed' then
      raise exception using message='برای ثبت ارسال، سفارش باید در وضعیت «در حال آماده‌سازی» و ارسال در وضعیت «بسته‌بندی شده» باشد.';
    end if;
    if v_order.payment_method='online' and v_order.payment_status<>'paid' then
      raise exception using message='سفارش آنلاین تا تأیید واقعی پرداخت قابل ارسال نیست.';
    end if;
  end if;

  update public.orders
  set tracking_code=v_code,
      tracking_url=v_url,
      shipping_carrier=v_carrier,
      shipping_status=case when v_is_existing_shipped then v_order.shipping_status else 'shipped' end,
      status=case when v_is_existing_shipped then v_order.status else 'shipped' end,
      updated_at=v_now
  where id=v_order.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_tracking_update',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'status_before',v_previous_status,
      'shipping_before',v_previous_shipping,
      'status_after',case when v_is_existing_shipped then v_order.status else 'shipped' end,
      'shipping_after',case when v_is_existing_shipped then v_order.shipping_status else 'shipped' end,
      'tracking_code',left(v_code,120),
      'tracking_url',left(v_url,500),
      'shipping_carrier',left(v_carrier,80),
      'actor_ref',left(coalesce(p_actor_ref,''),120)
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,
    'order_code',v_order.order_code,
    'status',v_order.status,
    'payment_status',v_order.payment_status,
    'payment_method',v_order.payment_method,
    'shipping_status',v_order.shipping_status,
    'tracking_code',v_order.tracking_code,
    'tracking_url',v_order.tracking_url,
    'shipping_carrier',v_order.shipping_carrier
  );
end;
$function$;

revoke all on function public.azim_telegram_transition_shipping(text,text,text) from public,anon,authenticated;
grant execute on function public.azim_telegram_transition_shipping(text,text,text) to service_role;

revoke all on function public.azim_telegram_set_tracking(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.azim_telegram_set_tracking(text,text,text,text,text) to service_role;
