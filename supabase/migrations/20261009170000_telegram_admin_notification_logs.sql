-- Add a dedicated channel for manager-facing Telegram order alerts.
-- SMS and email channel semantics remain unchanged.
alter table public.notification_logs
  drop constraint if exists notification_logs_channel_check;

alter table public.notification_logs
  add constraint notification_logs_channel_check
  check (channel = any (array['sms'::text, 'email'::text, 'telegram_admin'::text]));
