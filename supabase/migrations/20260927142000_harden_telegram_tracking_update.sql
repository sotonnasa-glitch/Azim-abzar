-- Secure Telegram tracking update.
-- Keeps tracking registration inside the same state/financial guardrails as
-- the normal order transition RPCs and records an audit event.
begin;

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
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_now timestamptz := now();
  v_code text := trim(coalesce(p_tracking_code,''));
  v_url text := trim(coalesce(p_tracking_url,''));
  v_carrier text := trim(coalesce(p_shipping_carrier,''));
  v_previous_status text;
  v_previous_shipping text;
begin
  perform private.azim_prepare_telegram_audit_actor();

  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then
    raise exception using message='سفارش پیدا نشد.';
  end if;

  if v_code='' then
    raise exception using message='کد مرسوله نمی‌تواند خالی باشد.';
  end if;

  if length(v_code)>120 then
    raise exception using message='کد مرسوله بیش از حد طولانی است.';
  end if;

  if v_url<>'' and v_url !~* '^https?://' then
    raise exception using message='لینک پیگیری باید با http:// یا https:// شروع شود.';
  end if;

  if length(v_url)>500 then
    raise exception using message='لینک پیگیری بیش از حد طولانی است.';
  end if;

  if length(v_carrier)>80 then
    raise exception using message='نام شرکت ارسال بیش از حد طولانی است.';
  end if;

  v_previous_status:=v_order.status;
  v_previous_shipping:=v_order.shipping_status;

  if v_order.status in ('cancelled','delivered') then
    raise exception using message='این سفارش دیگر قابل ثبت یا ویرایش اطلاعات مرسوله نیست.';
  end if;

  if v_order.status='shipped' and v_order.shipping_status='shipped' then
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
      tracking_url=case when v_url='' then null else v_url end,
      shipping_carrier=case when v_carrier='' then null else v_carrier end,
      shipping_status=case
        when v_order.status='shipped' and v_order.shipping_status='shipped' then v_order.shipping_status
        else 'shipped'
      end,
      status=case
        when v_order.status='shipped' and v_order.shipping_status='shipped' then v_order.status
        else 'shipped'
      end,
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
      'status_after',case
        when v_order.status='shipped' and v_order.shipping_status='shipped' then v_order.status
        else 'shipped'
      end,
      'shipping_after',case
        when v_order.status='shipped' and v_order.shipping_status='shipped' then v_order.shipping_status
        else 'shipped'
      end,
      'tracking_code',left(v_code,120),
      'tracking_url',case when v_url='' then null else left(v_url,500) end,
      'shipping_carrier',case when v_carrier='' then null else left(v_carrier,80) end,
      'actor_ref',left(coalesce(p_actor_ref,''),120)
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,
    'order_code',v_order.order_code,
    'status',v_order.status,
    'payment_status',v_order.payment_status,
    'shipping_status',v_order.shipping_status,
    'tracking_code',v_order.tracking_code,
    'tracking_url',v_order.tracking_url,
    'shipping_carrier',v_order.shipping_carrier
  );
end;
$function$;

revoke all on function public.azim_telegram_set_tracking(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.azim_telegram_set_tracking(text,text,text,text,text) to service_role;

commit;
