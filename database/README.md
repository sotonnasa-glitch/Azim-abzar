# ترتیب اجرای SQL های پوشه `database/`

برای ساخت یا بازسازی دیتابیس عظیم ابزار، فایل‌های این پوشه را به ترتیب زیر اجرا کنید. اجرای مجدد فایل‌ها در همان ترتیب طراحی شده است.

1. `catalog-schema.sql`
2. `catalog-compatibility.sql`
3. `product-direct-discount.sql`
4. `public-cart.sql`
5. `order-tracking.sql`
6. `checkout-actions.sql`
7. `order-request-hardening.sql`
8. `discount-engine-hardening.sql`
9. `security-hardening.sql`

## نکات مهم

- `order-tracking.sql` تنها محل تعریف نهایی RPC پیگیری سفارش `azim_order_status` است. این تابع باید بعد از جدول‌های سفارش و `order_items` وجود داشته باشد.
- `checkout-actions.sql` عمداً دیگر `azim_order_status` را بازتعریف نمی‌کند و فقط جریان پرداخت، لغو و مرجوعی را تکمیل می‌کند.
- `discount-engine-hardening.sql` به جدول‌های تخفیف، اقلام سفارش و helperهای نقش مدیر وابسته است.
- `security-hardening.sql` لایه نهایی مجوزها، wrapperهای عمومی و محدودیت‌های امنیتی را اعمال می‌کند.
- در محیط موجود، کاتالوگ فعال ۹۰۸ محصول است؛ اسکریپت‌های قدیمی نباید آن را به تعداد دیگری seed کنند.
- این README ترتیب وابستگی را مستند می‌کند؛ لازم نیست نام فایل‌های فعلی برای اعمال آن به‌صورت فیزیکی تغییر کند.
