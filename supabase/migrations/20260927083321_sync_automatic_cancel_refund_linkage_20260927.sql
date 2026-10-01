
begin;

create or replace function private.sync_cancelled_online_order_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tx public.payment_transactions%rowtype;
  v_open public.payment_refunds%rowtype;
  v_request public.order_action_requests%rowtype;
  v_refund jsonb;
  v_refunded bigint:=0;
  v_remaining bigint:=0;
begin
  if new.status<>'cancelled'
     or old.status='cancelled'
     or new.payment_method<>'online'
     or new.payment_status not in ('paid','partially_refunded') then
    return new;
  end if;

  select * into v_tx
  from public.payment_transactions
  where order_id=new.id
    and status in ('paid','partially_refunded')
  order by created_at desc
  limit 1
  for update;

  if not found then
    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'online_cancel_refund_review_required',
      'orders',
      new.id::text,
      jsonb_build_object(
        'order_code',new.order_code,
        'reason','online order cancelled while no successful payment transaction was found'
      )
    );
    return new;
  end if;

  select * into v_open
  from public.payment_refunds
  where transaction_id=v_tx.id
    and status in ('requested','pending','processing')
  order by created_at desc
  limit 1
  for update;

  if found then
    return new;
  end if;

  select coalesce(sum(amount),0)::bigint into v_refunded
  from public.payment_refunds
  where transaction_id=v_tx.id and status='refunded';

  v_remaining:=greatest(0,v_tx.amount-v_refunded);
  if v_remaining<=0 then
    return new;
  end if;

  select * into v_request
  from public.order_action_requests
  where order_id=new.id
    and request_type='cancel'
    and status='approved'
    and refund_status='pending'
  order by created_at desc
  limit 1
  for update;

  v_refund:=public.azim_create_online_refund_request(
    v_tx.id,
    v_remaining,
    case when v_request.id is not null
      then 'عودت وجه لغو سفارش'
      else 'عودت وجه سفارش لغوشده از مسیر مدیریت'
    end,
    'order-cancel-auto:'||new.id::text
  );

  update public.payment_refunds
  set source_type=case when v_request.id is not null then 'cancel' else 'admin' end,
      source_request_id=case when v_request.id is not null then v_request.id else null end,
      updated_at=now()
  where id=(v_refund->>'refund_id')::uuid;

  return new;
exception when unique_violation then
  -- Another path may have created the single allowed open refund concurrently.
  return new;
end;
$function$;

drop trigger if exists orders_auto_online_cancel_refund on public.orders;
create trigger orders_auto_online_cancel_refund
after update of status on public.orders
for each row
execute function private.sync_cancelled_online_order_refund();

create or replace function private.sync_online_refund_source_from_cancel_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_refund public.payment_refunds%rowtype;
begin
  if new.request_type<>'cancel'
     or new.status<>'approved'
     or new.refund_status<>'pending'
     or (old.status='approved' and old.refund_status='pending') then
    return new;
  end if;

  select pr.* into v_refund
  from public.payment_refunds pr
  join public.payment_transactions pt on pt.id=pr.transaction_id
  where pr.order_id=new.order_id
    and pt.order_id=new.order_id
    and pr.status in ('requested','pending','processing')
    and coalesce(pr.source_type,'') in ('admin','system','')
  order by pr.created_at desc
  limit 1
  for update;

  if found then
    update public.payment_refunds
    set source_type='cancel',
        source_request_id=new.id,
        updated_at=now()
    where id=v_refund.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists order_action_requests_refund_source_sync on public.order_action_requests;
create trigger order_action_requests_refund_source_sync
after update of status,refund_status on public.order_action_requests
for each row
execute function private.sync_online_refund_source_from_cancel_request();

create or replace function private.sync_online_refund_source_from_return_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_refund public.payment_refunds%rowtype;
begin
  if new.status<>'received'
     or new.refund_status<>'pending'
     or (old.status='received' and old.refund_status='pending')
     or coalesce(new.refund_amount,0)<=0 then
    return new;
  end if;

  select pr.* into v_refund
  from public.payment_refunds pr
  join public.payment_transactions pt on pt.id=pr.transaction_id
  where pr.order_id=new.order_id
    and pt.order_id=new.order_id
    and pr.status in ('requested','pending','processing')
    and pr.amount=new.refund_amount
    and coalesce(pr.source_type,'') in ('admin','system','')
  order by pr.created_at desc
  limit 1
  for update;

  if found then
    update public.payment_refunds
    set source_type='return',
        source_request_id=new.id,
        updated_at=now()
    where id=v_refund.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists order_return_requests_refund_source_sync on public.order_return_requests;
create trigger order_return_requests_refund_source_sync
after update of status,refund_status on public.order_return_requests
for each row
execute function private.sync_online_refund_source_from_return_request();

revoke all on function private.sync_cancelled_online_order_refund() from public;
revoke all on function private.sync_online_refund_source_from_cancel_request() from public;
revoke all on function private.sync_online_refund_source_from_return_request() from public;

commit;
