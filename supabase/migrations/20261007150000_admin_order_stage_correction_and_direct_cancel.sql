begin;

create or replace function public.azim_admin_correct_order_stage(
  p_order_id uuid,
  p_target_stage text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_target text := lower(trim(coalesce(p_target_stage,'')));
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
  v_status_after text;
  v_shipping_after text;
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message='این عملیات فقط برای مالک یا مدیر اصلی و نشست MFA تأییدشده مجاز است.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای اصلاح مرحله سفارش، تأیید دومرحله‌ای لازم است.';
  end if;
  if p_order_id is null then
    raise exception using message='شناسه سفارش معتبر نیست.';
  end if;
  if v_reason is null or char_length(v_reason) < 5 then
    raise exception using message='دلیل اصلاح مرحله باید حداقل ۵ کاراکتر باشد.';
  end if;
  if v_target not in ('pending','confirmed','processing','packed') then
    raise exception using message='مرحله مقصد برای اصلاح سفارش معتبر نیست.';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then
    raise exception using message='سفارش پیدا نشد.';
  end if;
  if v_order.status='cancelled' or v_order.status='delivered' or v_order.shipping_status='delivered' then
    raise exception using message='سفارش لغوشده یا تحویل‌شده قابل اصلاح مرحله‌ای نیست.';
  end if;

  if v_target='confirmed' then
    if v_order.status <> 'processing' or v_order.shipping_status <> 'pending' then
      raise exception using message='از وضعیت فعلی فقط اصلاح به مرحله «تأیید شده» در چرخه مجاز است.';
    end if;
    v_status_after := 'confirmed';
    v_shipping_after := 'pending';
  elsif v_target='pending' then
    if v_order.status <> 'confirmed' or v_order.shipping_status <> 'pending' then
      raise exception using message='فقط سفارش «تأیید شده» را می‌توان به «در انتظار تأیید» برگرداند.';
    end if;
    v_status_after := 'pending';
    v_shipping_after := 'pending';
  elsif v_target='processing' then
    if not (
      (v_order.status='processing' and v_order.shipping_status='packed')
      or (v_order.status='shipped' and v_order.shipping_status='shipped')
    ) then
      raise exception using message='از وضعیت فعلی، بازگشت به «در حال پردازش» مجاز نیست.';
    end if;
    v_status_after := 'processing';
    v_shipping_after := 'pending';
  elsif v_target='packed' then
    if v_order.status <> 'shipped' or v_order.shipping_status <> 'shipped' then
      raise exception using message='فقط سفارش «ارسال شده» را می‌توان به «بسته‌بندی شده» برگرداند.';
    end if;
    v_status_after := 'processing';
    v_shipping_after := 'packed';
  end if;

  if v_order.payment_status not in ('paid','partially_refunded','refunded') then
    raise exception using message='اصلاح مرحله برای سفارش با وضعیت پرداخت فعلی مجاز نیست.';
  end if;

  update public.orders
  set status=v_status_after,
      shipping_status=v_shipping_after,
      tracking_code=case when v_shipping_after <> 'shipped' then null else tracking_code end,
      tracking_url=case when v_shipping_after <> 'shipped' then null else tracking_url end,
      shipping_carrier=case when v_shipping_after <> 'shipped' then null else shipping_carrier end,
      delivered_at=case when v_status_after <> 'delivered' then null else delivered_at end,
      updated_at=now()
  where id=v_order.id;

  insert into public.audit_logs(actor_id,action,entity,entity_id,metadata)
  values(
    auth.uid(),'admin_order_stage_correction','orders',v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'status_before',v_order.status,'status_after',v_status_after,
      'shipping_before',v_order.shipping_status,'shipping_after',v_shipping_after,
      'reason',left(v_reason,1000)
    )
  );

  return jsonb_build_object(
    'ok',true,'order_id',v_order.id,'order_code',v_order.order_code,
    'status_before',v_order.status,'status_after',v_status_after,
    'shipping_before',v_order.shipping_status,'shipping_after',v_shipping_after,
    'tracking_cleared',v_shipping_after <> 'shipped'
  );
end;
$function$;

revoke all on function public.azim_admin_correct_order_stage(uuid,text,text) from public, anon;
grant execute on function public.azim_admin_correct_order_stage(uuid,text,text) to authenticated;

create or replace function public.azim_admin_cancel_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_request public.order_action_requests%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
  v_existing uuid;
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message='این عملیات فقط برای مالک یا مدیر اصلی و نشست MFA تأییدشده مجاز است.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای لغو مستقیم سفارش، تأیید دومرحله‌ای لازم است.';
  end if;
  if p_order_id is null then
    raise exception using message='شناسه سفارش معتبر نیست.';
  end if;
  if v_reason is null or char_length(v_reason) < 5 then
    raise exception using message='دلیل لغو سفارش باید حداقل ۵ کاراکتر باشد.';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then
    raise exception using message='سفارش پیدا نشد.';
  end if;
  if v_order.status in ('cancelled','delivered') or v_order.shipping_status in ('shipped','delivered') then
    raise exception using message='این سفارش دیگر قبل از ارسال قابل لغو نیست.';
  end if;
  if v_order.status not in ('pending','confirmed','processing') then
    raise exception using message='این سفارش فعلاً در مرحله‌ای نیست که از پنل قابل لغو باشد.';
  end if;

  select id into v_existing
  from public.order_action_requests
  where order_id=v_order.id
    and request_type='cancel'
    and status='pending'
  order by created_at desc
  limit 1
  for update;

  if v_existing is not null then
    raise exception using message='برای این سفارش یک درخواست لغو در حال بررسی وجود دارد.';
  end if;

  insert into public.order_action_requests(
    order_id,request_type,status,reason,customer_mobile,refund_status
  )
  values(
    v_order.id,'cancel','pending','لغو توسط مدیر: '||left(v_reason,900),
    v_order.customer_mobile,
    case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end
  )
  returning * into v_request;

  return public.azim_telegram_handle_cancel_request(
    v_request.id,'approve',
    'admin-panel:'||coalesce(auth.uid()::text,'unknown')||' reason:'||left(v_reason,120)
  );
end;
$function$;

revoke all on function public.azim_admin_cancel_order(uuid,text) from public, anon;
grant execute on function public.azim_admin_cancel_order(uuid,text) to authenticated;

commit;
