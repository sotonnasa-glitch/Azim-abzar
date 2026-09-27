begin;

create or replace function public.azim_finalize_online_payment(
  p_transaction_id uuid,
  p_provider text,
  p_gateway_reference text default null,
  p_confirmed_store_amount bigint default null,
  p_confirmed_store_amount_unit text default null,
  p_provider_status text default null,
  p_gateway_request_id text default null,
  p_verification_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
  v_now timestamptz:=now();
  v_ref text:=nullif(trim(coalesce(p_gateway_reference,'')),'');
  v_unit text:=lower(trim(coalesce(p_confirmed_store_amount_unit,'')));
  v_payload jsonb:=case when jsonb_typeof(coalesce(p_verification_payload,'{}'::jsonb))='object'
    then coalesce(p_verification_payload,'{}'::jsonb) else '{}'::jsonb end;
  v_cancel_request_id uuid;
  v_open_refund_id uuid;
  v_prev_transition text:=coalesce(current_setting('azim.payment_transition',true),'');
begin
  select * into v_tx from public.payment_transactions where id=p_transaction_id for update;
  if not found then raise exception using message='تراکنش پرداخت پیدا نشد.'; end if;
  select * into v_order from public.orders where id=v_tx.order_id for update;
  if not found then raise exception using message='سفارش مرتبط با تراکنش پیدا نشد.'; end if;

  if lower(trim(coalesce(v_tx.provider,''))) <> lower(trim(coalesce(p_provider,''))) then
    raise exception using message='تراکنش متعلق به این درگاه نیست.';
  end if;

  if v_tx.status in ('paid','partially_refunded','refunded') then
    return jsonb_build_object(
      'ok',true,'already_finalized',true,'order_id',v_order.id,'order_code',v_order.order_code,
      'payment_status',v_order.payment_status,'payment_reference',v_tx.gateway_reference,'transaction_id',v_tx.id
    );
  end if;

  if v_tx.status='review_required' then
    return jsonb_build_object(
      'ok',false,'review_required',true,'order_code',v_order.order_code,'transaction_id',v_tx.id,
      'message','این پرداخت قبلاً برای بررسی دستی علامت‌گذاری شده است.'
    );
  end if;

  if v_tx.status not in ('initiated','pending') then
    raise exception using message='فقط تراکنش در انتظار تأیید درگاه می‌تواند به پرداخت‌شده نهایی شود.';
  end if;

  if p_confirmed_store_amount is null
     or p_confirmed_store_amount <> v_tx.amount
     or lower(trim(coalesce(v_tx.amount_unit,''))) <> v_unit
     or v_order.total <> v_tx.amount
     or v_order.payment_method <> 'online' then
    update public.payment_transactions
    set status='review_required',
        provider_status=coalesce(p_provider_status,'amount_mismatch'),
        gateway_reference=coalesce(v_ref,gateway_reference),
        gateway_request_id=coalesce(nullif(trim(coalesce(p_gateway_request_id,'')),''),gateway_request_id),
        verification_payload=v_payload,last_verified_at=v_now,
        error_code='AMOUNT_OR_ORDER_MISMATCH',
        error_message='مبلغ یا واحد مبلغ تأییدشده با مبلغ سفارش مطابقت ندارد.',
        updated_at=v_now
    where id=v_tx.id;

    perform private.azim_payment_event(
      v_order.id,v_tx.id,'review_required',v_tx.status,'review_required','gateway',null,
      'review:'||v_tx.id::text,
      jsonb_build_object('provider_status',p_provider_status,'confirmed_store_amount',p_confirmed_store_amount,
        'confirmed_store_amount_unit',v_unit,'transaction_amount',v_tx.amount,
        'transaction_amount_unit',v_tx.amount_unit,'order_total',v_order.total,'reason','amount_or_order_mismatch')
    );

    perform private.azim_payment_admin_notice(
      v_order.id,v_tx.id,'payment_review_required',
      jsonb_build_object('order_code',v_order.order_code,'amount',v_tx.amount,
        'amount_unit',v_tx.amount_unit,'gateway_reference',v_ref,'reason','amount_or_order_mismatch')
    );

    return jsonb_build_object(
      'ok',false,'review_required',true,'order_code',v_order.order_code,
      'transaction_id',v_tx.id,'message','مبلغ پرداخت با سفارش مطابقت نداشت و برای بررسی دستی متوقف شد.'
    );
  end if;

  perform set_config('azim.payment_transition','verified',true);

  update public.payment_transactions
  set status='paid',
      gateway_reference=coalesce(v_ref,gateway_reference),
      gateway_request_id=coalesce(nullif(trim(coalesce(p_gateway_request_id,'')),''),gateway_request_id),
      provider_status=coalesce(p_provider_status,'paid'),
      verification_payload=v_payload,last_verified_at=v_now,finalized_at=v_now,
      paid_at=coalesce(paid_at,v_now),error_code=null,error_message=null,updated_at=v_now
  where id=v_tx.id;

  update public.orders
  set payment_status='paid',
      payment_reference=coalesce(v_ref,payment_reference),
      paid_at=coalesce(paid_at,v_now),updated_at=v_now
  where id=v_order.id;

  perform set_config('azim.payment_transition',v_prev_transition,true);

  perform private.azim_payment_event(
    v_order.id,v_tx.id,'payment_verified',v_tx.status,'paid','gateway',null,
    'paid:'||v_tx.id::text,
    jsonb_build_object('provider_status',p_provider_status,'gateway_reference',v_ref,
      'gateway_request_id',p_gateway_request_id,'confirmed_store_amount',p_confirmed_store_amount,
      'confirmed_store_amount_unit',v_unit)
  );

  perform private.azim_payment_admin_notice(
    v_order.id,v_tx.id,'payment_paid',
    jsonb_build_object('order_code',v_order.order_code,'amount',v_tx.amount,'amount_unit',v_tx.amount_unit,
      'gateway_reference',coalesce(v_ref,v_tx.gateway_reference),'status','paid')
  );

  if v_order.status='cancelled' then
    select r.id
      into v_cancel_request_id
    from public.order_action_requests r
    where r.order_id=v_order.id
      and r.request_type='cancel'
      and r.status='approved'
      and r.refund_status='not_required'
    order by r.created_at desc
    limit 1
    for update;

    if v_cancel_request_id is not null then
      update public.order_action_requests
      set refund_status='pending', updated_at=v_now
      where id=v_cancel_request_id;
    end if;

    select pr.id
      into v_open_refund_id
    from public.payment_refunds pr
    where pr.transaction_id=v_tx.id
      and pr.status in ('requested','pending','processing')
    order by pr.created_at desc
    limit 1
    for update;

    if v_open_refund_id is null then
      insert into public.payment_refunds(
        order_id,transaction_id,amount,amount_unit,status,reason,requested_by,source_type,source_request_id
      )
      values(
        v_order.id,v_tx.id,v_tx.amount,v_tx.amount_unit,'requested',
        'پرداخت بعد از لغو سفارش دریافت شد؛ عودت وجه باید تعیین تکلیف شود.',
        'system','cancel',v_cancel_request_id
      );
    elsif v_cancel_request_id is not null then
      update public.payment_refunds
      set source_type='cancel',source_request_id=v_cancel_request_id,updated_at=v_now
      where id=v_open_refund_id;
    end if;

    perform private.azim_payment_admin_notice(
      v_order.id,v_tx.id,'payment_paid_after_cancel',
      jsonb_build_object('order_code',v_order.order_code,'amount',v_tx.amount,
        'reason','order_cancelled_before_payment_confirmation')
    );
  end if;

  return jsonb_build_object(
    'ok',true,'already_finalized',false,'order_id',v_order.id,'order_code',v_order.order_code,
    'payment_status','paid','payment_reference',coalesce(v_ref,v_tx.gateway_reference),'transaction_id',v_tx.id
  );
end;
$function$;

create or replace function public.azim_finalize_online_refund(
  p_refund_id uuid,
  p_status text,
  p_provider_refund_id text default null,
  p_confirmed_amount bigint default null,
  p_response_payload jsonb default '{}'::jsonb,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_refund public.payment_refunds%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
  v_now timestamptz:=now();
  v_status text:=lower(trim(coalesce(p_status,'')));
  v_before text;
  v_total_refunded bigint:=0;
  v_prev_transition text:=coalesce(current_setting('azim.payment_transition',true),'');
begin
  if v_status not in ('refunded','failed','review_required','cancelled') then
    raise exception using message='نتیجه عودت وجه نامعتبر است.';
  end if;

  select * into v_refund from public.payment_refunds where id=p_refund_id for update;
  if not found then raise exception using message='درخواست عودت وجه پیدا نشد.'; end if;
  select * into v_tx from public.payment_transactions where id=v_refund.transaction_id for update;
  select * into v_order from public.orders where id=v_refund.order_id for update;

  if v_refund.status='refunded' then
    return jsonb_build_object('ok',true,'already_finalized',true,'refund_id',v_refund.id,'status','refunded');
  end if;

  if v_refund.status not in ('requested','pending','processing','failed','review_required','cancelled') then
    raise exception using message='وضعیت فعلی درخواست عودت وجه نامعتبر است.';
  end if;

  if v_status='refunded' then
    if p_confirmed_amount is null or p_confirmed_amount<>v_refund.amount then
      update public.payment_refunds
      set status='review_required',error_code='REFUND_AMOUNT_MISMATCH',
          error_message='مبلغ عودت تأییدشده با مبلغ درخواست‌شده یکسان نیست.',updated_at=v_now
      where id=v_refund.id;
      return jsonb_build_object('ok',false,'review_required',true,'refund_id',v_refund.id);
    end if;

    select coalesce(sum(amount),0) into v_total_refunded
    from public.payment_refunds
    where transaction_id=v_tx.id and status='refunded' and id<>v_refund.id;

    if v_total_refunded+v_refund.amount>v_tx.amount then
      update public.payment_refunds
      set status='review_required',error_code='REFUND_OVER_LIMIT',
          error_message='مجموع عودت وجه از مبلغ تراکنش بیشتر می‌شود.',updated_at=v_now
      where id=v_refund.id;
      return jsonb_build_object('ok',false,'review_required',true,'refund_id',v_refund.id);
    end if;
  end if;

  v_before:=v_refund.status;

  update public.payment_refunds
  set status=v_status,
      provider_refund_id=coalesce(nullif(trim(coalesce(p_provider_refund_id,'')),''),provider_refund_id),
      response_payload=case when jsonb_typeof(coalesce(p_response_payload,'{}'::jsonb))='object'
        then coalesce(p_response_payload,'{}'::jsonb) else response_payload end,
      error_code=coalesce(nullif(trim(coalesce(p_error_code,'')),''),error_code),
      error_message=coalesce(nullif(trim(coalesce(p_error_message,'')),''),error_message),
      refunded_at=case when v_status='refunded' then coalesce(refunded_at,v_now) else refunded_at end,
      updated_at=v_now
  where id=v_refund.id;

  if v_status='refunded' then
    select coalesce(sum(amount),0) into v_total_refunded
    from public.payment_refunds where transaction_id=v_tx.id and status='refunded';

    perform set_config('azim.payment_transition','refund_verified',true);

    update public.payment_transactions
    set status=case when v_total_refunded>=v_tx.amount then 'refunded' else 'partially_refunded' end,
        updated_at=v_now
    where id=v_tx.id;

    update public.orders
    set payment_status=case when v_total_refunded>=v_tx.amount then 'refunded' else 'partially_refunded' end,
        updated_at=v_now
    where id=v_order.id;

    perform set_config('azim.payment_transition',v_prev_transition,true);
  end if;

  perform private.azim_payment_event(
    v_order.id,v_tx.id,'refund_'||v_status,v_before,v_status,'gateway',null,
    'refund-final:'||v_refund.id::text||':'||v_status,
    jsonb_build_object('refund_id',v_refund.id,'amount',v_refund.amount,
      'provider_refund_id',p_provider_refund_id,'confirmed_amount',p_confirmed_amount)
  );

  if v_status in ('review_required','failed') then
    perform private.azim_payment_admin_notice(
      v_order.id,v_tx.id,
      case when v_status='review_required' then 'refund_review_required' else 'refund_failed' end,
      jsonb_build_object('order_code',v_order.order_code,'refund_id',v_refund.id,
        'amount',v_refund.amount,'status',v_status,'error_code',p_error_code,
        'error_message',left(coalesce(p_error_message,''),500))
    );
  end if;

  return jsonb_build_object('ok',true,'already_finalized',false,'refund_id',v_refund.id,
    'status',v_status,'order_code',v_order.order_code);
end;
$function$;

revoke all on function public.azim_finalize_online_payment(
  uuid,text,text,bigint,text,text,text,jsonb
) from public,anon,authenticated;
grant execute on function public.azim_finalize_online_payment(
  uuid,text,text,bigint,text,text,text,jsonb
) to service_role;

commit;