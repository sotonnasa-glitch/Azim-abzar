# وضعیت ماشین پرداخت «عظیم ابزار»

این سند قرارداد عملیاتی هسته پرداخت است. مبلغ و وضعیت مالی از کلاینت پذیرفته نمی‌شود؛ سفارش و تراکنش در دیتابیس منبع مبلغ هستند و نهایی‌سازی مالی فقط توسط سرویس سرور انجام می‌شود.

## ماشین وضعیت سفارش

| وضعیت | انتقال | شرط |
|---|---|---|
| unpaid | → pending | انتخاب پرداخت آنلاین از مسیر امن checkout |
| pending | → paid | Verify موفق سمت سرور + تطابق مبلغ تأییدشده provider با مبلغ ثبت‌شده سفارش و تراکنش |
| pending | → failed | فقط پاسخ قطعی ناموفق provider |
| pending | → cancelled | فقط پاسخ قطعی لغو/انصراف provider |
| pending | → review_required | این وضعیت روی تراکنش است: مغایرت مبلغ، شناسه درگاه، پاسخ ناشناخته یا داده ناقص |
| paid | → partially_refunded | اجرای واقعی Refund و تأیید provider برای بخشی از مبلغ |
| paid / partially_refunded | → refunded | اجرای واقعی Refund و تأیید provider برای کل مانده |
| cancelled + late paid | → Refund requested/processing | پرداخت دیرهنگام سفارش لغوشده نباید باعث fulfilment شود؛ درخواست عودت امن ایجاد می‌شود |

## ماشین وضعیت تراکنش

`initiated → pending → paid → partially_refunded → refunded`

شاخه‌های کنترل:

`pending → failed | cancelled | review_required`

خطای شبکه/timeout در Verify به `failed` تبدیل نمی‌شود؛ تراکنش در `pending` می‌ماند تا reconciliation دوباره از provider استعلام بگیرد.

## ماشین وضعیت Refund

`requested → processing → refunded`

یا:

`requested/processing → failed`

یا:

`requested/processing → review_required`

تغییر status در دیتابیس به‌تنهایی پول را جابه‌جا نمی‌کند. اجرای واقعی Refund باید از Adapter و API رسمی provider عبور کند و نتیجه تأییدشده، نهایی‌کننده DB باشد.

## قفل و idempotency

توابع نهایی‌سازی پرداخت و Refund روی تراکنش و سفارش/Refund از `SELECT ... FOR UPDATE` استفاده می‌کنند. `payment_transactions.idempotency_key` یکتا است و callback تکراری بعد از نهایی‌شدن دوباره paid نمی‌سازد.

## Ledger

`public.payment_ledger_entries` دفتر رویداد مالی append-only است. رویدادهای ایجاد سفارش، ایجاد تراکنش، تغییر وضعیت پرداخت، لغو سفارش، ایجاد Refund و تغییر وضعیت Refund در آن ثبت می‌شوند. روی ledger مسیر UPDATE/DELETE با trigger مسدود است. `payment_ledger_current_state` آخرین رویداد ثبت‌شده برای هر سفارش را به‌عنوان وضعیت جاری قابل استخراج می‌کند؛ ستون‌های status در جدول‌های عملیاتی به‌صورت projection نگهداری می‌شوند.

## Reconciliation و Rate Limit

`azim-payment-reconcile` تراکنش‌های `initiated/pending` قدیمی را دوباره Verify می‌کند و هر ۵ دقیقه با Supabase Cron اجرا می‌شود. Secret job در Supabase Vault نگهداری می‌شود. محدودیت درخواست پرداخت/Verify/Refund در جدول DB و RPC اتمیک ذخیره می‌شود، بنابراین به حافظه یک instance وابسته نیست.

تا زمانی که provider واقعی انتخاب و Adapter/Healthcheck/Refund آن تأیید نشده، `online_enabled=false` باقی می‌ماند.
