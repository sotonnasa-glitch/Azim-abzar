# راهنمای تحویل پروژه عظیم ابزار

برای راهنمای کامل انتقال مالکیت، فایل `TRANSFER_READY_FA.md` را مبنا قرار دهید.

## اصل معماری
- کد سایت در GitHub
- داده، Auth و Storage در Supabase
- AI، ربات مدیر و اعلان مشاوره در Supabase Edge Functions
- Hosting فعلی با Cloudflare Worker
- Node/Express به‌عنوان backend اختیاری

## چیزهایی که باید همراه پروژه منتقل شوند
- GitHub repository و Actions
- پروژه Supabase یا export/import کامل دیتابیس و Storage
- Auth کاربران و MFA مدیران
- secretهای Edge Functions
- Telegram Bot و chat IDهای مجاز
- دامنه و DNS/Cloudflare
- API keyهای AI

هیچ secret خصوصی نباید وارد frontend یا GitHub شود.

برای پروژه جدید Supabase، ابتدا migrationهای `supabase/migrations/` را اجرا و سپس داده‌ها و Storage را منتقل کنید. بعد `supabase-config.js` را با URL و publishable/anon key پروژه مقصد تنظیم کنید.

ربات مدیر Telegram endpoint خود را از `SUPABASE_URL` محیط Edge Function می‌گیرد؛ بنابراین به project-ref قبلی وابسته نیست.