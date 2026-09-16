(() => {
  if (window.__azimHomeCopy) return;
  window.__azimHomeCopy = true;

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function mount() {
    document.title = 'عظیم ابزار | ابزار حرفه‌ای برای کار حرفه‌ای';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'عظیم ابزار؛ انتخاب و بررسی ابزارهای مکانیکی، دستی و تعمیرگاهی، همراه با کاتالوگ محصولات و دستیار هوشمند برای پیدا کردن ابزار مناسب.');

    const eyebrow = document.querySelector('.hero .eyebrow');
    if (eyebrow) eyebrow.innerHTML = '<i class="dot"></i> انتخاب ابزار، ساده‌تر از همیشه';

    const h1 = document.querySelector('.hero h1');
    if (h1) h1.innerHTML = 'ابزار درست،<br><span>شروع یک کار حرفه‌ای.</span>';

    const heroP = document.querySelector('.hero p');
    if (heroP) heroP.textContent = 'بین ابزارهای دستی، مکانیکی و تعمیرگاهی راحت‌تر انتخاب کن. محصولات را ببین، تصویر و مشخصات را بررسی کن و برای پیدا کردن گزینه مناسب از دستیار هوشمند عظیم ابزار کمک بگیر.';

    const heroButtons = document.querySelectorAll('.heroActions .btn');
    if (heroButtons[0]) heroButtons[0].textContent = 'مشاهده محصولات و انتخاب ابزار ←';
    if (heroButtons[1]) heroButtons[1].textContent = 'کمک برای انتخاب ابزار ←';

    const stats = document.querySelectorAll('.hero .stat span');
    if (stats[0]) stats[0].textContent = 'کاتالوگ ابزار برای جست‌وجوی سریع';
    if (stats[1]) stats[1].textContent = 'محصولات با تصویر و مشخصات';
    if (stats[2]) stats[2].textContent = 'دستیار هوشمند برای انتخاب';

    const sectionHeads = document.querySelectorAll('.sectionHead');
    if (sectionHeads[0]) {
      const e = sectionHeads[0].querySelector('.eyebrowText');
      const h = sectionHeads[0].querySelector('.title');
      const p = sectionHeads[0].querySelector('.lead');
      const a = sectionHeads[0].querySelector('.allLink');
      if (e) e.textContent = 'انتخاب سریع';
      if (h) h.textContent = 'دسته‌ای که دنبالشی، همین‌جاست';
      if (p) p.textContent = 'از ابزار دستی تا تجهیزات تعمیرگاهی؛ مسیرت را کوتاه کن و مستقیم سراغ دسته موردنیازت برو.';
      if (a) a.textContent = 'دیدن همه محصولات ←';
    }

    const cats = document.querySelectorAll('.catGrid .cat');
    const copy = [
      ['01', 'ابزار دقیق و کاربردی', 'برای کارهای روزمره، تعمیرات و استفاده حرفه‌ای'],
      ['02', 'ابزار دستی', 'انتخاب‌های کاربردی برای تعمیر، مونتاژ و کارگاه'],
      ['03', 'تجهیزات تعمیرگاهی', 'برای کارگاه و پروژه‌هایی که ابزار جدی‌تری می‌خواهند']
    ];
    cats.forEach((cat, i) => {
      if (!copy[i]) return;
      const parts = copy[i];
      const small = cat.querySelector('small');
      const h = cat.querySelector('h3');
      const p = cat.querySelector('p');
      if (small) small.textContent = parts[0];
      if (h) h.textContent = parts[1];
      if (p) p.textContent = parts[2];
    });

    const note = document.querySelector('.note');
    if (note) {
      note.innerHTML = '<strong>از جست‌وجو تا انتخاب:</strong> وارد کاتالوگ شو، محصول موردنظر را پیدا کن و مشخصاتش را بررسی کن؛ برای انتخاب متناسب با نوع کارت هم می‌توانی از دستیار هوشمند کمک بگیری.';
    }

    const aiSection = document.querySelector('.ai');
    if (aiSection) {
      const e = aiSection.querySelector('.eyebrowText');
      const h = aiSection.querySelector('h2');
      const p = aiSection.querySelector('p');
      const btn = aiSection.querySelector('.aiBtns .primary');
      const secondary = aiSection.querySelector('.aiBtns .glass');
      if (e) e.textContent = 'دستیار انتخاب ابزار';
      if (h) h.textContent = 'نمی‌دانی کدام ابزار مناسب کارت است؟';
      if (p) p.textContent = 'نوع کار، کاربرد یا ابزاری که دنبالش هستی را بگو تا دستیار هوشمند عظیم ابزار کمکت کند سریع‌تر به گزینه‌های مناسب برسی.';
      if (btn) btn.innerHTML = '<span class="btnIcon liveSpin"><svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg></span>کمک بگیر ←';
      if (secondary) secondary.textContent = 'ارتباط با عظیم ابزار';
    }

    document.querySelectorAll('footer a').forEach((a) => {
      if (a.textContent.includes('محصولات')) a.textContent = 'محصولات و کاتالوگ';
      if (a.textContent.includes('دستیار')) a.textContent = 'دستیار هوشمند';
      if (a.textContent.includes('ارتباط')) a.textContent = 'ارتباط با ما';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
