# بسته تحویل کامل عظیم ابزار — Transfer Ready

این repository از این نقطه باید مستقل از حساب شخصی سازنده قابل نگهداری و انتقال باشد.

## مالکیت‌هایی که باید به صاحب سایت تحویل شوند

### 1. کد و مخزن GitHub
مالک یا Organization مشتری باید مالک repository باشد و GitHub Actions را از حساب خودش اجرا کند.

فایل‌های داخلی مثل SQL، سورس Edge Function، audit و اسناد تحویل نباید توسط Worker/Pages به‌عنوان فایل عمومی سرو شوند.

### 2. دیتابیس و احراز هویت
پایگاه داده، Auth، Storage و RLS در Supabase قرار دارند.

در انتقال کامل دو سناریو وجود دارد:

- انتقال خود پروژه Supabase فعلی به Organization مشتری؛ یا
- ساخت پروژه Supabase جدید برای مشتری و اجرای migrationهای repository روی آن.

در سناریوی پروژه جدید، همه داده‌های محصول، دسته‌بندی، سفارش، مشتری، محتوا، تخفیف، لاگ و تنظیمات باید با مهاجرت داده جداگانه منتقل شوند. صرفاً اجرای schema بدون داده، نسخه قبلی فروشگاه را بازسازی نمی‌کند.

### 3. تنظیمات عمومی Frontend
فایل زیر تنها نقطه تنظیم عمومی اتصال مرورگر به Supabase است:

`supabase-config.js`

این فایل باید فقط شامل URL پروژه و publishable/anon key باشد. کلید service-role یا secret هرگز نباید در آن قرار گیرد.

CSP صفحات سایت و workflow هم به‌صورت host-agnostic نوشته شده‌اند تا تعویض پروژه Supabase باعث شکستن ارتباط مرورگر نشود.

### 4. هوش مصنوعی
ربات عمومی و ربات مشاور محصول از Edge Function زیر استفاده می‌کنند:

`supabase/functions/azim-ai-chat/index.ts`

این تابع اطلاعات محصول را مستقیماً از جدول `products` می‌خواند؛ بنابراین وقتی مدیر نام، توضیحات، قیمت یا سایز محصول را در پنل تغییر دهد، ربات محصول هم از داده جدید استفاده می‌کند.

Secretهای AI فقط در محیط server-side تنظیم شوند:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY` (اختیاری)

Provider و مدل در `site_content / ai_settings` قابل کنترل هستند.

### 5. ربات مدیر تلگرام
سورس ربات:

`supabase/functions/azim-telegram-admin/index.ts`

نیازمند:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_IDS`
- `SUPABASE_URL` (خود Supabase Edge Runtime فراهم می‌کند)
- کلید server-side مورد استفاده تابع Supabase

Webhook باید بعد از انتقال روی پروژه Supabase مشتری تنظیم شود. endpoint جدید همیشه به شکل زیر خواهد بود:

`https://<CUSTOMER-PROJECT-REF>.supabase.co/functions/v1/azim-telegram-admin`

هیچ توکن Telegram در frontend یا GitHub قرار نگیرد.

### 6. ثبت درخواست مشاوره → Telegram
تابع:

`supabase/functions/azim-consultation-notify/index.ts`

فرم مشاوره سایت درخواست را در دیتابیس ثبت می‌کند و سپس برای chat IDهای تعریف‌شده در `TELEGRAM_ADMIN_CHAT_IDS` اعلان Telegram می‌فرستد.

خرابی Telegram نباید باعث حذف درخواست ذخیره‌شده مشتری شود.

### 7. Hosting / Cloudflare Worker
Worker فعلی فقط لایه تحویل asset است و منطق فروشگاه در فایل‌های پروژه، Supabase و Edge Functions نگهداری می‌شود.

فایل‌ها:

- `worker.js`
- `wrangler.jsonc`

نام Worker فعلی قابل تعویض است. برای انتقال مالکیت، Worker باید در حساب Cloudflare مشتری deploy شود و دامنه اختصاصی مشتری روی آن تنظیم شود.

### 8. GitHub Pages
Workflow:

`.github/workflows/pages.yml`

قبل از build، URL عمومی Supabase را مستقیماً از `supabase-config.js` می‌خواند؛ بنابراین workflow دیگر به project-ref فعلی وابسته نیست.

### 9. کاتالوگ و تصاویر
شناسه‌های کاتالوگ از `P0001` تا `P0908` هستند و داده build از فایل فشرده منبع repository بازسازی می‌شود.

تصاویر زنده کاتالوگ در Storage bucket:

`catalog-images`

قرار دارند. در پروژه مقصد جدید باید bucket و objectها هم منتقل شوند.

### 10. SQL و Migration
مبنای اصلی schema قابل تکرار، پوشه زیر است:

`supabase/migrations/`

فایل‌های SQL ریشه repository و `database/` شامل schema، hardening، checkout، سفارش، تخفیف و اصلاحات هستند. در پروژه مقصد، migrationها باید به‌ترتیب timestamp اجرا شوند یا با Supabase CLI به‌صورت migration رسمی deploy شوند.

برای انتقال داده‌های واقعی، backup/export از project فعلی و import به project مقصد لازم است.

### پرداخت آنلاین

زیرساخت پرداخت آنلاین از قبل در پروژه آماده شده است:

- جدول تراکنش‌ها: `public.payment_transactions`
- Edge Function: `supabase/functions/azim-payment-gateway/index.ts`
- صفحه callback: `payment-callback.html`
- راهنمای اطلاعات موردنیاز درگاه: `PAYMENT_SETUP_FA.md`

فعلاً گزینه پرداخت آنلاین عمداً تا زمان تکمیل adapter درگاه و تست واقعی فعال نمی‌شود. پس از اینکه مشتری درگاه را تهیه کرد، نام درگاه، شناسه‌ها/کلیدهای لازم، مستندات API، واحد مبلغ و اطلاعات callback از او گرفته می‌شود و فقط adapter همان درگاه تکمیل می‌شود. Secretهای درگاه نباید وارد repository یا frontend شوند.

### 11. حساب مدیر و MFA
پس از ساخت Auth user مشتری:

1. UUID کاربر در `public.admin_users` ثبت شود.
2. `is_active=true` باشد.
3. MFA/TOTP برای حساب مدیر فعال شود.
4. نقش مناسب (`owner`, `admin`, `editor`, `sales`) تعیین شود.

دسترسی‌های حساس مدیریتی به MFA/AAL2 متکی هستند.

### 12. دامنه و لینک‌ها
بعد از انتقال، این موارد باید در اختیار مشتری باشد:

- دامنه اصلی
- DNS
- Cloudflare
- GitHub
- Supabase
- ایمیل‌های کاری
- Telegram Bot
- API keyهای AI
- روش بازیابی MFA

### تست نهایی تحویل

این زنجیره باید روی حساب‌های مشتری از ابتدا تا انتها تست شود:

صفحه اصلی → دسته‌بندی → محصول → انتخاب سایز → قیمت → ربات محصول → سبد → ثبت سفارش → پیگیری سفارش → فرم مشاوره → اعلان Telegram → ورود پنل → تغییر محصول → مشاهده تغییر در سایت و ربات → تخفیف → لاگ فعالیت.

## اصل انتقال

بعد از تحویل، نباید برای ادامه کار هیچ وابستگی عملیاتی به حساب شخصی سازنده باقی بماند. همه مالکیت‌ها، secretها، دامنه‌ها، دسترسی‌ها و اطلاعات بازیابی باید در اختیار مشتری باشد.
