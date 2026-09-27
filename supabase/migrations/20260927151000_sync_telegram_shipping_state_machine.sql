-- Telegram shipping state hardening:
-- shipping_status and orders.status are synchronized for packed -> shipped -> delivered.
-- tracking code, tracking URL and carrier are mandatory before shipped.

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
  if v_order.status='cancelled' then
    raise exception using message='سفارش لغوشده دیگر قابل تغییر وضعیت ارسال نیست.';
  end if;

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

  if v_next='packed' and v_order.status<>'processing' then
    raise exception using message='برای «بسته‌بندی شده»، سفارش باید در وضعیت «در حال آماده‌سازی» باشد.';
  end if;

  if v_next='shipped' and v_order.status<>'processing' then
    raise exception using message='برای «تحویل به شرکت ارسال»، سفارش باید در وضعیت «در حال آماده‌سازی» باشد.';
  end if;

  if v_next='delivered' and v_order.status<>'shipped' then
    raise exception using message='برای «تحویل شده»، وضعیت سفارش باید ابتدا «ارسال شده» باشد.';
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
  set shipping_status=v_next,
      status=case
        when v_next='shipped' then 'shipped'
        when v_next='delivered' then 'delivered'
        else v_order.status
      end,
      updated_at=v_now
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
      'status_before',v_order.status,
      'status_after',case
        when v_next='shipped' then 'shipped'
        when v_next='delivered' then 'delivered'
        else v_order.status
      end,
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
    'payment_method',v_order.payment_method
  );
end;
$function$;

revoke all on function public.azim_telegram_transition_shipping(text,text,text) from public,anon,authenticated;
grant execute on function public.azim_telegram_transition_shipping(text,text,text) to service_role;
