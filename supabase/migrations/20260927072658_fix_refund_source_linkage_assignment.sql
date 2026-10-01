begin;

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
  v_source_type text;
  v_source_request_id uuid;
  v_prev_transition text:=coalesce(current_setting('azim.payment_transition',true),'');
begin
  if v_status not in ('pending','refunded','failed','review_required','cancelled') then
    raise exception using message='نتیجه عودت وجه نامعتبر است.';
  end if;

  select * into v_refund from public.payment_refunds where id=p_refund_id for update;
  if not found then raise exception using message='درخواست عودت وجه پیدا نشد.'; end if;
  select * into v_tx from public.payment_transactions where id=v_refund.transaction_id for update;
  select * into v_order from public.orders where id=v_refund.order_id for update;

  if v_refund.status='refunded' then
    return jsonb_build_object('ok',true,'already_finalized',true,'refund_id',v_refund.id,'status','refunded');
  end if;

  v_source_type := nullif(trim(coalesce(v_refund.source_type,'')),'');
  v_source_request_id := v_refund.source_request_id;

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

    if v_source_type='cancel' and v_source_request_id is not null then
      update public.order_action_requests
      set refund_status='refunded', updated_at=v_now
      where id=v_source_request_id
        and order_id=v_order.id
        and request_type='cancel';
    elsif v_source_type='return' and v_source_request_id is not null then
      update public.order_return_requests
      set refund_status='refunded', status='closed', updated_at=v_now
      where id=v_source_request_id
        and order_id=v_order.id;
    end if;
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

revoke all on function public.azim_finalize_online_refund(
  uuid,text,text,bigint,jsonb,text,text
) from public,anon,authenticated;
grant execute on function public.azim_finalize_online_refund(
  uuid,text,text,bigint,jsonb,text,text
) to service_role;

commit;