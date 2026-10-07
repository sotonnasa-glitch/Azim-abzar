create or replace function public.azim_admin_record_manual_payment(
  p_order_id uuid,
  p_reference text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
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
  if p_order_id is null then raise exception using message='شناسه سفارش معتبر نیست.'; end if;
  if v_reference is null or length(v_reference) < 3 then
    raise exception using message='شناسه یا توضیح تأیید پرداخت را وارد کنید.';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception using message='سفارش پیدا نشد.'; end if;
  if v_order.payment_method not in ('phone','message') then
    raise exception using message='این سفارش از مسیر پرداخت دستی قابل تأیید نیست.';
  end if;
  if v_order.status='cancelled' then
    raise exception using message='سفارش لغوشده قابل ثبت پرداخت جدید نیست.';
  end if;
  if v_order.payment_status in ('paid','partially_refunded','refunded') then
    raise exception using message='پرداخت این سفارش قبلاً نهایی شده است.';
  end if;

  update public.orders
  set payment_status='paid',
      payment_reference=v_reference,
      paid_at=now(),
      updated_at=now()
  where id=v_order.id;

  insert into public.audit_logs(actor_id,action,entity,entity_id,metadata)
  values(
    auth.uid(),'admin_manual_payment_recorded','orders',v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'payment_method',v_order.payment_method,
      'payment_status_before',v_order.payment_status,
      'payment_status_after','paid',
      'payment_reference',v_reference
    )
  );

  return jsonb_build_object(
    'ok',true,'order_id',v_order.id,'order_code',v_order.order_code,
    'payment_status','paid','payment_reference',v_reference,'paid_at',now()
  );
end;
$function$;

revoke execute on function public.azim_admin_record_manual_payment(uuid,text) from public;
revoke execute on function public.azim_admin_record_manual_payment(uuid,text) from anon;
grant execute on function public.azim_admin_record_manual_payment(uuid,text) to authenticated;