-- Admin-panel service request actions.
-- Keep sensitive transitions behind an AAL2 + owner/admin gate and reuse the
-- exact Telegram workflow functions so site/admin/Telegram share one state machine.
begin;

create or replace function public.azim_admin_handle_return_request(
  p_request_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message='این عملیات فقط برای مالک یا مدیر اصلی و نشست MFA تأییدشده مجاز است.';
  end if;

  return public.azim_telegram_handle_return_request(
    p_request_id,
    p_action,
    'admin-panel:'||coalesce(auth.uid()::text,'unknown')
  );
end;
$function$;

revoke all on function public.azim_admin_handle_return_request(uuid,text)
  from public, anon, authenticated;
grant execute on function public.azim_admin_handle_return_request(uuid,text)
  to authenticated;

create or replace function public.azim_admin_handle_cancel_request(
  p_request_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message='این عملیات فقط برای مالک یا مدیر اصلی و نشست MFA تأییدشده مجاز است.';
  end if;

  return public.azim_telegram_handle_cancel_request(
    p_request_id,
    p_action,
    'admin-panel:'||coalesce(auth.uid()::text,'unknown')
  );
end;
$function$;

revoke all on function public.azim_admin_handle_cancel_request(uuid,text)
  from public, anon, authenticated;
grant execute on function public.azim_admin_handle_cancel_request(uuid,text)
  to authenticated;

commit;
