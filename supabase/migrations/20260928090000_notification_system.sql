-- Azim Abzar notification system
-- Project: lzkrwtnylkordkwkdyzp
-- This migration mirrors the live schema installed by the implementation agent.

create table if not exists public.notification_settings (
  id boolean primary key default true check (id),
  sms_enabled boolean not null default false,
  sms_provider text not null default 'kavenegar' check (sms_provider in ('kavenegar')),
  sms_sender text,
  email_enabled boolean not null default false,
  email_provider text not null default 'resend' check (email_provider in ('resend')),
  email_from text,
  events jsonb not null default '{"order_created":true,"payment_paid":true,"payment_failed":true,"order_confirmed":true,"order_processing":false,"order_shipped":true,"order_delivered":true,"order_cancelled":true,"return_requested":true,"return_approved":true,"return_rejected":true,"refund_paid":true}'::jsonb,
  templates jsonb not null default '{"sms":{"order_created":"عظیم ابزار | سفارش {{order_code}} ثبت شد. مبلغ: {{total}} تومان.","payment_paid":"عظیم ابزار | پرداخت سفارش {{order_code}} با موفقیت انجام شد.","payment_failed":"عظیم ابزار | پرداخت سفارش {{order_code}} ناموفق بود. در صورت نیاز دوباره تلاش کنید.","order_confirmed":"عظیم ابزار | سفارش {{order_code}} تأیید شد.","order_processing":"عظیم ابزار | سفارش {{order_code}} در حال پردازش است.","order_shipped":"عظیم ابزار | سفارش {{order_code}} ارسال شد. کد رهگیری: {{tracking_code}}","order_delivered":"عظیم ابزار | سفارش {{order_code}} تحویل شد.","order_cancelled":"عظیم ابزار | سفارش {{order_code}} لغو شد.","return_requested":"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} ثبت شد.","return_approved":"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} تأیید شد.","return_rejected":"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} تأیید نشد.","refund_paid":"عظیم ابزار | مبلغ مرجوعی سفارش {{order_code}} ثبت و برای استرداد آماده شد."},"email":{"order_created":"سفارش {{order_code}} شما در عظیم ابزار ثبت شد. مبلغ سفارش: {{total}} تومان.","payment_paid":"پرداخت سفارش {{order_code}} شما با موفقیت ثبت شد.","payment_failed":"پرداخت سفارش {{order_code}} موفق نشد. در صورت نیاز دوباره تلاش کنید.","order_confirmed":"سفارش {{order_code}} شما در عظیم ابزار تأیید شد.","order_processing":"سفارش {{order_code}} شما در حال پردازش است.","order_shipped":"سفارش {{order_code}} شما ارسال شد. کد رهگیری: {{tracking_code}}.","order_delivered":"سفارش {{order_code}} شما تحویل شد.","order_cancelled":"سفارش {{order_code}} لغو شد.","return_requested":"درخواست مرجوعی سفارش {{order_code}} ثبت شد.","return_approved":"درخواست مرجوعی سفارش {{order_code}} تأیید شد.","return_rejected":"درخواست مرجوعی سفارش {{order_code}} رد شد.","refund_paid":"وضعیت استرداد مبلغ سفارش {{order_code}} به‌روزرسانی شد."}}'::jsonb,
  email_subjects jsonb not null default '{"order_created":"ثبت سفارش {{order_code}} | عظیم ابزار","payment_paid":"پرداخت موفق سفارش {{order_code}} | عظیم ابزار","payment_failed":"پرداخت ناموفق سفارش {{order_code}} | عظیم ابزار","order_confirmed":"تأیید سفارش {{order_code}} | عظیم ابزار","order_processing":"در حال پردازش سفارش {{order_code}} | عظیم ابزار","order_shipped":"ارسال سفارش {{order_code}} | عظیم ابزار","order_delivered":"تحویل سفارش {{order_code}} | عظیم ابزار","order_cancelled":"لغو سفارش {{order_code}} | عظیم ابزار","return_requested":"ثبت درخواست مرجوعی {{order_code}} | عظیم ابزار","return_approved":"تأیید مرجوعی {{order_code}} | عظیم ابزار","return_rejected":"وضعیت مرجوعی {{order_code}} | عظیم ابزار","refund_paid":"وضعیت استرداد {{order_code}} | عظیم ابزار"}'::jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  event text not null,
  channel text not null check (channel in ('sms','email')),
  recipient_masked text,
  provider text,
  status text not null check (status in ('pending','sent','failed','skipped')),
  message text,
  provider_message_id text,
  provider_status text,
  cost bigint,
  error text,
  attempts integer not null default 0,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists notification_logs_dedupe_key_idx on public.notification_logs(dedupe_key);
create index if not exists notification_logs_order_created_idx on public.notification_logs(order_id, created_at desc);
create index if not exists notification_logs_status_created_idx on public.notification_logs(status, created_at desc);
create index if not exists notification_logs_customer_id_idx on public.notification_logs(customer_id);
create index if not exists notification_settings_updated_by_idx on public.notification_settings(updated_by);

alter table public.notification_settings enable row level security;
alter table public.notification_logs enable row level security;

revoke all on table public.notification_settings from public, anon, authenticated;
revoke all on table public.notification_logs from public, anon, authenticated;
grant all on table public.notification_settings to service_role;
grant all on table public.notification_logs to service_role;

create policy notification_settings_no_direct_access on public.notification_settings
for all to public using (false) with check (false);

create policy notification_logs_no_direct_access on public.notification_logs
for all to public using (false) with check (false);

create or replace function public.azim_notification_get_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_name not in ('azim_sms_api_key','azim_resend_api_key','azim_notification_internal_token') then
    raise exception 'SECRET_NAME_NOT_ALLOWED';
  end if;
  return coalesce((select decrypted_secret from vault.decrypted_secrets where name=p_name limit 1),'');
end;
$$;

create or replace function public.azim_notification_set_secret(p_name text, p_value text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_id uuid; v_value text := coalesce(p_value,'');
begin
  if p_name not in ('azim_sms_api_key','azim_resend_api_key') then
    raise exception 'SECRET_NAME_NOT_ALLOWED';
  end if;
  select id into v_id from vault.decrypted_secrets where name=p_name limit 1;
  if v_id is null then
    perform vault.create_secret(v_value,p_name,'Azim Abzar notification provider secret',null);
  else
    perform vault.update_secret(v_id,v_value,p_name,'Azim Abzar notification provider secret',null);
  end if;
end;
$$;

revoke all on function public.azim_notification_get_secret(text) from public, anon, authenticated;
revoke all on function public.azim_notification_set_secret(text,text) from public, anon, authenticated;
grant execute on function public.azim_notification_get_secret(text) to service_role;
grant execute on function public.azim_notification_set_secret(text,text) to service_role;

create or replace function private.azim_notify_order_change()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_token text; v_body jsonb;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name='azim_notification_internal_token' limit 1;
  if coalesce(v_token,'')='' then return coalesce(NEW,OLD); end if;
  v_body:=jsonb_build_object('kind','order','operation',TG_OP,'record',to_jsonb(NEW),'old_record',case when TG_OP='UPDATE' then to_jsonb(OLD) else null end);
  perform net.http_post(url:='https://lzkrwtnylkordkwkdyzp.supabase.co/functions/v1/azim-order-notify',headers:=jsonb_build_object('content-type','application/json','x-azim-internal-token',v_token),body:=v_body,timeout_milliseconds:=5000);
  return coalesce(NEW,OLD);
end $$;

create or replace function private.azim_notify_return_change()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_token text; v_body jsonb;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name='azim_notification_internal_token' limit 1;
  if coalesce(v_token,'')='' then return coalesce(NEW,OLD); end if;
  v_body:=jsonb_build_object('kind','return','operation',TG_OP,'record',to_jsonb(NEW),'old_record',case when TG_OP='UPDATE' then to_jsonb(OLD) else null end);
  perform net.http_post(url:='https://lzkrwtnylkordkwkdyzp.supabase.co/functions/v1/azim-order-notify',headers:=jsonb_build_object('content-type','application/json','x-azim-internal-token',v_token),body:=v_body,timeout_milliseconds:=5000);
  return coalesce(NEW,OLD);
end $$;

drop trigger if exists orders_azim_notification on public.orders;
create trigger orders_azim_notification after insert or update of status,payment_status,shipping_status,tracking_code,tracking_url,shipping_carrier on public.orders for each row execute function private.azim_notify_order_change();

drop trigger if exists order_returns_azim_notification on public.order_return_requests;
create trigger order_returns_azim_notification after insert or update of status,refund_status,refund_amount on public.order_return_requests for each row execute function private.azim_notify_return_change();

insert into public.notification_settings(id) values (true) on conflict (id) do nothing;