# استقرار و تحویل عظیم ابزار

## Frontend
Frontend با HTML/CSS/JS است و می‌تواند روی Cloudflare Worker، GitHub Pages یا hosting استاتیک دیگری اجرا شود.

## Supabase
`supabase/migrations/` منبع migrationهای قابل تکرار پروژه است.

`supabase-config.js` تنها فایل public-side برای اتصال مرورگر به پروژه Supabase است. هنگام انتقال، URL و publishable/anon key پروژه مقصد را جایگزین کنید.

## AI
Edge Function اصلی: `azim-ai-chat`
Secretهای لازم: `GEMINI_API_KEY` و در صورت نیاز `OPENAI_API_KEY`.

تنظیمات provider/model در `site_content` با بخش `ai_settings` نگهداری می‌شوند.

## Telegram
Edge Function مدیر: `azim-telegram-admin`
اعلان فرم مشاوره: `azim-consultation-notify`
Secretهای اصلی: `TELEGRAM_BOT_TOKEN` و `TELEGRAM_ADMIN_CHAT_IDS`.

Webhook مدیر بعد از انتقال باید روی endpoint همان پروژه Supabase مقصد تنظیم شود.

## Node self-hosted
بر اساس `.env.example`، متغیرهای `AZIM_SUPABASE_URL`، `AZIM_SUPABASE_ANON_KEY`، `AZIM_ALLOWED_ORIGIN` و secretهای backend را تنظیم کنید.

## تست تحویل
صفحه اصلی → کاتالوگ → محصول → سایز → ربات محصول → سبد → سفارش → پیگیری → فرم مشاوره → Telegram → پنل → تغییر محصول → مشاهده تغییر در سایت و ربات.