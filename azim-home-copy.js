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
      meta.setAttribute('content', 'خرید تخصصی ابزارهای مکانیکی، گاراژی و کارگاهی با آلیاژ سخت‌کاری‌شده، تضمین اصالت، قیمت دست‌اول بازار و کاتالوگ کامل ۹۰۸ محصول به همراه استعلام آنی و ارسال به سراسر کشور.');
    }

    // Update Note if present
    const note = document.querySelector('.note');
    if (note && !note.dataset.customized) {
      note.dataset.customized = 'true';
      note.innerHTML = '<strong>تضمین اصالت و سلامت فیزیکی کالا:</strong> کلیه محصولات کاتالوگ عظیم ابزار از برترین آلیاژهای صنعتی و فولاد کروم وانادیوم تأمین شده و دارای تست کیفی فیزیکی قبل از ارسال هستند. جهت دریافت مشاوره فنی یا ثبت سفارش عمده با واحد فروش در ارتباط باشید.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCustomerCopy, { once: true });
  } else {
    applyCustomerCopy();
  }
})();

