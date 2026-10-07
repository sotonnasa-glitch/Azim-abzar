create or replace function private.guard_paid_order_amount_change()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old.payment_status in ('paid','partially_refunded','refunded')
     and (
       new.subtotal is distinct from old.subtotal
       or new.discount is distinct from old.discount
       or new.shipping_cost is distinct from old.shipping_cost
       or new.total is distinct from old.total
     ) then
    raise exception using message='مبلغ سفارش پس از ثبت پرداخت قابل تغییر نیست؛ ابتدا وضعیت مالی سفارش را تعیین تکلیف کنید.';
  end if;
  return new;
end;
$function$;

drop trigger if exists orders_paid_amount_guard on public.orders;
create trigger orders_paid_amount_guard
before update on public.orders
for each row execute function private.guard_paid_order_amount_change();

revoke execute on function private.guard_paid_order_amount_change() from public, anon, authenticated;