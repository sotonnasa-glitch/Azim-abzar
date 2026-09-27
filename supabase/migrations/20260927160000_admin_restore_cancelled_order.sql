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