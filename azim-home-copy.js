(() => {
  if (window.__azimCustomerCopyV9) return;
  window.__azimCustomerCopyV9 = true;

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function applyCustomerCopy() {
    document.title = 'عظیم ابزار | مرجع تخصصی ابزارهای مکانیکی، کارگاهی و صنعتی';

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', 'کاتالوگ ۹۰۸ محصول ابزارهای مکانیکی، کارگاهی و گاراژی با نمایش مشخصات، تصویر، سایزبندی و قیمت‌های ثبت‌شده؛ برای استعلام و سفارش با فروش در ارتباط باشید.');
    }

    // Update Note if present
    const note = document.querySelector('.note');
    if (note && !note.dataset.customized) {
      note.dataset.customized = 'true';
      note.innerHTML = '<strong>اطلاعات کالا و قیمت نمایش‌داده‌شده از اطلاعات فعلی کاتالوگ و فروشگاه است؛ برای موجودی و شرایط سفارش استعلام بگیرید.</strong> جهت دریافت مشاوره فنی یا ثبت سفارش عمده با واحد فروش در ارتباط باشید.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCustomerCopy, { once: true });
  } else {
    applyCustomerCopy();
  }
})();

