begin;

-- Reinstall explicitly and verifyably; these triggers are the hard stop against
-- manual paid-state changes and unpaid fulfillment.
drop trigger if exists orders_online_payment_guard on public.orders;
create trigger orders_online_payment_guard
before update on public.orders
for each row execute function private.guard_online_payment_status();

drop trigger if exists orders_online_payment_amount_guard on public.orders;
create trigger orders_online_payment_amount_guard
before update on public.orders
for each row execute function private.guard_online_payment_amounts();

drop trigger if exists orders_online_fulfillment_guard on public.orders;
create trigger orders_online_fulfillment_guard
before update on public.orders
for each row execute function private.guard_online_order_fulfillment();

commit;
