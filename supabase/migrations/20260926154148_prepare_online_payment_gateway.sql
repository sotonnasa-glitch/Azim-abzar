begin;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  status text not null default 'initiated',
  amount bigint not null check (amount >= 0),
  amount_unit text not null default 'site',
  authority text,
  gateway_reference text,
  gateway_request_id text,
  return_url text,
  callback_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint payment_transactions_status_check
    check (status in ('initiated','pending','paid','failed','cancelled','refunded','partially_refunded'))
);

create index if not exists payment_transactions_order_id_idx
  on public.payment_transactions(order_id);

create index if not exists payment_transactions_lookup_idx
  on public.payment_transactions(provider,status,created_at desc);

alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status = any (array[
    'unpaid'::text,
    'pending'::text,
    'paid'::text,
    'partially_refunded'::text,
    'refunded'::text,
    'failed'::text,
    'cancelled'::text
  ]));

alter table public.payment_transactions enable row level security;

revoke all on table public.payment_transactions from public, anon, authenticated;

create or replace function private.touch_payment_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.touch_payment_transaction() from public, anon, authenticated;

drop trigger if exists payment_transactions_touch on public.payment_transactions;
create trigger payment_transactions_touch
before update on public.payment_transactions
for each row execute function private.touch_payment_transaction();

insert into public.site_content(section_key,title,payload,is_active)
values(
  'checkout_payment',
  'روش‌های پرداخت سفارش',
  jsonb_build_object(
    'provider', null,
    'online_enabled', false,
    'gateway_ready', false,
    'offline_methods', jsonb_build_array('phone','message'),
    'callback_path', 'payment-callback.html',
    'amount_unit', 'site',
    'notes', 'اطلاعات اتصال درگاه پس از دریافت مشخصات درگاه توسط فروشگاه تنظیم می‌شود.'
  ),
  true
)
on conflict (section_key) do update
set payload = public.site_content.payload || jsonb_build_object(
  'gateway_ready', coalesce(public.site_content.payload->>'gateway_ready','false')::boolean,
  'callback_path', coalesce(nullif(public.site_content.payload->>'callback_path',''),'payment-callback.html'),
  'amount_unit', coalesce(nullif(public.site_content.payload->>'amount_unit',''),'site')
),
updated_at = now();

commit;