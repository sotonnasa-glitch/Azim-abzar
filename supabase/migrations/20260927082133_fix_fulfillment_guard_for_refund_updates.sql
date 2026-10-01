create or replace function private.guard_online_order_fulfillment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- Only block actual fulfillment progression. A later payment/refund update
  -- must not be rejected merely because the order is already delivered.
  if new.payment_method='online'
     and new.payment_status <> 'paid'
     and (
       (old.status is distinct from new.status and new.status in ('processing','shipped','delivered'))
       or
       (old.shipping_status is distinct from new.shipping_status and new.shipping_status in ('packed','shipped','delivered'))
     ) then
    raise exception using message='سفارش آنلاین تا زمانی که پرداخت آن توسط درگاه تأیید نشده قابل پردازش یا ارسال نیست.';
  end if;

  if new.payment_method='online'
     and old.status is distinct from new.status
     and new.status='confirmed'
     and new.payment_status in ('failed','cancelled','review_required') then
    raise exception using message='پرداخت این سفارش قطعی نیست و سفارش قابل تأیید نهایی نیست.';
  end if;

  return new;
end;
$function$;