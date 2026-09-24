# عظیم ابزار — بسته بررسی کامل فروشگاه

این پوشه برای تحویل پروژه به یک AI دیگر جهت **Audit کامل فنی و فروشگاهی** ساخته شده است.

## چیزی که باید بررسی شود
کل ZIP گیت‌هاب + این Snapshot زنده Supabase را با هم بررسی کن و هر ایراد را پیدا کن:
- frontend و admin و تمام routeها/لینک‌ها
- تصاویر، asset pathها و broken images
- JS runtime، fetch، RPC و mismatch بین کد و دیتابیس
- products، variants، prices، cart و checkout
- discount engine و محدودیت‌ها
- orders، order_items، tracking، cancel/return
- RLS، role boundaries و security
- Storage و Edge Functions
- GitHub Pages، Cloudflare، Node/server fallback و deployment mismatch
- migration drift بین repo و database
- dead/legacy code، duplicated functions، TODO و root clutter
- mobile/accessibility/SEO/forms
- چیزهایی که برای یک **فروشگاه آنلاین واقعی و قابل تحویل** هنوز ناقص است

## داده و امنیت
این بسته عمدیـاً credential یا secret ندارد. رکوردهای خصوصی مشتریان/کاربران نیز row-by-row صادر نشده‌اند؛ اما schema، توابع زنده، RLS و کل کاتالوگ 908 محصول در بسته وجود دارد.

## خروجی پیشنهادی Audit
برای هر مورد:
**Page/Feature → Issue → Severity (Critical/Major/Minor) → Evidence → Reproduction → Suggested Fix**

مواردی که نیاز به تست زنده مرورگر یا شبکه دارند را صریحاً با **Needs live test** علامت بزن و موفقیت را حدس نزن.
