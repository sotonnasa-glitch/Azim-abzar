begin;
create policy payment_events_service_role_select on public.payment_events
  for select to service_role using (true);
create policy payment_ledger_entries_service_role_select on public.payment_ledger_entries
  for select to service_role using (true);
create policy payment_notification_queue_service_role_select on public.payment_notification_queue
  for select to service_role using (true);
create policy payment_refunds_service_role_select on public.payment_refunds
  for select to service_role using (true);
create policy payment_transactions_service_role_select on public.payment_transactions
  for select to service_role using (true);
commit;