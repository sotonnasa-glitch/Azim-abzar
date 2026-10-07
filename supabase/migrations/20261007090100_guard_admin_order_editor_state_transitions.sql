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
  v_existing_status text;
  v_existing_shipping text;
begin
  if not private.has_azim_role(array['owner','admin','sales']) then raise exception using message='دسترسی ثبت سفارش ندارید.'; end if;
  if v_status not in ('pending','confirmed','processing','shipped','delivered','cancelled') then raise exception using message='وضعیت سفارش نامعتبر است.'; end if;
  if v_shipping not in ('pending','packed','shipped','delivered') then raise exception using message='وضعیت ارسال نامعتبر است.'; end if;

  if p_order_id is not null then
    select status, shipping_status into v_existing_status, v_existing_shipping
    from public.orders where id=p_order_id for update;
    if not found then raise exception using message='سفارش پیدا نشد.'; end if;
    if v_status is distinct from v_existing_status then raise exception using message='تغییر مرحله سفارش فقط از طریق عملیات مرحله‌ای سفارش مجاز است.'; end if;
    if v_shipping is distinct from v_existing_shipping then raise exception using message='تغییر مرحله ارسال فقط از طریق عملیات مرحله‌ای سفارش مجاز است.'; end if;
  end if;

  if v_status='cancelled' then
    v_shipping := 'pending';
    v_tracking_code := null;
    v_tracking_url := null;
    v_shipping_carrier := null;
  end if;

  if v_shipping='packed' and v_status<>'processing' then raise exception using message='وضعیت «بسته‌بندی شده» فقط برای سفارش در حال آماده‌سازی مجاز است.'; end if;
  if v_shipping='shipped' then
    if v_status<>'shipped' then raise exception using message='وضعیت «تحویل به شرکت ارسال» باید با وضعیت سفارش «ارسال شده» هماهنگ باشد.'; end if;
    if v_tracking_code is null then raise exception using message='برای ارسال، کد مرسوله اجباری است.'; end if;
    if v_tracking_url is null or v_tracking_url !~* '^https?://[^[:space:]]+$' then raise exception using message='برای ارسال، لینک کامل پیگیری معتبر اجباری است.'; end if;
    if v_shipping_carrier is null then raise exception using message='برای ارسال، نام شرکت ارسال اجباری است.'; end if;
  end if;
  if v_shipping='delivered' then
    if v_status<>'delivered' then raise exception using message='وضعیت «تحویل شده» باید با وضعیت سفارش «تحویل شده» هماهنگ باشد.'; end if;
    if v_tracking_code is null or v_tracking_url is null or v_shipping_carrier is null then raise exception using message='برای تحویل شده، اطلاعات کامل مرسوله باید ثبت شده باشد.'; end if;
  end if;
  if v_status='shipped' and v_shipping<>'shipped' then raise exception using message='سفارش ارسال شده باید وضعیت ارسال «تحویل به شرکت ارسال» داشته باشد.'; end if;
  if v_status='delivered' and v_shipping<>'delivered' then raise exception using message='سفارش تحویل شده باید وضعیت ارسال «تحویل شده» داشته باشد.'; end if;
  if v_status='cancelled' and v_shipping in ('shipped','delivered') then raise exception using message='سفارش لغوشده نمی‌تواند وضعیت ارسال شده یا تحویل شده داشته باشد.'; end if;

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

  return v_result || jsonb_build_object('tracking_url',v_tracking_url,'shipping_carrier',v_shipping_carrier);
end;
$function$;