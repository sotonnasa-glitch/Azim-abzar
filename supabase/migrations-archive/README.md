# Migration archive

این پوشه فقط برای نگهداری snapshotهای migration است که در مقطعی داخل `supabase/migrations/` قرار داشته‌اند اما نسخه/نام آن‌ها با تاریخچه Remote فعلی Supabase یکسان نبوده است.

- فایل‌های migration مربوط به 27 سپتامبر در این آرشیو، با migrationهای canonical ثبت‌شده در Remote هم‌پوشانی عملکردی دارند یا snapshot/source هستند؛ دوباره اجرا نشوند.
- `20260928090000_notification_system.sql` نیز برای حفظ تاریخچه در آرشیو نگه داشته شده است؛ جدول‌ها و triggerهای سیستم اعلان در دیتابیس Live وجود دارند، اما همین version در migration history Remote ثبت نشده است. برای ثبت تاریخچه از ابزار رسمی migration history استفاده شود و این فایل به‌صورت کورکورانه اجرا نشود.

هدف این آرشیو این است که `supabase/migrations/` فقط شامل migrationهای canonical قابل ردیابی با history Remote باشد.
