# راهنمای تحویل پروژه عظیم ابزار

این پروژه باید به صورت «کامل و قابل مالکیت مستقل» تحویل مشتری شود.

## 1) مالکیت GitHub
- Repository را به حساب/Organization مشتری منتقل کنید یا مشتری را مالک repository قرار دهید.
- بعد از انتقال، GitHub Pages و Actions را در حساب مشتری فعال و یک بار Deploy را بررسی کنید.
- Secretهای GitHub Actions باید در حساب مشتری دوباره بررسی شوند؛ هیچ API key خصوصی نباید داخل فایل‌های پروژه قرار بگیرد.

## 2) مالکیت Supabase
- Project Supabase فعلی باید به حساب/Organization مشتری منتقل شود یا یک پروژه جدید به نام مشتری ساخته شود.
- اگر پروژه جدید ساخته شد، مقدارهای window.AZIM_SUPABASE_URL و window.AZIM_SUPABASE_ANON_KEY در supabase-config.js به مقادیر پروژه جدید تغییر کنند.
- SQLهای schema و امنیت این repository باید در پروژه مقصد اعمال و سپس RLS/Policies و Storage بررسی شوند.
- کلید publishable/anon برای مرورگر قابل استفاده است؛ service_role/secret هرگز نباید داخل repo یا frontend قرار گیرد.

## 3) حساب مدیر و MFA
- حساب مدیر مشتری باید در Supabase Auth ساخته شود.
- رکورد همان user در public.admin_users با role مناسب و is_active=true ثبت شود.
- اولین ورود پنل، فعال‌سازی TOTP/Authenticator را الزامی می‌کند.
- دسترسی‌های مدیریتی دیتابیس برای نشست‌های بدون MFA سطح AAL2 رد می‌شوند.
- مشتری باید recovery/backup codes یا روش بازیابی MFA را در جای امن خودش نگه دارد.

## 4) امنیت رمز
در Supabase Dashboard > Auth > Password Security، گزینه Leaked Password Protection را فعال کنید. این تنها هشدار امنیتی باقی‌مانده‌ای است که Security Advisor پروژه در آخرین بررسی گزارش می‌کند.

## 5) هوش مصنوعی
ai.html به مسیر /api/chat وابسته است.
- اگر سایت با Node/Express اجرا می‌شود، server.js همین مسیر را ارائه می‌کند.
- اگر سایت فقط روی GitHub Pages است، Node/Express اجرا نمی‌شود و /api/chat در Pages وجود ندارد. در این حالت backend مربوط به AI باید روی یک سرویس سروری/Serverless مستقل اجرا شود و frontend به URL آن متصل شود.
- GEMINI_API_KEY و OPENAI_API_KEY فقط باید به عنوان server-side secret در محیط backend نگهداری شوند.

## 6) قبل از تحویل
تست کنید:
- صفحه اصلی
- کاتالوگ و 908 محصول
- سبد و ثبت سفارش
- کد تخفیف
- فرم ارتباط
- ورود پنل
- MFA
- نقش‌های owner/admin/editor/sales
- آپلود/حذف تصویر
- Audit Log
- دستیار AI
- دامنه اختصاصی، SSL و ایمیل‌های سایت

## 7) اصل مهم تحویل
بعد از تحویل، مشتری باید بتواند بدون دسترسی به حساب شخصی سازنده:
1. repository را مدیریت کند،
2. Supabase را مدیریت کند،
3. مدیران را تغییر دهد،
4. secretهای backend را عوض کند،
5. دامنه را مدیریت کند،
6. و در صورت نیاز پروژه را به hosting دیگری منتقل کند.