begin;

-- Money is represented by the store in تومان. Gateway adapters may convert to
-- another provider unit (for example ریال) but the verified amount must be
-- converted back to this canonical store unit before settlement.

alter table public.payment_transactions
  add column if not exists provider_status text,
  add column if not exists verification_payload jsonb not null default '{}'::jsonb,
  add column if not exists last_verified_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists client_ip inet,
  add column if not exists idempotency_key text;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_status_check;

alter table public.payment_transactions
  add constraint payment_transactions_status_check
  check (status in (
    'initiated','pending','paid','failed','cancelled',
    'refunded','partially_refunded','review_required'
  ));

create unique index if not exists payment_transactions_one_open_per_order_provider_idx
  on public.payment_transactions(order_id, provider)
  where status in ('initiated','pending');

create unique index if not exists payment_transactions_one_terminal_success_per_order_idx
  on public.payment_transactions(order_id)
  where status in ('paid','partially_refunded','refunded');

create unique index if not exists payment_transactions_provider_reference_unique_idx
  on public.payment_transactions(provider, gateway_reference)
  where gateway_reference is not null and gateway_reference <> '';

create unique index if not exists payment_transactions_provider_request_unique_idx
  on public.payment_transactions(provider, gateway_request_id)
  where gateway_request_id is not null and gateway_request_id <> '';

