begin;

create or replace function private.azim_admin_cancel_order_core(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_request public.order_action_requests%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
  v_existing uuid;
begin
  if p_order_id is null then
    raise exception using message='شناسه سفارش معتبر نیست.';
  end if;
  if v_reason is null or char_length(v_reason) < 5 then
    raise exception using message='دلیل لغو سفارش باید حداقل ۵ کاراکتر باشد.';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception using message='سفارش پیدا نشد.'; end if;

  if v_order.status in ('cancelled','delivered') or v_order.shipping_status in ('shipped','delivered') then
    raise exception using message='این سفارش دیگر قبل از ارسال قابل لغو نیست.';
  end if;
  if v_order.status not in ('pending','confirmed','processing') then
    raise exception using message='این سفارش فعلاً در مرحله‌ای نیست که از پنل قابل لغو باشد.';
  end if;

  select id into v_existing
  from public.order_action_requests
  where order_id=v_order.id and request_type='cancel' and status='pending'
  order by created_at desc limit 1 for update;

  if v_existing is not null then
    raise exception using message='برای این سفارش یک درخواست لغو در حال بررسی وجود دارد.';
  end if;

  insert into public.order_action_requests(
    order_id,request_type,status,reason,customer_mobile,refund_status
  )
  values(
    v_order.id,'cancel','pending',
    'لغو توسط مدیر: '||left(v_reason,900),
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

revoke all on function private.azim_admin_cancel_order_core(uuid,text) from public, anon, authenticated;
grant execute on function private.azim_admin_cancel_order_core(uuid,text) to authenticated;

create or replace function public.azim_admin_cancel_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message='این عملیات فقط برای مالک یا مدیر اصلی و نشست MFA تأییدشده مجاز است.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای لغو مستقیم سفارش، تأیید دومرحله‌ای لازم است.';
  end if;
  return private.azim_admin_cancel_order_core(p_order_id,p_reason);
end;
$function$;

revoke all on function public.azim_admin_cancel_order(uuid,text) from public, anon;
grant execute on function public.azim_admin_cancel_order(uuid,text) to authenticated;

commit;
