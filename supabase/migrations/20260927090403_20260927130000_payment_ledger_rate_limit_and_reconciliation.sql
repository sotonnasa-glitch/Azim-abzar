
begin;

create table if not exists public.payment_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  transaction_id uuid null references public.payment_transactions(id) on delete restrict,
  refund_id uuid null references public.payment_refunds(id) on delete restrict,
  event_type text not null,
  status_before text,
  status_after text,
  amount bigint,
  amount_unit text,
  actor_type text not null default 'system',
  actor_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payment_ledger_amount_nonnegative check (amount is null or amount >= 0),
  constraint payment_ledger_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists payment_ledger_idempotency_unique_idx
  on public.payment_ledger_entries(idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create index if not exists payment_ledger_order_created_idx
  on public.payment_ledger_entries(order_id, created_at desc, id desc);

create index if not exists payment_ledger_tx_created_idx
  on public.payment_ledger_entries(transaction_id, created_at desc, id desc)
  where transaction_id is not null;

create index if not exists payment_ledger_refund_created_idx
  on public.payment_ledger_entries(refund_id, created_at desc, id desc)
  where refund_id is not null;

alter table public.payment_ledger_entries enable row level security;

revoke all on public.payment_ledger_entries from anon, authenticated;

create or replace function private.guard_payment_ledger_append_only()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception using message='Payment ledger is append-only; UPDATE/DELETE is forbidden.';
end;
$function$;

drop trigger if exists payment_ledger_no_update_delete on public.payment_ledger_entries;
create trigger payment_ledger_no_update_delete
before update or delete on public.payment_ledger_entries
for each row execute function private.guard_payment_ledger_append_only();

create or replace function private.log_order_created_to_payment_ledger()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  insert into public.payment_ledger_entries(
    order_id,event_type,status_before,status_after,amount,amount_unit,
    actor_type,actor_id,idempotency_key,metadata
  )
  values(
    new.id,'order_created',null,new.payment_status,new.total,'toman',
    'system',null,'order-created:'||new.id::text,
    jsonb_build_object('order_code',new.order_code,'order_status',new.status)
  )
  on conflict do nothing;
  return new;
end;
$function$;

drop trigger if exists orders_payment_ledger_created on public.orders;
create trigger orders_payment_ledger_created
after insert on public.orders
for each row execute function private.log_order_created_to_payment_ledger();

create or replace function private.log_order_cancelled_to_payment_ledger()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old.status is distinct from new.status and new.status='cancelled' then
    insert into public.payment_ledger_entries(
      order_id,event_type,status_before,status_after,amount,amount_unit,
      actor_type,actor_id,idempotency_key,metadata
    )
    values(
      new.id,'order_cancelled',old.payment_status,new.payment_status,new.total,'toman',
      'system',null,
      'order-cancelled:'||new.id::text||':'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'),
      jsonb_build_object('order_code',new.order_code,'order_status_before',old.status,'order_status_after',new.status)
    )
    on conflict do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists orders_payment_ledger_cancelled on public.orders;
create trigger orders_payment_ledger_cancelled
after update of status on public.orders
for each row execute function private.log_order_cancelled_to_payment_ledger();

create or replace function private.log_payment_transaction_to_ledger()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op='INSERT' then
    insert into public.payment_ledger_entries(
      order_id,transaction_id,event_type,status_before,status_after,amount,amount_unit,
      actor_type,actor_id,idempotency_key,metadata
    )
    values(
      new.order_id,new.id,'payment_initiated',null,new.status,new.amount,new.amount_unit,
      'system',null,'payment-initiated:'||new.id::text,
      jsonb_build_object('provider',new.provider)
    )
    on conflict do nothing;
  elsif old.status is distinct from new.status then
    insert into public.payment_ledger_entries(
      order_id,transaction_id,event_type,status_before,status_after,amount,amount_unit,
      actor_type,actor_id,idempotency_key,metadata
    )
    values(
      new.order_id,new.id,'payment_status_changed',old.status,new.status,new.amount,new.amount_unit,
      'system',null,
      'payment-status:'||new.id::text||':'||old.status||':'||new.status||':'||
      to_char(coalesce(new.updated_at,clock_timestamp()),'YYYYMMDDHH24MISSMS'),
      jsonb_build_object(
        'provider',new.provider,
        'provider_status',new.provider_status,
        'error_code',new.error_code
      )
    )
    on conflict do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists payment_transactions_payment_ledger on public.payment_transactions;
create trigger payment_transactions_payment_ledger
after insert or update of status on public.payment_transactions
for each row execute function private.log_payment_transaction_to_ledger();

create or replace function private.log_refund_to_payment_ledger()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_actor_type text := case when new.requested_by='system' then 'system' else 'admin' end;
  v_actor_id text := case when new.requested_by='system' then null else new.requested_by end;
begin
  if tg_op='INSERT' then
    insert into public.payment_ledger_entries(
      order_id,transaction_id,refund_id,event_type,status_before,status_after,amount,amount_unit,
      actor_type,actor_id,idempotency_key,metadata
    )
    values(
      new.order_id,new.transaction_id,new.id,'refund_requested',null,new.status,new.amount,new.amount_unit,
      v_actor_type,v_actor_id,'refund-requested:'||new.id::text,
      jsonb_build_object('source_type',new.source_type,'source_request_id',new.source_request_id,'reason',left(coalesce(new.reason,''),500))
    )
    on conflict do nothing;
  elsif old.status is distinct from new.status then
    insert into public.payment_ledger_entries(
      order_id,transaction_id,refund_id,event_type,status_before,status_after,amount,amount_unit,
      actor_type,actor_id,idempotency_key,metadata
    )
    values(
      new.order_id,new.transaction_id,new.id,'refund_status_changed',old.status,new.status,new.amount,new.amount_unit,
      'system',null,
      'refund-status:'||new.id::text||':'||old.status||':'||new.status||':'||
      to_char(coalesce(new.updated_at,clock_timestamp()),'YYYYMMDDHH24MISSMS'),
      jsonb_build_object('provider_refund_id',new.provider_refund_id,'error_code',new.error_code)
    )
    on conflict do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists payment_refunds_payment_ledger on public.payment_refunds;
create trigger payment_refunds_payment_ledger
after insert or update of status on public.payment_refunds
for each row execute function private.log_refund_to_payment_ledger();

create or replace view public.payment_ledger_current_state
with (security_invoker=true)
as
select distinct on (order_id)
  order_id,
  event_type,
  status_after as ledger_status,
  amount,
  amount_unit,
  created_at
from public.payment_ledger_entries
order by order_id, created_at desc, id desc;

revoke all on public.payment_ledger_current_state from anon, authenticated;

create table if not exists private.payment_rate_limits (
  scope text not null,
  bucket_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(scope,bucket_key),
  constraint payment_rate_limit_count_nonnegative check (request_count >= 0)
);

revoke all on private.payment_rate_limits from public, anon, authenticated;

create or replace function public.azim_consume_payment_rate_limit(
  p_scope text,
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_scope text := left(lower(trim(coalesce(p_scope,''))),40);
  v_key text := left(trim(coalesce(p_bucket_key,'')),128);
  v_limit integer := greatest(1,least(coalesce(p_limit,20),10000));
  v_window integer := greatest(1,least(coalesce(p_window_seconds,600),86400));
  v_row private.payment_rate_limits%rowtype;
  v_now timestamptz := now();
begin
  if v_scope='' or v_key='' then
    raise exception using message='Rate-limit key is required.';
  end if;

  insert into private.payment_rate_limits(scope,bucket_key,window_started_at,request_count,updated_at)
  values(v_scope,v_key,v_now,1,v_now)
  on conflict(scope,bucket_key) do update
  set window_started_at = case
    when extract(epoch from (v_now-private.payment_rate_limits.window_started_at)) >= v_window
      then v_now
    else private.payment_rate_limits.window_started_at
  end,
  request_count = case
    when extract(epoch from (v_now-private.payment_rate_limits.window_started_at)) >= v_window
      then 1
    else private.payment_rate_limits.request_count+1
  end,
  updated_at=v_now
  returning * into v_row;

  return jsonb_build_object(
    'allowed',v_row.request_count <= v_limit,
    'count',v_row.request_count,
    'limit',v_limit,
    'window_seconds',v_window,
    'retry_after_seconds',
      greatest(0,ceil(v_window-extract(epoch from (v_now-v_row.window_started_at))))::integer
  );
end;
$function$;

revoke all on function public.azim_consume_payment_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.azim_consume_payment_rate_limit(text,text,integer,integer) to service_role;

do $function$
begin
  if not exists(select 1 from vault.secrets where name='azim_payment_reconcile_secret') then
    perform vault.create_secret(
      encode(gen_random_bytes(32),'hex'),
      'azim_payment_reconcile_secret',
      'Secret used only by the pg_cron payment reconciliation job.'
    );
  end if;
end;
$function$;

create or replace function public.azim_validate_reconcile_secret(p_presented_secret text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if nullif(trim(coalesce(p_presented_secret,'')),'') is null then
    return false;
  end if;
  return exists(
    select 1
    from vault.decrypted_secrets
    where name='azim_payment_reconcile_secret'
      and decrypted_secret=p_presented_secret
  );
end;
$function$;

revoke all on function public.azim_validate_reconcile_secret(text) from public,anon,authenticated;
grant execute on function public.azim_validate_reconcile_secret(text) to service_role;

create index if not exists payment_notification_queue_order_idx
  on public.payment_notification_queue(order_id,created_at desc);

create index if not exists payment_notification_queue_transaction_idx
  on public.payment_notification_queue(transaction_id,created_at desc)
  where transaction_id is not null;

create extension if not exists pg_cron with schema extensions;

do $function$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='azim-payment-reconcile-every-5m' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'azim-payment-reconcile-every-5m',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := 'https://lzkrwtnylkordkwkdyzp.supabase.co/functions/v1/azim-payment-reconcile',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-azim-reconcile-secret',
            (select decrypted_secret from vault.decrypted_secrets where name='azim_payment_reconcile_secret')
        ),
        body := jsonb_build_object('source','pg_cron','time',now())::jsonb
      ) as request_id;
    $cron$
  );
end;
$function$;

do $function$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='azim-payment-rate-limit-cleanup' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'azim-payment-rate-limit-cleanup',
    '15 3 * * *',
    $cron$
      delete from private.payment_rate_limits
      where window_started_at < now() - interval '2 days';
    $cron$
  );
end;
$function$;

commit;
