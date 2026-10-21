begin;

-- Admin request wrappers need SECURITY DEFINER to call the protected request workflow,
-- so enforce both the expected admin role and an MFA-authenticated (AAL2) session here.
-- This guards direct RPC calls even when client-side navigation is bypassed.
create or replace function public.azim_admin_handle_cancel_request(
  p_request_id uuid,
  p_action text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message='این عملیات فقط برای مالک یا مدیر اصلی مجاز است.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای مدیریت درخواست لغو، تأیید دومرحله‌ای لازم است.';
  end if;
  return public.azim_telegram_handle_cancel_request(
    p_request_id,
    p_action,
    'admin-panel:'||coalesce(auth.uid()::text,'unknown')
  );
end;
$function$;

create or replace function public.azim_admin_handle_return_request(
  p_request_id uuid,
  p_action text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message='این عملیات فقط برای مالک یا مدیر اصلی مجاز است.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای مدیریت درخواست مرجوعی، تأیید دومرحله‌ای لازم است.';
  end if;
  return public.azim_telegram_handle_return_request(
    p_request_id,
    p_action,
    'admin-panel:'||coalesce(auth.uid()::text,'unknown')
  );
end;
$function$;

revoke all on function public.azim_admin_handle_cancel_request(uuid,text) from public, anon, authenticated;
grant execute on function public.azim_admin_handle_cancel_request(uuid,text) to authenticated;
revoke all on function public.azim_admin_handle_return_request(uuid,text) from public, anon, authenticated;
grant execute on function public.azim_admin_handle_return_request(uuid,text) to authenticated;

commit;
