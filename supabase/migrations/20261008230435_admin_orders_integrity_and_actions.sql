CREATE OR REPLACE FUNCTION private.guard_order_payment_status_integrity()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_transition text := coalesce(current_setting('azim.payment_transition',true),'');
begin
  if old.payment_status is distinct from new.payment_status
     and v_transition not in ('verified','refund_verified','manual_verified','telegram_offline_verified','offline_refund_verified','restore_cancelled','checkout_setup') then
    raise exception using message='وضعیت پرداخت فقط از مسیر امن پرداخت دستی، درگاه، عودت یا بازگردانی قابل تغییر است.';
  end if;
  return new;
end;
$function$;
DROP TRIGGER IF EXISTS orders_payment_status_integrity_guard ON public.orders;
CREATE TRIGGER orders_payment_status_integrity_guard BEFORE UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.guard_order_payment_status_integrity();
REVOKE EXECUTE ON FUNCTION private.guard_order_payment_status_integrity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.guard_shipped_order_tracking_immutability()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_transition text := coalesce(current_setting('azim.order_tracking_transition',true),'');
begin
  if (old.tracking_code is distinct from new.tracking_code or old.tracking_url is distinct from new.tracking_url or old.shipping_carrier is distinct from new.shipping_carrier)
     and (old.status in ('shipped','delivered') or old.shipping_status in ('shipped','delivered'))
     and v_transition not in ('stage_correction','shipment_correction','restore_cancelled') then
    raise exception using message='اطلاعات مرسوله پس از ارسال/تحویل قفل است؛ برای اصلاح از عملیات دارای مجوز و دلیل استفاده کنید.';
  end if;
  return new;
