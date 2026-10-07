create or replace function public.azim_admin_transition_order(
  p_order_id uuid,
  p_action text,
  p_tracking_code text default null,
  p_tracking_url text default null,
  p_shipping_carrier text default null
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_action text := lower(trim(coalesce(p_action,'')));
  v_tracking_code text := nullif(trim(coalesce(p_tracking_code,'')),'');
  v_tracking_url text := nullif(trim(coalesce(p_tracking_url,'')),'');
  v_shipping_carrier text := nullif(trim(coalesce(p_shipping_carrier,'')),'');
  v_status_after text;
  v_shipping_after text;
begin
  if not private.has_azim_role(array['owner','admin','sales']) then
    raise exception using message='دسترسی مدیریت سفارش ندارید.';
  end if;
  if p_order_id is null then raise exception using message='شناسه سفارش معتبر نیست.'; end if;
  if v_action not in ('confirm_order','start_processing','mark_packed','mark_shipped','mark_delivered') then
    raise exception using message='عملیات مرحله سفارش نامعتبر است.';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception using message='سفارش پیدا نشد.'; end if;
  if v_order.status='cancelled' then raise exception using message='سفارش لغوشده قابل انتقال در چرخه فعال نیست.'; end if;

  if v_action='confirm_order' then
    if v_order.status<>'pending' then raise exception using message='فقط سفارش در انتظار تأیید قابل تأیید است.'; end if;
    if v_order.payment_status<>'paid' then raise exception using message='تا قطعی شدن پرداخت، تأیید نهایی سفارش مجاز نیست.'; end if;
    v_status_after:='confirmed'; v_shipping_after:=v_order.shipping_status;
  elsif v_action='start_processing' then
    if v_order.status<>'confirmed' then raise exception using message='فقط سفارش تأییدشده قابل ورود به پردازش است.'; end if;
    if v_order.payment_status<>'paid' then raise exception using message='تا قطعی شدن پرداخت، شروع پردازش مجاز نیست.'; end if;
    v_status_after:='processing'; v_shipping_after:=v_order.shipping_status;
  elsif v_action='mark_packed' then
    if v_order.status<>'processing' or v_order.shipping_status<>'pending' then
      raise exception using message='فقط سفارش در حال پردازش و بدون وضعیت بسته‌بندی قابل ثبت بسته‌بندی است.';
    end if;
    if v_order.payment_status<>'paid' then raise exception using message='تا قطعی شدن پرداخت، بسته‌بندی مجاز نیست.'; end if;
    v_status_after:='processing'; v_shipping_after:='packed';
  elsif v_action='mark_shipped' then
    if v_order.status<>'processing' or v_order.shipping_status<>'packed' then raise exception using message='ابتدا سفارش را بسته‌بندی‌شده ثبت کنید.'; end if;
    if v_order.payment_status<>'paid' then raise exception using message='تا قطعی شدن پرداخت، ارسال سفارش مجاز نیست.'; end if;
    if v_tracking_code is null then raise exception using message='کد مرسوله اجباری است.'; end if;
    if v_tracking_url is null or v_tracking_url !~* '^https?://[^[:space:]]+$' then raise exception using message='لینک کامل پیگیری معتبر اجباری است.'; end if;
    if v_shipping_carrier is null then raise exception using message='نام شرکت ارسال اجباری است.'; end if;
    v_status_after:='shipped'; v_shipping_after:='shipped';
  elsif v_action='mark_delivered' then
    if v_order.status<>'shipped' or v_order.shipping_status<>'shipped' then raise exception using message='فقط سفارش ارسال‌شده قابل ثبت به‌عنوان تحویل‌شده است.'; end if;
    if v_tracking_code is null and v_order.tracking_code is null then raise exception using message='اطلاعات مرسوله برای ثبت تحویل کامل نیست.'; end if;
    if v_tracking_url is null and v_order.tracking_url is null then raise exception using message='لینک پیگیری برای ثبت تحویل کامل نیست.'; end if;
    if v_shipping_carrier is null and v_order.shipping_carrier is null then raise exception using message='شرکت ارسال برای ثبت تحویل مشخص نشده است.'; end if;
    v_status_after:='delivered'; v_shipping_after:='delivered';
  end if;

  update public.orders
  set status=v_status_after,
      shipping_status=v_shipping_after,
      tracking_code=case when v_action='mark_shipped' then v_tracking_code else tracking_code end,
      tracking_url=case when v_action='mark_shipped' then v_tracking_url else tracking_url end,
      shipping_carrier=case when v_action='mark_shipped' then v_shipping_carrier else shipping_carrier end,
      updated_at=now()
  where id=v_order.id;

  insert into public.audit_logs(actor_id,action,entity,entity_id,metadata)
  values(
    auth.uid(),'admin_order_transition','orders',v_order.id::text,
    jsonb_build_object('order_code',v_order.order_code,'action',v_action,
      'status_before',v_order.status,'status_after',v_status_after,
      'shipping_before',v_order.shipping_status,'shipping_after',v_shipping_after)
  );

  select * into v_order from public.orders where id=v_order.id;
  return jsonb_build_object('ok',true,'order_id',v_order.id,'order_code',v_order.order_code,
    'action',v_action,'status',v_order.status,'payment_status',v_order.payment_status,
    'shipping_status',v_order.shipping_status,'tracking_code',v_order.tracking_code,
    'tracking_url',v_order.tracking_url,'shipping_carrier',v_order.shipping_carrier);
end;
$function$;

revoke execute on function public.azim_admin_transition_order(uuid,text,text,text,text) from public;
revoke execute on function public.azim_admin_transition_order(uuid,text,text,text,text) from anon;
grant execute on function public.azim_admin_transition_order(uuid,text,text,text,text) to authenticated;