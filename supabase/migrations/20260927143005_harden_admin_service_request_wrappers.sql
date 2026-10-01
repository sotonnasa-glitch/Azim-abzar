begin;
alter function public.azim_admin_handle_return_request(uuid,text) security invoker;
alter function public.azim_admin_handle_cancel_request(uuid,text) security invoker;
commit;