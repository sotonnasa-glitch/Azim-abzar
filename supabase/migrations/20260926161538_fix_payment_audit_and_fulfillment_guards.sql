begin;

-- Make notification claiming/retry safe.
alter table public.payment_notification_queue
  drop constraint if exists payment_notification_queue_status_check;

alter table public.payment_notification_queue
  add constraint payment_notification_queue_status_check
  check (status in ('pending','sending','sent','failed'));

create or replace function private.azim_payment_event(
  p_order_id uuid,
  p_transaction_id uuid,
  p_event_type text,
  p_status_before text,
  p_status_after text,
  p_actor_type text default 'system',
  p_actor_id text default null,
  p_idempotency_key text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.payment_events(
    order_id,transaction_id,event_type,status_before,status_after,
    actor_type,actor_id,idempotency_key,payload
  )
  values(
    p_order_id,p_transaction_id,p_event_type,p_status_before,p_status_after,
    coalesce(p_actor_type,'system'),p_actor_id,p_idempotency_key,coalesce(p_payload,'{}'::jsonb)
  )
  on conflict do nothing;
end;
$function$;

create or replace function private.azim_payment_admin_notice(
  p_order_id uuid,
  p_transaction_id uuid,
  p_event_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.payment_notification_queue(
    transaction_id,order_id,event_type,channel,payload,status,created_at,updated_at
  )
  values(
    p_transaction_id,p_order_id,p_event_type,'telegram',coalesce(p_payload,'{}'::jsonb),'pending',now(),now()
  )
  on conflict do nothing;
end;
$function$;

create or replace function private.guard_online_order_fulfillment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.payment_method='online'
     and new.status in ('processing','shipped','delivered')
     and new.payment_status <> 'paid' then
    raise exception using message='سفارش آنلاین تا زمانی که پرداخت آن توسط درگاه تأیید نشده قابل پردازش یا ارسال نیست.';
  end if;

  if new.payment_method='online'
     and new.status='confirmed'
     and new.payment_status in ('failed','cancelled','review_required') then
    raise exception using message='پرداخت این سفارش قطعی نیست و سفارش قابل تأیید نهایی نیست.';
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_online_fulfillment_guard on public.orders;
create trigger orders_online_fulfillment_guard
before update on public.orders
for each row execute function private.guard_online_order_fulfillment();

commit;
