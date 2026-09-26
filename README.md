# عظیم ابزار (Azim Abzar)

وب‌سایت فروشگاهی و کاتالوگ تخصصی ابزارهای مکانیکی، کارگاهی و صنعتی.

## معماری

- Frontend استاتیک HTML/CSS/JS
- Supabase برای Database / Auth / Storage
- Supabase Edge Functions برای AI و Telegram
- Cloudflare Worker برای hosting فعلی
- Node.js + Express به‌عنوان backend اختیاری self-hosted
- GitHub Actions برای build و validation

## انتقال به صاحب سایت

این پروژه برای انتقال مالکیت آماده شده است. راهنمای اصلی: `TRANSFER_READY_FA.md`

برای انتقال کامل فقط فایل‌های کد کافی نیست؛ Supabase data/Storage، Auth/MFA، Edge Function secrets، Telegram bot، Cloudflare/DNS و مالکیت GitHub نیز باید منتقل شوند.

## تنظیمات عمومی

اتصال مرورگر در `supabase-config.js` قرار دارد. فقط publishable/anon key مجاز است. secret/service-role نباید در frontend قرار بگیرد.

## AI و ربات

- محصول و سایز: `azim-ai-chat`
- ربات مدیر Telegram: `azim-telegram-admin`
- اعلان فرم مشاوره Telegram: `azim-consultation-notify`

هر سه سورس Edge Function داخل repository نگهداری می‌شوند و secretها باید فقط در environment/Secrets سرویس مقصد تعریف شوند.

## اجرای محلی

```bash
npm install
npm start
```

نمونه environment: `.env.example`

## تست

```bash
npm test
```