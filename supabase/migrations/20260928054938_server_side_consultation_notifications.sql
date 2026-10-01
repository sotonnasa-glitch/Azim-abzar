-- Notify the store's Telegram admins automatically after a public consultation is saved.
-- The browser never receives the internal notification token.
create or replace function private.azim_notify_inquiry_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_token text;
begin
  select decrypted_secret
    into v_token
  from vault.decrypted_secrets
  where name='azim_notification_internal_token'
  limit 1;

  if coalesce(v_token,'') = '' then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://lzkrwtnylkordkwkdyzp.supabase.co/functions/v1/azim-consultation-notify',
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-azim-internal-token',v_token
    ),
    body := jsonb_build_object(
      'kind','inquiry',
      'operation',TG_OP,
      'record',to_jsonb(NEW)
    ),
    timeout_milliseconds := 5000
  );

  return NEW;
end;
$function$;

drop trigger if exists inquiries_azim_notification on public.inquiries;

create trigger inquiries_azim_notification
after insert on public.inquiries
for each row execute function private.azim_notify_inquiry_change();