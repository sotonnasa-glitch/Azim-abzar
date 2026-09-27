-- Make admin service-request wrappers run as invoker.
-- Authorization remains enforced by private.has_azim_role (AAL2 + owner/admin)
-- before delegating to the protected workflow functions.
begin;

alter function public.azim_admin_handle_return_request(uuid,text)
  security invoker;

alter function public.azim_admin_handle_cancel_request(uuid,text)
  security invoker;

commit;
