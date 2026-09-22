-- Azim Abzar order-request hardening (applied to Supabase project lzkrwtnylkordkwkdyzp on 2026-09-22)
-- This is a source-control patch record for the live DB hardening.
-- It adds admin-only RLS, FK indexes, a pending-cancel uniqueness guard,
-- moves SECURITY DEFINER implementations into private schema wrappers,
-- and locks order/order-item rows during customer cancellation/return requests.

begin;

drop policy if exists "Admins manage cancellation requests" on public.order_action_requests;
create policy "Admins manage cancellation requests"
  on public.order_action_requests for all to authenticated
  using (private.is_azim_admin())
  with check (private.is_azim_admin());

drop policy if exists "Admins manage return requests" on public.order_return_requests;
create policy "Admins manage return requests"
  on public.order_return_requests for all to authenticated
  using (private.is_azim_admin())
  with check (private.is_azim_admin());

create index if not exists order_action_requests_handled_by_idx
  on public.order_action_requests(handled_by);
create index if not exists order_return_requests_handled_by_idx
  on public.order_return_requests(handled_by);

create unique index if not exists order_action_requests_pending_cancel_uidx
  on public.order_action_requests(order_id, request_type)
  where request_type='cancel' and status='pending';

-- The implementation bodies are maintained in private schema in the live DB.
-- Public REST RPC names remain as SECURITY INVOKER wrappers:
--   public.azim_request_order_cancel(...)
--   public.azim_request_order_return(...)

commit;
