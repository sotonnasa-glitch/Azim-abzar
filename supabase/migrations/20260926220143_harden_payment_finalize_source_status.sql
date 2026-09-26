create or replace function public.azim_finalize_online_payment(
  p_transaction_id uuid,p_provider text,p_gateway_reference text default null,
  p_confirmed_store_amount bigint default null,p_confirmed_store_amount_unit text default null,
  p_provider_status text default null,p_gateway_request_id text default null,
  p_verification_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_tx public.payment_transactions%rowtype; v_order public.orders%rowtype;
  v_now timestamptz:=now(); v_ref text:=nullif(trim(coalesce(p_gateway_reference,'')),'');
  v_unit text:=lower(trim(coalesce(p_confirmed_store_amount_unit,'')));
  v_payload jsonb:=case when jsonb_typeof(coalesce(p_verification_payload,'{}'::jsonb))='object' then coalesce(p_verification_payload,'{}'::jsonb) else '{}'::jsonb end;
begin
  select * into v_tx from public.payment_transactions where id=p_transaction_id for update;
  if not found then raise exception using message='تراکنش پرداخت پیدا نشد.'; end if;
  select * into v_order from public.orders where id=v_tx.order_id for update;
  if not found then raise exception using message='سفارش مرتبط با تراکنش پیدا نشد.'; end if;
  if lower(trim(coalesce(v_tx.provider,''))) <> lower(trim(coalesce(p_provider,''))) then raise exception using message='تراکنش متعلق به این درگاه نیست.'; end if;
  if v_tx.status in ('paid','partially_refunded','refunded') then
    return jsonb_build_object('ok',true,'already_finalized',true,'order_id',v_order.id,'order_code',v_order.order_code,'payment_status',v_order.payment_status,'payment_reference',v_tx.gateway_reference,'transaction_id',v_tx.id);
  end if;
  if v_tx.status='review_required' then
    return jsonb_build_object('ok',false,'review_required',true,'order_code',v_order.order_code,'transaction_id',v_tx.id,'message','این پرداخت قبلاً برای بررسی دستی علامت‌گذاری شده است.');
  end if;
  if v_tx.status not in ('initiated','pending') then
    raise exception using message='فقط تراکنش در انتظار تأیید درگاه می‌تواند به پرداخت‌شده نهایی شود.';
  end if;
  if p_confirmed_store_amount is null or p_confirmed_store_amount <> v_tx.amount
     or lower(trim(coalesce(v_tx.amount_unit,''))) <> v_unit
     or v_order.total <> v_tx.amount or v_order.payment_method <> 'online' then
    update public.payment_transactions
    set status='review_required',provider_status=coalesce(p_provider_status,'amount_mismatch'),
        gateway_reference=coalesce(v_ref,gateway_reference),
        gateway_request_id=coalesce(nullif(trim(coalesce(p_gateway_request_id,'')),''),gateway_request_id),
        verification_payload=v_payload,last_verified_at=v_now,error_code='AMOUNT_OR_ORDER_MISMATCH',
        error_message='مبلغ یا واحد مبلغ تأییدشده با مبلغ سفارش مطابقت ندارد.',updated_at=v_now
    where id=v_tx.id;
    perform private.azim_payment_event(v_order.id,v_tx.id,'review_required',v_tx.status,'review_required','gateway',null,'review:'||v_tx.id::text,
      jsonb_build_object('provider_status',p_provider_status,'confirmed_store_amount',p_confirmed_store_amount,'confirmed_store_amount_unit',v_unit,'transaction_amount',v_tx.amount,'transaction_amount_unit',v_tx.amount_unit,'order_total',v_order.total,'reason','amount_or_order_mismatch'));
    perform private.azim_payment_admin_notice(v_order.id,v_tx.id,'payment_review_required',
      jsonb_build_object('order_code',v_order.order_code,'amount',v_tx.amount,'amount_unit',v_tx.amount_unit,'gateway_reference',v_ref,'reason','amount_or_order_mismatch'));
    return jsonb_build_object('ok',false,'review_required',true,'order_code',v_order.order_code,'transaction_id',v_tx.id,'message','مبلغ پرداخت با سفارش مطابقت نداشت و برای بررسی دستی متوقف شد.');
  end if;
  perform set_config('azim.payment_transition','verified',true);
  update public.payment_transactions set status='paid',gateway_reference=coalesce(v_ref,gateway_reference),
    gateway_request_id=coalesce(nullif(trim(coalesce(p_gateway_request_id,'')),''),gateway_request_id),
    provider_status=coalesce(p_provider_status,'paid'),verification_payload=v_payload,last_verified_at=v_now,
    finalized_at=v_now,paid_at=coalesce(paid_at,v_now),error_code=null,error_message=null,updated_at=v_now
  where id=v_tx.id;
  update public.orders set payment_status='paid',payment_reference=coalesce(v_ref,payment_reference),paid_at=coalesce(paid_at,v_now),updated_at=v_now
  where id=v_order.id;
  perform set_config('azim.payment_transition',coalesce(current_setting('azim.payment_transition',true),''),true);
  return jsonb_build_object('ok',true,'already_finalized',false,'order_id',v_order.id,'order_code',v_order.order_code,'payment_status','paid','payment_reference',coalesce(v_ref,v_tx.gateway_reference),'transaction_id',v_tx.id);
end;
$function$;