end;
$function$;
DROP TRIGGER IF EXISTS orders_shipped_tracking_immutability_guard ON public.orders;
CREATE TRIGGER orders_shipped_tracking_immutability_guard BEFORE UPDATE OF tracking_code, tracking_url, shipping_carrier ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.guard_shipped_order_tracking_immutability();
REVOKE EXECUTE ON FUNCTION private.guard_shipped_order_tracking_immutability() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.azim_admin_record_manual_payment(p_order_id uuid, p_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_order public.orders%rowtype;
  v_reference text := nullif(trim(coalesce(p_reference,'')),'');
begin
  if not private.has_azim_role(array['owner','admin','sales']) then
    raise exception using message='دسترسی ثبت پرداخت دستی ندارید.';
  end if;

  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای ثبت پرداخت دستی، تأیید دومرحله‌ای لازم است.';
  end if;

  if p_order_id is null then
    raise exception using message='شناسه سفارش معتبر نیست.';
  end if;

  if v_reference is null or length(v_reference) < 3 then
    raise exception using message='شناسه یا توضیح تأیید پرداخت را وارد کنید.';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then
    raise exception using message='سفارش پیدا نشد.';
  end if;

  if v_order.payment_method not in ('phone','message') then
    raise exception using message='این سفارش از مسیر پرداخت دستی قابل تأیید نیست.';
  end if;

  if v_order.status='cancelled' then
    raise exception using message='سفارش لغوشده قابل ثبت پرداخت جدید نیست.';
  end if;

  if v_order.payment_status in ('paid','partially_refunded','refunded') then
    raise exception using message='پرداخت این سفارش قبلاً نهایی شده است.';
  end if;

  perform set_config('azim.payment_transition','manual_verified',true);

  update public.orders
  set payment_status='paid',
      payment_reference=v_reference,
      paid_at=now(),
      updated_at=now()
  where id=v_order.id;

  insert into public.audit_logs(actor_id,action,entity,entity_id,metadata)
  values(
    auth.uid(),
    'admin_manual_payment_recorded',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'payment_method',v_order.payment_method,
      'payment_status_before',v_order.payment_status,
      'payment_status_after','paid',
      'payment_reference',v_reference
    )
  );

  return jsonb_build_object(
    'ok',true,
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'payment_status','paid',
    'payment_reference',v_reference,
    'paid_at',now()
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.azim_telegram_set_offline_payment(p_order_code text, p_next_payment text, p_actor_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order public.orders%rowtype;
  v_next text := lower(trim(coalesce(p_next_payment,'')));
  v_prev text;
  v_now timestamptz := now();
begin
  perform private.azim_prepare_telegram_audit_actor();
  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then raise exception using message='سفارش پیدا نشد.'; end if;

  if v_order.payment_method='online' then
    raise exception using message='وضعیت مالی سفارش آنلاین فقط از مسیر امن درگاه تغییر می‌کند.';
  end if;

  if v_next not in ('unpaid','pending','paid','refunded') then
    raise exception using message='وضعیت پرداخت نامعتبر است.';
  end if;

  if not exists (
    select 1 from (
      values
        ('unpaid','pending'),('unpaid','paid'),
        ('pending','unpaid'),('pending','paid'),
        ('paid','refunded')
    ) x(from_status,to_status)
    where x.from_status=v_order.payment_status and x.to_status=v_next
  ) then
    raise exception using message='این تغییر وضعیت پرداخت مجاز نیست.';
  end if;

  v_prev:=v_order.payment_status;

  perform set_config('azim.payment_transition','telegram_offline_verified',true);

  update public.orders
  set payment_status=v_next,
      paid_at=case when v_next='paid' then coalesce(paid_at,v_now)
                   when v_next in ('unpaid','pending') then null
                   else paid_at end,
      updated_at=v_now
  where id=v_order.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_offline_payment_status',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'payment_before',v_prev,
      'payment_after',v_next,
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
$function$
;

CREATE OR REPLACE FUNCTION private.azim_admin_restore_cancelled_order_core(p_order_code text, p_actor_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if v_order.payment_status is distinct from v_new_payment_status
     and coalesce(current_setting('azim.payment_transition',true),'') <> 'refund_verified' then
    perform set_config('azim.payment_transition','restore_cancelled',true);
  end if;
  perform set_config('azim.order_tracking_transition','restore_cancelled',true);

  update public.orders
  set status='pending',
      shipping_status='pending',
      tracking_code=null,
      tracking_url=null,
      shipping_carrier=null,
      payment_status=v_new_payment_status,
      paid_at=case when v_new_payment_status in ('paid','partially_refunded','refunded') then v_order.paid_at else null end,
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
$function$
;

CREATE OR REPLACE FUNCTION public.azim_telegram_restore_cancelled_order(p_order_code text, p_actor_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if v_order.payment_status is distinct from v_new_payment_status
     and coalesce(current_setting('azim.payment_transition',true),'') <> 'refund_verified' then
    perform set_config('azim.payment_transition','restore_cancelled',true);
  end if;
  perform set_config('azim.order_tracking_transition','restore_cancelled',true);

  update public.orders
  set status='pending',
      shipping_status='pending',
      tracking_code=null,
      tracking_url=null,
      shipping_carrier=null,
      delivered_at=null,
      payment_status=v_new_payment_status,
      paid_at=case when v_new_payment_status in ('paid','partially_refunded','refunded') then v_order.paid_at else null end,
      updated_at=v_now
  where id=v_order.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_restore_cancelled_order',
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
      'delivered_at_cleared',true,
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
    'shipping_status',v_order.shipping_status
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.azim_set_checkout_payment_method(p_order_id uuid, p_payment_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_method text := lower(trim(coalesce(p_payment_method,'')));
  v_provider text := null;
  v_online_enabled boolean := false;
  v_gateway_ready boolean := false;
  v_order public.orders%rowtype;
begin
  if v_method <> 'online' then
    raise exception using message='روش پرداخت فروشگاه فقط پرداخت آنلاین است.';
  end if;

  select
    nullif(trim(sc.payload->>'provider'),''),
    lower(coalesce(sc.payload->>'online_enabled','false'))='true',
    lower(coalesce(sc.payload->>'gateway_ready','false'))='true'
  into v_provider, v_online_enabled, v_gateway_ready
  from public.site_content sc
  where sc.section_key='checkout_payment' and sc.is_active=true
  order by sc.updated_at desc
  limit 1;

  if not coalesce(v_online_enabled,false)
     or not coalesce(v_gateway_ready,false)
     or v_provider is null then
    raise exception using message='درگاه پرداخت آنلاین هنوز کامل پیکربندی نشده است.';
  end if;

  perform set_config('azim.payment_transition','checkout_setup',true);

  update public.orders
  set payment_method='online',
      payment_provider=v_provider,
      payment_status='pending',
      paid_at=null,
      notes='ثبت از سایت؛ روش پرداخت: آنلاین؛ پرداخت پس از تأیید درگاه نهایی می‌شود.',
      updated_at=now()
  where id=p_order_id
  returning * into v_order;

  if not found then
    raise exception using message='سفارش برای تنظیم روش پرداخت پیدا نشد.';
  end if;

  return jsonb_build_object(
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'payment_method',v_order.payment_method,
    'payment_status',v_order.payment_status,
    'payment_provider',v_order.payment_provider
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.azim_admin_correct_order_stage(p_order_id uuid, p_target_stage text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

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

  perform set_config('azim.order_tracking_transition','stage_correction',true);

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
    auth.uid(),
    'admin_order_stage_correction',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'status_before',v_order.status,
      'status_after',v_status_after,
      'shipping_before',v_order.shipping_status,
      'shipping_after',v_shipping_after,
      'reason',left(v_reason,1000)
    )
  );

  return jsonb_build_object(
    'ok',true,
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'status_before',v_order.status,
    'status_after',v_status_after,
    'shipping_before',v_order.shipping_status,
    'shipping_after',v_shipping_after,
    'tracking_cleared',v_shipping_after <> 'shipped'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.azim_telegram_handle_cancel_request(p_request_id uuid, p_action text, p_actor_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  select * into v_req
  from public.order_action_requests
  where id=p_request_id
  for update;

  if not found then raise exception using message='درخواست لغو پیدا نشد.'; end if;
  if v_req.request_type<>'cancel' then raise exception using message='این درخواست از نوع لغو نیست.'; end if;

  select * into v_order
  from public.orders
  where id=v_req.order_id
  for update;

  if not found then raise exception using message='سفارش مرتبط با درخواست پیدا نشد.'; end if;

  if v_action='approve' then
    if v_req.status<>'pending' then
      raise exception using message='این درخواست دیگر در وضعیت قابل تأیید نیست.';
    end if;

    if v_order.status not in ('pending','confirmed','processing')
       or v_order.shipping_status in ('shipped','delivered') then
      raise exception using message='این سفارش دیگر قبل از ارسال قابل لغو نیست.';
    end if;

    v_refund_status :=
      case when v_order.payment_status in ('paid','partially_refunded')
           then 'pending' else 'not_required' end;

    update public.orders
    set status='cancelled',
        shipping_status='pending',
        delivered_at=null,
        updated_at=v_now
    where id=v_order.id;

    if v_order.payment_method='online'
       and v_refund_status='pending' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id
        and status in ('paid','partially_refunded')
      order by created_at desc limit 1
      for update;

      if not found then
        raise exception using message='پرداخت آنلاین ثبت شده اما تراکنش موفق برای عودت پیدا نشد؛ لغو برای حفظ وضعیت مالی متوقف شد.';
      end if;

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id
        and status in ('requested','pending','processing')
      order by created_at desc limit 1
      for update;

      if not found then
        select coalesce(sum(amount),0)::bigint into v_refunded
        from public.payment_refunds
        where transaction_id=v_tx.id and status='refunded';

        v_remaining:=greatest(0,v_tx.amount-v_refunded);

        if v_remaining>0 then
          v_refund:=public.azim_create_online_refund_request(
            v_tx.id,v_remaining,
            'عودت وجه لغو سفارش از پنل تلگرام',
            'telegram-cancel-request:'||p_request_id::text
          );
          update public.payment_refunds
          set source_type='cancel',
              source_request_id=p_request_id,
              updated_at=v_now
          where id=(v_refund->>'refund_id')::uuid;
        else
          v_refund_status:='not_required';
        end if;
      end if;
    end if;

    update public.order_action_requests
    set status='approved',
        refund_status=v_refund_status,
        handled_by=null,
        updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_cancel_approved',
      'order_action_requests',
      p_request_id::text,
      jsonb_build_object(
        'order_id',v_order.id,
        'order_code',v_order.order_code,
        'refund_status',v_refund_status,
        'actor_ref',left(coalesce(p_actor_ref,''),120)
      )
    );

    return jsonb_build_object(
      'ok',true,'action','approve','order_code',v_order.order_code,
      'status','cancelled',
      'payment_status',case
        when v_order.payment_status='pending' then 'unpaid'
        else v_order.payment_status end,
      'refund_status',v_refund_status
    );
  end if;

  if v_action='reject' then
    if v_req.status<>'pending' then
      raise exception using message='این درخواست دیگر در وضعیت قابل رد نیست.';
    end if;

    update public.order_action_requests
    set status='rejected',updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_cancel_rejected','order_action_requests',
      p_request_id::text,
      jsonb_build_object(
        'order_id',v_order.id,
        'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120)
      )
    );

    return jsonb_build_object(
      'ok',true,'action','reject','order_code',v_order.order_code,'status','rejected'
    );
  end if;

  if v_action='refund' then
    if v_req.status<>'approved' or v_req.refund_status<>'pending'
       or v_order.payment_status not in ('paid','partially_refunded') then
      raise exception using message='این درخواست در وضعیت لازم برای عودت وجه نیست.';
    end if;

    if v_order.payment_method='online' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id
        and status in ('paid','partially_refunded')
      order by created_at desc limit 1
      for update;

      if not found then raise exception using message='تراکنش پرداخت موفق برای این سفارش پیدا نشد.'; end if;

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id
        and status in ('requested','pending','processing')
      order by created_at desc limit 1
      for update;

      if not found then
        select coalesce(sum(amount),0)::bigint into v_refunded
        from public.payment_refunds
        where transaction_id=v_tx.id and status='refunded';

        v_remaining:=greatest(0,v_tx.amount-v_refunded);

        if v_remaining<=0 then
          update public.order_action_requests
          set refund_status='refunded',updated_at=v_now
          where id=v_req.id;
          return jsonb_build_object(
            'ok',true,'action','refund','order_code',v_order.order_code,
            'refund_status','refunded','already_refunded',true
          );
        end if;

        v_refund:=public.azim_create_online_refund_request(
          v_tx.id,v_remaining,
          'عودت وجه لغو سفارش از پنل تلگرام',
          'telegram-cancel-request-refund:'||p_request_id::text
        );

        update public.payment_refunds
        set source_type='cancel',
            source_request_id=p_request_id,
            updated_at=v_now
        where id=(v_refund->>'refund_id')::uuid;
      end if;

      insert into public.audit_logs(
        action,entity,entity_id,metadata
      )
      values(
        'telegram_cancel_refund_requested',
        'order_action_requests',
        p_request_id::text,
        jsonb_build_object(
          'order_id',v_order.id,
          'order_code',v_order.order_code,
          'actor_ref',left(coalesce(p_actor_ref,''),120)
        )
      );

      return jsonb_build_object(
        'ok',true,'action','refund','order_code',v_order.order_code,
        'refund_status','pending','payment_status',v_order.payment_status
      );
    end if;

    perform set_config('azim.payment_transition','offline_refund_verified',true);

    update public.orders
    set payment_status='refunded',updated_at=v_now
    where id=v_order.id;

    update public.order_action_requests
    set refund_status='refunded',updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(
      action,entity,entity_id,metadata
    )
    values(
      'telegram_offline_cancel_refund',
      'order_action_requests',
      p_request_id::text,
      jsonb_build_object(
        'order_id',v_order.id,
        'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120)
      )
    );

    return jsonb_build_object(
      'ok',true,'action','refund','order_code',v_order.order_code,
      'refund_status','refunded','payment_status','refunded'
    );
  end if;

  raise exception using message='عملیات لغو نامعتبر است.';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.azim_telegram_handle_return_request(p_request_id uuid, p_action text, p_actor_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    if v_order.status<>'delivered' and v_order.shipping_status<>'delivered' then
      raise exception using message='مرجوعی فقط برای سفارش تحویل‌شده قابل تأیید است.';
    end if;

    update public.order_return_requests
    set status='approved',
        refund_status=case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
        updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_return_approved','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'refund_status',case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
        'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','approve','order_code',v_order.order_code,
      'status','approved','refund_status',
      case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end);
  end if;

  if v_action='reject' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل رد نیست.'; end if;
    update public.order_return_requests set status='rejected',updated_at=v_now where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_return_rejected','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','reject','order_code',v_order.order_code,'status','rejected');
  end if;

  if v_action='received' then
    if v_req.status<>'approved' then raise exception using message='اول باید درخواست مرجوعی تأیید شده باشد.'; end if;

    update public.order_return_requests
    set status=case when refund_status='pending' then 'received' else 'closed' end,
        updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_return_received','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'refund_status',v_req.refund_status,'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','received','order_code',v_order.order_code,
      'status',case when v_req.refund_status='pending' then 'received' else 'closed' end,
      'refund_status',v_req.refund_status);
  end if;

  if v_action='refund' then
    if v_req.status<>'received' or v_req.refund_status<>'pending'
       or v_order.payment_status not in ('paid','partially_refunded') then
      raise exception using message='این مرجوعی هنوز در وضعیت لازم برای عودت وجه نیست.';
    end if;

    if v_order.payment_method='online' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id
        and status in ('paid','partially_refunded')
      order by created_at desc limit 1
      for update;
      if not found then raise exception using message='تراکنش پرداخت موفق برای این سفارش پیدا نشد.'; end if;

      v_total_refund:=greatest(0,coalesce(v_req.refund_amount,0));

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id
        and status in ('requested','pending','processing')
      order by created_at desc limit 1
      for update;

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
      values('telegram_return_refund_requested','order_return_requests',p_request_id::text,
        jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
          'amount',v_total_refund,'actor_ref',left(coalesce(p_actor_ref,''),120)));

      return jsonb_build_object('ok',true,'action','refund','order_code',v_order.order_code,
        'status','received','refund_status','pending','amount',v_total_refund);
    end if;

    select coalesce(sum(refund_amount),0)::bigint into v_refunded
    from public.order_return_requests
    where order_id=v_order.id and refund_status='refunded' and id<>v_req.id;

    if v_refunded+v_req.refund_amount > v_order.total then
      raise exception using message='مجموع عودت مرجوعی از مبلغ سفارش بیشتر می‌شود.';
    end if;

    perform set_config('azim.payment_transition','offline_refund_verified',true);

    update public.orders
    set payment_status=case when v_refunded+v_req.refund_amount>=v_order.total then 'refunded' else 'partially_refunded' end,
        updated_at=v_now
    where id=v_order.id;

    update public.order_return_requests
    set refund_status='refunded',status='closed',updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_offline_return_refund','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'amount',v_req.refund_amount,'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','refund','order_code',v_order.order_code,
      'status','closed','refund_status','refunded',
      'payment_status',case when v_refunded+v_req.refund_amount>=v_order.total then 'refunded' else 'partially_refunded' end);
  end if;

  raise exception using message='عملیات مرجوعی نامعتبر است.';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.azim_telegram_set_tracking(p_order_code text, p_tracking_code text, p_tracking_url text DEFAULT NULL::text, p_shipping_carrier text DEFAULT NULL::text, p_actor_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception using message='برای اصلاح رهگیری سفارش ارسال‌شده، از پنل مدیریت با تأیید دومرحله‌ای و ثبت دلیل استفاده کنید.';
  end if;
  if v_order.status<>'processing' or v_order.shipping_status<>'packed' then
    raise exception using message='برای ثبت ارسال، سفارش باید در وضعیت «در حال آماده‌سازی» و ارسال در وضعیت «بسته‌بندی شده» باشد.';
  end if;
  if v_order.payment_method='online' and v_order.payment_status<>'paid' then
    raise exception using message='سفارش آنلاین تا تأیید واقعی پرداخت قابل ارسال نیست.';
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
$function$
;

CREATE OR REPLACE FUNCTION public.azim_save_order_with_discount(p_order_id uuid, p_order_code text, p_customer_id uuid, p_status text, p_payment_status text, p_shipping_status text, p_shipping_cost bigint, p_tracking_code text, p_notes text, p_discount_code text, p_items jsonb, p_tracking_url text, p_shipping_carrier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_order_id uuid;
  v_result jsonb;
  v_status text := lower(trim(coalesce(p_status,'pending')));
  v_shipping text := lower(trim(coalesce(p_shipping_status,'pending')));
  v_payment_status text := lower(trim(coalesce(p_payment_status,'unpaid')));
  v_tracking_code text := nullif(trim(coalesce(p_tracking_code,'')),'');
  v_tracking_url text := nullif(trim(coalesce(p_tracking_url,'')),'');
  v_shipping_carrier text := nullif(trim(coalesce(p_shipping_carrier,'')),'');
  v_existing_status text;
  v_existing_shipping text;
  v_existing_payment_status text;
  v_existing_tracking_code text;
  v_existing_tracking_url text;
  v_existing_shipping_carrier text;
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
    select status, shipping_status, payment_status, tracking_code, tracking_url, shipping_carrier
      into v_existing_status, v_existing_shipping, v_existing_payment_status,
           v_existing_tracking_code, v_existing_tracking_url, v_existing_shipping_carrier
    from public.orders where id=p_order_id for update;
    if not found then raise exception using message='سفارش پیدا نشد.'; end if;
    if v_status is distinct from v_existing_status then
      raise exception using message='تغییر مرحله سفارش فقط از طریق عملیات مرحله‌ای سفارش مجاز است.';
    end if;
    if v_shipping is distinct from v_existing_shipping then
      raise exception using message='تغییر مرحله ارسال فقط از طریق عملیات مرحله‌ای سفارش مجاز است.';
    end if;
    if v_payment_status is distinct from v_existing_payment_status then
      raise exception using message='تغییر وضعیت پرداخت فقط از مسیر امن ثبت پرداخت یا تأیید درگاه مجاز است.';
    end if;
    if (v_existing_status in ('shipped','delivered') or v_existing_shipping in ('shipped','delivered'))
       and (v_tracking_code is distinct from v_existing_tracking_code
         or v_tracking_url is distinct from v_existing_tracking_url
         or v_shipping_carrier is distinct from v_existing_shipping_carrier) then
      raise exception using message='اطلاعات مرسوله پس از ارسال/تحویل فقط با عملیات اصلاح رهگیری همراه دلیل قابل تغییر است.';
    end if;
  else
    if v_payment_status <> 'unpaid' then
      raise exception using message='سفارش جدید باید ابتدا با وضعیت پرداخت‌نشده ثبت شود.';
    end if;
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
    if v_status<>'shipped' then raise exception using message='وضعیت «تحویل به شرکت ارسال» باید با وضعیت سفارش «ارسال شده» هماهنگ باشد.'; end if;
    if v_tracking_code is null then raise exception using message='برای ارسال، کد مرسوله اجباری است.'; end if;
    if v_tracking_url is null or v_tracking_url !~* '^https?://[^[:space:]]+$' then raise exception using message='برای ارسال، لینک کامل پیگیری معتبر اجباری است.'; end if;
    if v_shipping_carrier is null then raise exception using message='برای ارسال، نام شرکت ارسال اجباری است.'; end if;
  end if;

  if v_shipping='delivered' then
    if v_status<>'delivered' then raise exception using message='وضعیت «تحویل شده» باید با وضعیت سفارش «تحویل شده» هماهنگ باشد.'; end if;
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
    p_order_id,p_order_code,p_customer_id,v_status,v_payment_status,
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
$function$
;

CREATE OR REPLACE FUNCTION public.azim_admin_restore_cancelled_order(p_order_code text, p_actor_ref text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message='بازگردانی سفارش فقط برای مالک یا مدیر اصلی مجاز است.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای بازگردانی سفارش، تأیید دومرحله‌ای لازم است.';
  end if;
  return private.azim_admin_restore_cancelled_order_core(p_order_code,p_actor_ref);
end;
$function$;

CREATE OR REPLACE FUNCTION public.azim_admin_correct_order_shipment(p_order_id uuid,p_tracking_code text,p_tracking_url text,p_shipping_carrier text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_code text := nullif(trim(coalesce(p_tracking_code,'')),'');
  v_url text := nullif(trim(coalesce(p_tracking_url,'')),'');
  v_carrier text := nullif(trim(coalesce(p_shipping_carrier,'')),'');
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
BEGIN
  IF NOT private.has_azim_role(array['owner','admin']) THEN RAISE EXCEPTION USING message='اصلاح اطلاعات رهگیری فقط برای مالک یا مدیر اصلی مجاز است.'; END IF;
  IF coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' THEN RAISE EXCEPTION USING message='برای اصلاح اطلاعات رهگیری، تأیید دومرحله‌ای لازم است.'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION USING message='شناسه سفارش معتبر نیست.'; END IF;
  IF v_reason IS NULL OR char_length(v_reason)<5 THEN RAISE EXCEPTION USING message='دلیل اصلاح رهگیری باید حداقل ۵ کاراکتر باشد.'; END IF;
  IF v_code IS NULL OR char_length(v_code)>120 THEN RAISE EXCEPTION USING message='کد رهگیری خالی یا نامعتبر است.'; END IF;
  IF v_url IS NULL OR char_length(v_url)>500 OR v_url !~* '^https?://[^[:space:]]+$' THEN RAISE EXCEPTION USING message='لینک پیگیری باید یک نشانی کامل و معتبر http یا https باشد.'; END IF;
  IF v_carrier IS NULL OR char_length(v_carrier)>120 THEN RAISE EXCEPTION USING message='نام شرکت ارسال خالی یا بیش از حد طولانی است.'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING message='سفارش پیدا نشد.'; END IF;
  IF NOT (v_order.status IN ('shipped','delivered') OR v_order.shipping_status IN ('shipped','delivered')) THEN RAISE EXCEPTION USING message='اصلاح اطلاعات رهگیری فقط پس از ثبت ارسال مجاز است.'; END IF;
  PERFORM set_config('azim.order_tracking_transition','shipment_correction',true);
  UPDATE public.orders SET tracking_code=v_code,tracking_url=v_url,shipping_carrier=v_carrier,updated_at=now() WHERE id=v_order.id;
  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,metadata)
  VALUES(auth.uid(),'admin_order_shipment_correction','orders',v_order.id::text,
    jsonb_build_object('order_code',v_order.order_code,'reason',left(v_reason,1000),
      'previous',jsonb_build_object('tracking_code',v_order.tracking_code,'tracking_url',v_order.tracking_url,'shipping_carrier',v_order.shipping_carrier),
      'new',jsonb_build_object('tracking_code',v_code,'tracking_url',v_url,'shipping_carrier',v_carrier)));
  RETURN jsonb_build_object('ok',true,'order_id',v_order.id,'order_code',v_order.order_code,'tracking_code',v_code,'tracking_url',v_url,'shipping_carrier',v_carrier);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.azim_admin_correct_order_shipment(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.azim_admin_correct_order_shipment(uuid,text,text,text,text) TO authenticated;