create unique index if not exists payment_transactions_idempotency_unique_idx
  on public.payment_transactions(idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  transaction_id uuid references public.payment_transactions(id) on delete restrict,
  event_type text not null,
  status_before text,
  status_after text,
  actor_type text not null default 'system'
    check (actor_type in ('system','customer','gateway','admin','cron')),
  actor_id text,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_events_order_idx
  on public.payment_events(order_id, created_at desc);

create index if not exists payment_events_tx_idx
  on public.payment_events(transaction_id, created_at desc);

create unique index if not exists payment_events_idempotency_unique_idx
  on public.payment_events(idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  amount bigint not null check (amount > 0),
  amount_unit text not null default 'toman',
  status text not null default 'requested'
    check (status in ('requested','pending','processing','refunded','failed','cancelled','review_required')),
  reason text,
  provider_refund_id text,
  idempotency_key text,
  response_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  requested_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  refunded_at timestamptz
);

create index if not exists payment_refunds_order_idx
  on public.payment_refunds(order_id, created_at desc);

create index if not exists payment_refunds_tx_idx
  on public.payment_refunds(transaction_id, created_at desc);

create unique index if not exists payment_refunds_provider_refund_unique_idx
  on public.payment_refunds(provider_refund_id)
  where provider_refund_id is not null and provider_refund_id <> '';

create unique index if not exists payment_refunds_idempotency_unique_idx
  on public.payment_refunds(idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create unique index if not exists payment_refunds_one_open_per_tx_idx
  on public.payment_refunds(transaction_id)
  where status in ('requested','pending','processing');

create table if not exists public.payment_notification_queue (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.payment_transactions(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null,
  channel text not null default 'telegram',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_notification_queue_pending_idx
  on public.payment_notification_queue(status, created_at);

create unique index if not exists payment_notification_queue_event_unique_idx
  on public.payment_notification_queue(
    coalesce(transaction_id, order_id),
    event_type,
    channel
  );

alter table public.payment_events enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_notification_queue enable row level security;

revoke all on table public.payment_events from public, anon, authenticated;
revoke all on table public.payment_refunds from public, anon, authenticated;
revoke all on table public.payment_notification_queue from public, anon, authenticated;

create or replace function private.guard_online_payment_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  transition text := current_setting('azim.payment_transition', true);
begin
  if old.payment_method = 'online'
     and new.payment_method is distinct from old.payment_method
     and old.payment_status in ('paid','partially_refunded','refunded') then
    raise exception using message='روش پرداخت سفارش آنلاین پس از دریافت وجه قابل تغییر نیست.';
  end if;

  if new.payment_method = 'online' then
    if new.payment_status in ('paid','partially_refunded','refunded')
       and old.payment_status is distinct from new.payment_status
       and transition not in ('verified','refund_verified') then
      raise exception using message='پرداخت آنلاین فقط پس از تأیید واقعی درگاه قابل نهایی‌سازی است.';
    end if;

    if old.payment_status in ('paid','partially_refunded','refunded')
       and new.payment_status not in ('paid','partially_refunded','refunded')
       and transition <> 'refund_verified' then
      raise exception using message='وضعیت پرداخت آنلاین نهایی‌شده قابل برگشت دستی نیست.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_online_payment_guard on public.orders;
create trigger orders_online_payment_guard
before update on public.orders
for each row execute function private.guard_online_payment_status();

create or replace function private.guard_online_payment_amounts()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.payment_method='online'
     and (new.subtotal is distinct from old.subtotal
       or new.discount is distinct from old.discount
       or new.shipping_cost is distinct from old.shipping_cost
       or new.total is distinct from old.total)
     and exists (
       select 1
       from public.payment_transactions pt
       where pt.order_id=old.id
         and pt.status in (
           'initiated','pending','paid','partially_refunded','refunded','review_required'
         )
     ) then
    raise exception using message='مبلغ سفارش آنلاین پس از ایجاد تراکنش قابل تغییر نیست؛ ابتدا وضعیت پرداخت را تعیین تکلیف کنید.';
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_online_payment_amount_guard on public.orders;
create trigger orders_online_payment_amount_guard
before update on public.orders
for each row execute function private.guard_online_payment_amounts();

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
  on conflict (idempotency_key) do nothing;
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
  on conflict (coalesce(transaction_id,order_id),event_type,channel) do nothing;
end;
$function$;

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
  v_now timestamptz := now();
  v_ref text := nullif(trim(coalesce(p_gateway_reference,'')),'');
  v_unit text := lower(trim(coalesce(p_confirmed_store_amount_unit,'')));
  v_payload jsonb := case when jsonb_typeof(coalesce(p_verification_payload,'{}'::jsonb))='object'
                          then coalesce(p_verification_payload,'{}'::jsonb)
                          else '{}'::jsonb end;
begin
  select * into v_tx
  from public.payment_transactions
  where id=p_transaction_id
  for update;

  if not found then
    raise exception using message='تراکنش پرداخت پیدا نشد.';
  end if;

  select * into v_order
  from public.orders
  where id=v_tx.order_id
  for update;

  if not found then
    raise exception using message='سفارش مرتبط با تراکنش پیدا نشد.';
  end if;

  if lower(trim(coalesce(v_tx.provider,''))) <> lower(trim(coalesce(p_provider,''))) then
    raise exception using message='تراکنش متعلق به این درگاه نیست.';
  end if;

  if v_tx.status in ('paid','partially_refunded','refunded') then
    return jsonb_build_object(
      'ok',true,
      'already_finalized',true,
      'order_id',v_order.id,
      'order_code',v_order.order_code,
      'payment_status',v_order.payment_status,
      'payment_reference',v_tx.gateway_reference,
      'transaction_id',v_tx.id
    );
  end if;

  if v_tx.status='review_required' then
    return jsonb_build_object(
      'ok',false,
      'review_required',true,
      'order_code',v_order.order_code,
      'transaction_id',v_tx.id,
      'message','این پرداخت قبلاً برای بررسی دستی علامت‌گذاری شده است.'
    );
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
        verification_payload=v_payload,
        last_verified_at=v_now,
        error_code='AMOUNT_OR_ORDER_MISMATCH',
        error_message='مبلغ یا واحد مبلغ تأییدشده با مبلغ سفارش مطابقت ندارد.',
        updated_at=v_now
    where id=v_tx.id;

    perform private.azim_payment_event(
      v_order.id,v_tx.id,'review_required',v_tx.status,'review_required',
      'gateway',null,'review:'||v_tx.id::text||':'||to_char(v_now,'YYYYMMDDHH24MISSMS'),
      jsonb_build_object(
        'provider_status',p_provider_status,
        'confirmed_store_amount',p_confirmed_store_amount,
        'confirmed_store_amount_unit',v_unit,
        'transaction_amount',v_tx.amount,
        'transaction_amount_unit',v_tx.amount_unit,
        'order_total',v_order.total,
        'reason','amount_or_order_mismatch'
      )
    );

    perform private.azim_payment_admin_notice(
      v_order.id,v_tx.id,'payment_review_required',
      jsonb_build_object(
        'order_code',v_order.order_code,
        'amount',v_tx.amount,
        'amount_unit',v_tx.amount_unit,
        'gateway_reference',v_ref,
        'reason','amount_or_order_mismatch'
      )
    );

    return jsonb_build_object(
      'ok',false,
      'review_required',true,
      'order_code',v_order.order_code,
      'transaction_id',v_tx.id,
      'message','مبلغ پرداخت با سفارش مطابقت نداشت و برای بررسی دستی متوقف شد.'
    );
  end if;

  perform set_config('azim.payment_transition','verified',true);

  update public.payment_transactions
  set status='paid',
      gateway_reference=coalesce(v_ref,gateway_reference),
      gateway_request_id=coalesce(nullif(trim(coalesce(p_gateway_request_id,'')),''),gateway_request_id),
      provider_status=coalesce(p_provider_status,'paid'),
      verification_payload=v_payload,
      last_verified_at=v_now,
      finalized_at=v_now,
      paid_at=coalesce(paid_at,v_now),
      error_code=null,
      error_message=null,
      updated_at=v_now
  where id=v_tx.id;

  update public.orders
  set payment_status='paid',
      payment_reference=coalesce(v_ref,payment_reference),
      paid_at=coalesce(paid_at,v_now),
      updated_at=v_now
  where id=v_order.id;

  perform private.azim_payment_event(
    v_order.id,v_tx.id,'payment_verified',v_tx.status,'paid',
    'gateway',null,'paid:'||v_tx.id::text,
    jsonb_build_object(
      'provider_status',p_provider_status,
      'gateway_reference',v_ref,
      'gateway_request_id',p_gateway_request_id,
      'confirmed_store_amount',p_confirmed_store_amount,
      'confirmed_store_amount_unit',v_unit
    )
  );

  perform private.azim_payment_admin_notice(
    v_order.id,v_tx.id,'payment_paid',
    jsonb_build_object(
      'order_code',v_order.order_code,
      'amount',v_tx.amount,
      'amount_unit',v_tx.amount_unit,
      'gateway_reference',coalesce(v_ref,v_tx.gateway_reference),
      'status','paid'
    )
  );

  if v_order.status='cancelled' then
    insert into public.payment_refunds(
      order_id,transaction_id,amount,amount_unit,status,reason,requested_by
    )
    values(
      v_order.id,v_tx.id,v_tx.amount,v_tx.amount_unit,'requested',
      'پرداخت بعد از لغو سفارش دریافت شد؛ عودت وجه باید تعیین تکلیف شود.','system'
    )
    on conflict (transaction_id) where status in ('requested','pending','processing') do nothing;

    perform private.azim_payment_admin_notice(
      v_order.id,v_tx.id,'payment_paid_after_cancel',
      jsonb_build_object(
        'order_code',v_order.order_code,
        'amount',v_tx.amount,
        'reason','order_cancelled_before_payment_confirmation'
      )
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'already_finalized',false,
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'payment_status','paid',
    'payment_reference',coalesce(v_ref,v_tx.gateway_reference),
    'transaction_id',v_tx.id
  );
end;
$function$;

revoke all on function public.azim_finalize_online_payment(
  uuid,text,text,bigint,text,text,text,jsonb
) from public,anon,authenticated;

grant execute on function public.azim_finalize_online_payment(
  uuid,text,text,bigint,text,text,text,jsonb
) to service_role;

create or replace function public.azim_mark_online_payment_terminal(
  p_transaction_id uuid,
  p_status text,
  p_provider_status text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_gateway_reference text default null,
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
  v_now timestamptz := now();
  v_status text := lower(trim(coalesce(p_status,'')));
  v_event_key text;
begin
  if v_status not in ('failed','cancelled','review_required') then
    raise exception using message='وضعیت پایانی پرداخت نامعتبر است.';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_transaction_id
  for update;

  if not found then
    raise exception using message='تراکنش پرداخت پیدا نشد.';
  end if;

  select * into v_order
  from public.orders
  where id=v_tx.order_id
  for update;

  if not found then
    raise exception using message='سفارش مرتبط با تراکنش پیدا نشد.';
  end if;

  if v_tx.status in ('paid','partially_refunded','refunded') then
    return jsonb_build_object(
      'ok',true,
      'already_paid',true,
      'order_code',v_order.order_code,
      'payment_status',v_order.payment_status,
      'transaction_id',v_tx.id
    );
  end if;

  if v_tx.status=v_status then
    return jsonb_build_object(
      'ok',true,
      'already_terminal',true,
      'order_code',v_order.order_code,
      'payment_status',v_order.payment_status,
      'transaction_id',v_tx.id
    );
  end if;

  v_event_key := v_status||':'||v_tx.id::text||':'||to_char(v_now,'YYYYMMDDHH24MISSMS');

  update public.payment_transactions
  set status=v_status,
      provider_status=coalesce(p_provider_status,provider_status),
      gateway_reference=coalesce(nullif(trim(coalesce(p_gateway_reference,'')),''),gateway_reference),
      gateway_request_id=coalesce(nullif(trim(coalesce(p_gateway_request_id,'')),''),gateway_request_id),
      verification_payload=case when jsonb_typeof(coalesce(p_verification_payload,'{}'::jsonb))='object'
                                then coalesce(p_verification_payload,'{}'::jsonb) else verification_payload end,
      last_verified_at=v_now,
      error_code=coalesce(nullif(trim(coalesce(p_error_code,'')),''),error_code),
      error_message=coalesce(nullif(trim(coalesce(p_error_message,'')),''),error_message),
      updated_at=v_now
  where id=v_tx.id;

  if v_order.payment_method='online'
     and v_order.payment_status not in ('paid','partially_refunded','refunded') then
    perform set_config('azim.payment_transition','verified',true);
    update public.orders
    set payment_status=v_status,
        updated_at=v_now
    where id=v_order.id;
  end if;

  perform private.azim_payment_event(
    v_order.id,v_tx.id,'payment_'||v_status,v_tx.status,v_status,
    'gateway',null,v_event_key,
    jsonb_build_object('provider_status',p_provider_status,'error_code',p_error_code)
  );

  if v_status in ('review_required','failed') then
    perform private.azim_payment_admin_notice(
      v_order.id,v_tx.id,
      case when v_status='review_required' then 'payment_review_required' else 'payment_failed' end,
      jsonb_build_object(
        'order_code',v_order.order_code,
        'amount',v_tx.amount,
        'amount_unit',v_tx.amount_unit,
        'gateway_reference',coalesce(p_gateway_reference,v_tx.gateway_reference),
        'status',v_status,
        'error_code',p_error_code,
        'error_message',left(coalesce(p_error_message,''),500)
      )
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'order_code',v_order.order_code,
    'payment_status',v_status,
    'transaction_id',v_tx.id
  );
end;
$function$;

revoke all on function public.azim_mark_online_payment_terminal(
  uuid,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;

grant execute on function public.azim_mark_online_payment_terminal(
  uuid,text,text,text,text,text,text,jsonb
) to service_role;

create or replace function public.azim_create_online_refund_request(
  p_transaction_id uuid,
  p_amount bigint,
  p_reason text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
  v_refund public.payment_refunds%rowtype;
  v_already bigint := 0;
  v_remaining bigint := 0;
  v_idempotency text := nullif(trim(coalesce(p_idempotency_key,'')),'');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception using message='مبلغ عودت وجه نامعتبر است.';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_transaction_id
  for update;

  if not found then raise exception using message='تراکنش پرداخت پیدا نشد.'; end if;

  select * into v_order
  from public.orders
  where id=v_tx.order_id
  for update;

  if v_order.payment_method <> 'online'
     or v_tx.status not in ('paid','partially_refunded') then
    raise exception using message='این تراکنش در وضعیت لازم برای درخواست عودت وجه نیست.';
  end if;

  if v_idempotency is not null then
    select * into v_refund from public.payment_refunds
    where idempotency_key=v_idempotency
    limit 1;
    if found then
      return jsonb_build_object(
        'ok',true,'already_requested',true,'refund_id',v_refund.id,
        'status',v_refund.status,'amount',v_refund.amount
      );
    end if;
  end if;

  select coalesce(sum(amount),0) into v_already
  from public.payment_refunds
  where transaction_id=v_tx.id and status='refunded';

  v_remaining := v_tx.amount - v_already;
  if p_amount > v_remaining then
    raise exception using message='مبلغ عودت وجه از مانده قابل استرداد بیشتر است.';
  end if;

  insert into public.payment_refunds(
    order_id,transaction_id,amount,amount_unit,status,reason,idempotency_key,requested_by
  )
  values(
    v_order.id,v_tx.id,p_amount,v_tx.amount_unit,'requested',left(nullif(trim(coalesce(p_reason,'')),''),500),v_idempotency,'admin'
  )
  returning * into v_refund;

  perform private.azim_payment_event(
    v_order.id,v_tx.id,'refund_requested',v_tx.status,v_tx.status,
    'admin',null,'refund-request:'||v_refund.id::text,
    jsonb_build_object('refund_id',v_refund.id,'amount',p_amount)
  );

  perform private.azim_payment_admin_notice(
    v_order.id,v_tx.id,'refund_requested',
    jsonb_build_object(
      'order_code',v_order.order_code,
      'amount',p_amount,
      'amount_unit',v_tx.amount_unit,
      'refund_id',v_refund.id,
      'status','requested'
    )
  );

  return jsonb_build_object(
    'ok',true,'already_requested',false,
    'refund_id',v_refund.id,'status',v_refund.status,
    'amount',v_refund.amount
  );
end;
$function$;

revoke all on function public.azim_create_online_refund_request(uuid,bigint,text,text)
  from public,anon,authenticated;

grant execute on function public.azim_create_online_refund_request(uuid,bigint,text,text)
  to service_role;

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
  v_now timestamptz := now();
  v_status text := lower(trim(coalesce(p_status,'')));
  v_before text;
  v_total_refunded bigint := 0;
begin
  if v_status not in ('refunded','failed','review_required','cancelled') then
    raise exception using message='نتیجه عودت وجه نامعتبر است.';
  end if;

  select * into v_refund
  from public.payment_refunds
  where id=p_refund_id
  for update;
  if not found then raise exception using message='درخواست عودت وجه پیدا نشد.'; end if;

  select * into v_tx from public.payment_transactions
  where id=v_refund.transaction_id
  for update;

  select * into v_order from public.orders
  where id=v_refund.order_id
  for update;

  if v_refund.status='refunded' then
    return jsonb_build_object('ok',true,'already_finalized',true,'refund_id',v_refund.id,'status','refunded');
  end if;

  if v_status='refunded' then
    if p_confirmed_amount is null or p_confirmed_amount <> v_refund.amount then
      update public.payment_refunds
      set status='review_required',
          error_code='REFUND_AMOUNT_MISMATCH',
          error_message='مبلغ عودت تأییدشده با مبلغ درخواست‌شده یکسان نیست.',
          updated_at=v_now
      where id=v_refund.id;

      return jsonb_build_object('ok',false,'review_required',true,'refund_id',v_refund.id);
    end if;

    select coalesce(sum(amount),0) into v_total_refunded
    from public.payment_refunds
    where transaction_id=v_tx.id and status='refunded' and id<>v_refund.id;

    if v_total_refunded + v_refund.amount > v_tx.amount then
      update public.payment_refunds
      set status='review_required',
          error_code='REFUND_OVER_LIMIT',
          error_message='مجموع عودت وجه از مبلغ تراکنش بیشتر می‌شود.',
          updated_at=v_now
      where id=v_refund.id;

      return jsonb_build_object('ok',false,'review_required',true,'refund_id',v_refund.id);
    end if;
  end if;

  v_before := v_refund.status;

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
    from public.payment_refunds
    where transaction_id=v_tx.id and status='refunded';

    perform set_config('azim.payment_transition','refund_verified',true);

    update public.payment_transactions
    set status=case when v_total_refunded >= v_tx.amount then 'refunded' else 'partially_refunded' end,
        updated_at=v_now
    where id=v_tx.id;

    update public.orders
    set payment_status=case when v_total_refunded >= v_tx.amount then 'refunded' else 'partially_refunded' end,
        updated_at=v_now
    where id=v_order.id;
  end if;

  perform private.azim_payment_event(
    v_order.id,v_tx.id,'refund_'||v_status,v_before,v_status,
    'gateway',null,'refund-final:'||v_refund.id::text||':'||v_status,
    jsonb_build_object(
      'refund_id',v_refund.id,
      'amount',v_refund.amount,
      'provider_refund_id',p_provider_refund_id,
      'confirmed_amount',p_confirmed_amount
    )
  );

  if v_status in ('review_required','failed') then
    perform private.azim_payment_admin_notice(
      v_order.id,v_tx.id,
      case when v_status='review_required' then 'refund_review_required' else 'refund_failed' end,
      jsonb_build_object(
        'order_code',v_order.order_code,
        'refund_id',v_refund.id,
        'amount',v_refund.amount,
        'status',v_status,
        'error_code',p_error_code,
        'error_message',left(coalesce(p_error_message,''),500)
      )
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'already_finalized',false,
    'refund_id',v_refund.id,
    'status',v_status,
    'order_code',v_order.order_code
  );
end;
$function$;

revoke all on function public.azim_finalize_online_refund(
  uuid,text,text,bigint,jsonb,text,text
) from public,anon,authenticated;

grant execute on function public.azim_finalize_online_refund(
  uuid,text,text,bigint,jsonb,text,text
) to service_role;

-- Canonical checkout payment settings: the site displays تومان; the provider
-- adapter is responsible for any gateway-specific conversion.
update public.site_content
set payload = payload
  || jsonb_build_object(
       'store_amount_unit','toman',
       'currency_code','IRR',
       'payment_integrity_version',2
     ),
    updated_at=now()
where section_key='checkout_payment';

commit;
