begin;

create or replace function public.azim_admin_request_online_refund(
  p_transaction_id uuid,
  p_amount bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tx public.payment_transactions%rowtype;
  v_key text;
  v_result jsonb;
  v_refund_id text;
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text]) then
    raise exception using message='فقط مالک یا مدیر ارشد می‌تواند درخواست عودت وجه ثبت کند.';
  end if;

  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای درخواست عودت وجه، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_transaction_id
  for update;

  if not found then
    raise exception using message='تراکنش پرداخت پیدا نشد.';
  end if;

  if v_tx.status not in ('paid','partially_refunded') then
    raise exception using message='فقط تراکنش پرداخت‌شده قابل درخواست عودت وجه است.';
  end if;

  v_key := 'admin-panel-refund:' || p_transaction_id::text || ':' ||
           floor(extract(epoch from clock_timestamp())*1000)::bigint::text;

  v_result := public.azim_create_online_refund_request(
    p_transaction_id,
    p_amount,
    p_reason,
    v_key
  );

  v_refund_id := nullif(v_result->>'refund_id','');

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'payment_refund_request',
    'payment_refund',
    v_refund_id,
    jsonb_build_object(
      'transaction_id',p_transaction_id,
      'amount',p_amount,
      'reason',left(nullif(trim(coalesce(p_reason,'')),''),500),
      'order_id',v_tx.order_id
    )
  );

  return v_result;
end;
$function$;

revoke all on function public.azim_admin_request_online_refund(uuid,bigint,text)
  from public,anon;
grant execute on function public.azim_admin_request_online_refund(uuid,bigint,text)
  to authenticated;

commit;