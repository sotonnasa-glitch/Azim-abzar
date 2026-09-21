# راهنمای استقرار و تحویل عظیم ابزار

## معماری فعلی

- **Frontend استاتیک:** GitHub Pages
- **Database / Storage / Auth:** Supabase
- **Backend اختیاری:** Node.js + Express برای `/api/chat`
- **AI secrets:** فقط در environment backend
- **تصاویر کاتالوگ:** Supabase Storage در bucket `catalog-images`

## Frontend

GitHub Pages از workflow موجود استفاده می‌کند و کاتالوگ ۹۰۸ محصول، قیمت/سایز و تصاویر Supabase را در زمان build بررسی می‌کند.

## Backend

برای اجرای Node:

```bash
npm install
npm start
```

پورت از `PORT` خوانده می‌شود و اگر تنظیم نشده باشد `3000` است.

Health check:

```
GET /api/health
```

## Environment

مقادیر لازم برای backend:

- `PORT` — پورت سرویس
- `AZIM_ALLOWED_ORIGIN` — originهای مجاز frontend؛ اگر چند مورد دارید با کاما جدا شوند
- `AZIM_SUPABASE_URL` — URL پروژه Supabase
- `AZIM_SUPABASE_ANON_KEY` یا `AZIM_SUPABASE_PUBLISHABLE_KEY` — کلید publishable/anon
- `GEMINI_API_KEY` — کلید Gemini، در صورت استفاده
- `OPENAI_API_KEY` — کلید OpenAI، در صورت استفاده

هیچ `service_role`، secret key یا API key خصوصی نباید داخل frontend یا GitHub قرار بگیرد.

## AI

صفحه AI به `/api/chat` وابسته است. بنابراین GitHub Pages به تنهایی backend AI را اجرا نمی‌کند.

در صورتی که frontend و backend روی دامنه‌های جدا باشند، مقدار `AZIM_ALLOWED_ORIGIN` را برابر origin واقعی frontend قرار دهید.

## Supabase

قبل از تحویل:

1. مالکیت پروژه به حساب/Organization مشتری منتقل شود.
2. Auth مدیر مشتری ساخته و MFA فعال شود.
3. Storage و RLS دوباره بررسی شوند.
4. Leaked Password Protection در Auth فعال شود.
5. Secretهای backend در سرویس مقصد مشتری تنظیم شوند.

## پرداخت

ثبت سفارش و `payment_status` در پروژه وجود دارد، اما درگاه پرداخت واقعی هنوز به provider خاصی متصل نشده است. برای فعال‌سازی پرداخت باید provider انتخاب و Merchant/secretهای آن در backend تنظیم شوند.

## تحویل

پس از انتقال، این سناریو را از ابتدا تا انتها تست کنید:

صفحه اصلی → دسته واقعی → محصول → سایز → سبد → ثبت سفارش → پیگیری → پنل مدیریت → مشاهده سفارش
