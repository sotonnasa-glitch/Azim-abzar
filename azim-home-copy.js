(() => {
  if (window.__azimCustomerCopyV9) return;
  window.__azimCustomerCopyV9 = true;

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }
  function setHTML(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = value;
  }

  function applyCustomerCopy() {
    document.title = 'عظیم ابزار | مرجع تخصصی ابزارهای مکانیکی، کارگاهی و صنعتی';

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', 'خرید تخصصی ابزارهای مکانیکی، گاراژی و کارگاهی با آلیاژ سخت‌کاری‌شده، تضمین اصالت، قیمت دست‌اول بازار و کاتالوگ کامل ۹۰۸ محصول به همراه استعلام آنی و ارسال به سراسر کشور.');
    }

    // Hero Section Copy
    setHTML('.hero .eyebrow', 'مرجع تخصصی ابزار صنعتی و مکانیکی');
    setHTML('.hero h1', 'تجهیزات صنعتی و ابزار تخصصی مکانیکی؛<br><span>قدرت، دقت و دوام برای حرفه‌ای‌ها</span>');
    setText('.hero p', 'تأمین مستقیم بیش از ۹۰۸ قلم ابزار گاراژی، تعمیرگاهی و صنعتی با آلیاژ سخت‌کاری‌شده کروم وانادیوم (Cr-V). تضمین اصالت فیزیکی کالا، قیمت دست‌اول بازار، سایزبندی کامل و ارسال فوری به سراسر کشور.');

    // Hero Actions
    const heroButtons = document.querySelectorAll('.heroActions .btn, .hero .actions .btn');
    if (heroButtons[0]) heroButtons[0].textContent = 'مشاهده کاتالوگ و قیمت‌های بروز ←';
    if (heroButtons[1]) heroButtons[1].textContent = 'دستیار هوشمند انتخاب ابزار (AI) ←';
    if (heroButtons[2]) heroButtons[2].textContent = 'دسته‌بندی‌های تخصصی ↓';

    // Section Head Copy
    const head = document.querySelector('#categories .sectionHead, .sectionHead');
    if (head) {
      setText('.sectionHead .eyebrowText, .sectionHead .eyebrow', 'دسته‌بندی‌های تخصصی');
      setText('.sectionHead .title', 'ابزار متناسب با کار شما، با استاندارد صنعتی');
      setText('.sectionHead .lead', 'از سنگین‌ترین ابزارهای هیدرولیک و بکس‌های فشار قوی تا دقیق‌ترین ترکمترهای کالیبره‌شده، ابزار موردنیازتان را در دسته‌های زیر انتخاب کنید.');
      const all = head.querySelector('.allLink, .go');
      if (all) all.textContent = 'مشاهده همه ۹۰۸ محصول کاتالوگ ←';
    }

    // Categories Card Copy
    const cats = document.querySelectorAll('.catGrid .cat, #categories .grid .card');
    const categoryCopy = [
      ['01', 'آچار و جعبه‌بکس فشار قوی', 'ست‌های کامل یکسررینگی، جغجغه‌ای، آلن و ضربه‌ای برای سنگین‌ترین گشتاورها بدون هرزشدگی.'],
      ['02', 'ابزار تخصصی تعمیرگاهی و جلوبندی', 'سیبک‌کش، پولی‌کش، فنرلول‌جمع‌کن، فیلتربازکن و ابزارهای تنظیم موتور و تعلیق خودرو.'],
      ['03', 'ترکمتر و ابزارهای گشتاور دقیق', 'ترکمترهای تقه‌ای و دیجیتال کالیبره‌شده با دقت بالا جهت بستن اصولی پیچ‌های سرسیلندر.'],
      ['04', 'ابزارهای دستی و گاراژی مقاوم', 'انبرقفلی‌های سخت‌کاری‌شده، پیچ‌گوشتی تقه‌ای، قلاویز چپ‌گرد و سنبه‌های فولادی ضد سایش.'],
      ['05', 'ابزارآلات بادی و روانکاری', 'بکس‌های بادی کارگاهی، گریس‌پمپ‌های پرقدرت و پیستوله‌های شست‌وشو و باد پاش.'],
      ['06', 'جعبه‌ابزارهای چرخ‌دار کارگاهی', 'میزها و ترولی‌های کشویی ۳۶۵ پارچه ۷ کشو مجهز برای تجهیز صفر تا صد گاراژ و تعمیرگاه.']
    ];

    cats.forEach((cat, i) => {
      const c = categoryCopy[i];
      if (!c) return;
      const small = cat.querySelector('small, .num');
      const h = cat.querySelector('h3');
      const p = cat.querySelector('p');
      const go = cat.querySelector('.go');
      if (small) small.textContent = c[0];
      if (h) h.textContent = c[1];
      if (p) p.textContent = c[2];
      if (go) go.textContent = 'مشاهده محصولات این دسته ←';
    });

    // 3 Paths Guide Section
    let guide = document.getElementById('azim-choice-guide');
    if (!guide) {
      guide = document.createElement('section');
      guide.id = 'azim-choice-guide';
      guide.className = 'section az-reveal az-visible';
      guide.innerHTML = `
        <div class="wrap">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">مسیر مطمئن خرید</div>
              <h2 class="title">چگونه بهترین ابزار را سریع و مطمئن انتخاب کنیم؟</h2>
              <p class="lead">چه نام و کد فنی ابزار را بدانید و چه فقط شرح کار فنی را داشته باشید، مسیر دسترسی آماده است:</p>
            </div>
          </div>
          <div class="az-choice-grid">
            <a class="az-choice" href="products-v4.html">
              <span class="az-choice-num">مسیر اول</span>
              <strong>جست‌وجوی مستقیم در کاتالوگ</strong>
              <small>دسترسی به تصاویر باکیفیت، کدهای فنی و قیمت‌های روز ۹۰۸ قلم ابزار با قابلیت انتخاب سایز و مدل.</small>
              <b>ورود به کاتالوگ محصولات ←</b>
            </a>
            <a class="az-choice" href="ai.html">
              <span class="az-choice-num">مسیر دوم</span>
              <strong>مشاوره فنی با دستیار هوشمند</strong>
              <small>شرح کار یا مشکل مکانیکی‌تان را بنویسید تا هوش مصنوعی ابزار استاندارد و تخصصی مربوطه را پیشنهاد دهد.</small>
              <b>گفت‌وگو با دستیار هوشمند AI ←</b>
            </a>
            <a class="az-choice" href="contact.html">
              <span class="az-choice-num">مسیر سوم</span>
              <strong>استعلام عمده و تماس مستقیم</strong>
              <small>برای تجهیز کارگاه، سفارش‌های تیراژ و استعلام پیش‌فاکتور رسمی با کارشناسان فروش ما تماس بگیرید.</small>
              <b>تماس و ارتباط با ما ←</b>
            </a>
          </div>
        </div>
      `;
      const catSection = document.getElementById('categories');
      if (catSection && catSection.parentNode) {
        catSection.parentNode.insertBefore(guide, catSection);
      }
    }

    // Why Choose Us Section - Pure Vector Industrial Icons (No Emojis)
    let whySection = document.getElementById('azim-why-us');
    if (!whySection) {
      whySection = document.createElement('section');
      whySection.id = 'azim-why-us';
      whySection.className = 'section az-reveal az-visible';
      whySection.innerHTML = `
        <div class="wrap">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">مزیت رقابتی عظیم ابزار</div>
              <h2 class="title">چرا استادکاران و کارگاه‌ها به عظیم ابزار اعتماد می‌کنند؟</h2>
              <p class="lead">خرید ابزار یعنی سرمایه‌گذاری برای راندمان کار شما؛ تعهد ما ارائه بالاترین کیفیت با قیمت بی‌واسطه است.</p>
            </div>
          </div>
          <div class="az-features-grid">
            <div class="az-feat-card">
              <div class="az-feat-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>آلیاژ صنعتی با ضمانت دوام</h3>
              <p>استفاده از فولاد سخت‌کاری‌شده کروم وانادیوم (Cr-V) مقاوم در برابر سایش، پیچش و ضربه تحت بارهای سنگین کارگاهی.</p>
            </div>
            <div class="az-feat-card">
              <div class="az-feat-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <h3>قیمت رقابتی و دست اول</h3>
              <p>حذف واسطه‌ها و ارائه قیمت شفاف و منصفانه، به همراه لیست قیمت بروزرسانی‌شده با احتساب تنوع سایزها.</p>
            </div>
            <div class="az-feat-card">
              <div class="az-feat-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
              <h3>ارسال سریع و مطمئن</h3>
              <p>بسته‌بندی ضربه‌گیر صنعتی و ارسال سریع سفارش‌ها به تعمیرگاه‌ها، صنایع و کارگاه‌ها در تمام استان‌های کشور.</p>
            </div>
            <div class="az-feat-card">
              <div class="az-feat-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              </div>
              <h3>تخصصی‌ترین تنوع گاراژی</h3>
              <p>جامع‌ترین مجموعه ابزارهای خاص بازوبست خودروهای سواری، سنگین و خطوط مونتاژ صنعتی در یک کاتالوگ متمرکز.</p>
            </div>
          </div>
        </div>
      `;
      const footer = document.querySelector('footer');
      if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(whySection, footer);
      }
    }

    // Update Note
    const note = document.querySelector('.note');
    if (note) {
      note.innerHTML = '<strong>تضمین اصالت و سلامت فیزیکی کالا:</strong> کلیه محصولات کاتالوگ عظیم ابزار از برترین آلیاژهای صنعتی و فولاد کروم وانادیوم تأمین شده و دارای تست کیفی فیزیکی قبل از ارسال هستند. جهت دریافت مشاوره فنی یا ثبت سفارش عمده با واحد فروش در ارتباط باشید.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCustomerCopy, { once: true });
  } else {
    applyCustomerCopy();
  }
})();
