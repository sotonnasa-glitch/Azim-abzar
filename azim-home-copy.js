(() => {
  if (window.__azimHomeCopyV3) return;
  window.__azimHomeCopyV3 = true;

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  const setHTML = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = value;
  };

  function addConversionSection(beforeEl) {
    if (!beforeEl || document.getElementById('azim-choice-guide')) return;
    const section = document.createElement('section');
    section.id = 'azim-choice-guide';
    section.className = 'section reveal';
    section.innerHTML = `
      <div class="sectionHead">
        <div>
          <div class="eyebrowText">راهنمای انتخاب</div>
          <h2 class="title">اول کاربردت را مشخص کن؛ بعد ابزار را انتخاب کن.</h2>
          <p class="lead">برای هر کاری لازم نیست بین صدها گزینه بگردی. از کاربردت شروع کن و با چند قدم ساده به ابزار مناسب برس.</p>
        </div>
      </div>
      <div class="az-choice-grid">
        <a class="az-choice" href="/products">
          <span class="az-choice-num">01</span>
          <strong>می‌دانم چه ابزاری می‌خواهم</strong>
          <small>مستقیم برو سراغ کاتالوگ و مشخصات محصول را بررسی کن.</small>
          <b>ورود به کاتالوگ ←</b>
        </a>
        <a class="az-choice" href="/products">
          <span class="az-choice-num">02</span>
          <strong>بین چند ابزار مرددم</strong>
          <small>دسته مناسب را پیدا کن و گزینه‌ها را کنار هم ببین.</small>
          <b>پیدا کردن دسته ←</b>
        </a>
        <a class="az-choice" href="/ai">
          <span class="az-choice-num">03</span>
          <strong>نمی‌دانم چه ابزاری لازم دارم</strong>
          <small>کاربردت را برای دستیار هوشمند توضیح بده و از آن کمک بگیر.</small>
          <b>شروع راهنمایی با AI ←</b>
        </a>
      </div>`;
    beforeEl.parentNode.insertBefore(section, beforeEl);
  }

  function mount() {
    document.title = 'عظیم ابزار | ابزار حرفه‌ای برای کار حرفه‌ای';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'عظیم ابزار؛ کاتالوگ ابزارهای مکانیکی، دستی و تعمیرگاهی با تصویر و مشخصات، به‌همراه دستیار هوشمند برای کمک به انتخاب ابزار مناسب.');

    setHTML('.hero .eyebrow', '<i class="dot"></i> ابزار مناسب، دقیق‌تر و سریع‌تر پیدا می‌شود');
    setHTML('.hero h1', 'ابزاری که به کارت می‌آید،<br><span>همین‌جا پیدایش کن.</span>');
    setText('.hero p', 'برای تعمیر، مونتاژ، کارگاه و پروژه‌های فنی، بین دسته‌های ابزار بگرد، تصویر و مشخصات محصول را ببین و وقتی برای انتخاب مرددی از دستیار هوشمند عظیم ابزار کمک بگیر.');

    const heroButtons = document.querySelectorAll('.heroActions .btn');
    if (heroButtons[0]) heroButtons[0].textContent = 'رفتن به کاتالوگ ابزار ←';
    if (heroButtons[1]) heroButtons[1].textContent = 'از AI برای انتخاب کمک بگیر ←';

    const stats = document.querySelectorAll('.hero .stat span');
    if (stats[0]) stats[0].textContent = 'جست‌وجوی ابزار بر اساس دسته و کاربرد';
    if (stats[1]) stats[1].textContent = 'تصویر و مشخصات برای بررسی محصول';
    if (stats[2]) stats[2].textContent = 'دستیار هوشمند برای مسیر انتخاب';

    const sectionHeads = document.querySelectorAll('.sectionHead');
    if (sectionHeads[0]) {
      setText('.sectionHead:nth-of-type(1) .eyebrowText', 'دسته‌بندی ابزار');
      setText('.sectionHead:nth-of-type(1) .title', 'دنبال چه ابزاری هستی؟ از همین‌جا شروع کن.');
      setText('.sectionHead:nth-of-type(1) .lead', 'از ابزار دستی و تجهیزات کاربردی تا ابزارهای موردنیاز کارگاه؛ دسته مناسب را انتخاب کن و مستقیم وارد محصولات شو.');
      const allLink = sectionHeads[0].querySelector('.allLink');
      if (allLink) allLink.textContent = 'مشاهده همه محصولات ←';
    }

    const cats = document.querySelectorAll('.catGrid .cat');
    const copy = [
      ['01', 'ابزار کاربردی برای هر روز', 'برای تعمیرات، کارهای فنی و استفاده روزمره؛ سریع‌تر دسته مناسب را پیدا کن.'],
      ['02', 'ابزار دستی و تعمیراتی', 'برای باز و بست، مونتاژ، تعمیر و کارگاه؛ گزینه‌ها را بررسی و انتخاب کن.'],
      ['03', 'تجهیزات و ابزار کارگاهی', 'برای پروژه‌های جدی‌تر، دسته مناسب را پیدا کن و مشخصات ابزارها را ببین.']
    ];
    cats.forEach((cat, i) => {
      if (!copy[i]) return;
      setText('.cat small', copy[i][0]);
      const small = cat.querySelector('small');
      const h = cat.querySelector('h3');
      const p = cat.querySelector('p');
      if (small) small.textContent = copy[i][0];
      if (h) h.textContent = copy[i][1];
      if (p) p.textContent = copy[i][2];
    });

    const note = document.querySelector('.note');
    if (note) note.innerHTML = '<strong>فقط اسم ابزار را می‌دانی؟</strong> همان را در کاتالوگ جست‌وجو کن. کاربردش را می‌دانی ولی اسمش را نه؟ از دستیار هوشمند برای شروع انتخاب کمک بگیر.';

    const aiSection = document.querySelector('.ai');
    if (aiSection) {
      const e = aiSection.querySelector('.eyebrowText');
      const h = aiSection.querySelector('h2');
      const p = aiSection.querySelector('p');
      const btn = aiSection.querySelector('.aiBtns .primary');
      const secondary = aiSection.querySelector('.aiBtns .glass');
      if (e) e.textContent = 'انتخاب هوشمند ابزار';
      if (h) h.textContent = 'اسم ابزار را نمی‌دانی؟ کاربردت را بگو.';
      if (p) p.textContent = 'بگو چه کاری می‌خواهی انجام بدهی، چه قطعه‌ای را تعمیر می‌کنی یا دنبال چه نوع ابزاری هستی؛ دستیار هوشمند عظیم ابزار برای پیدا کردن گزینه‌های مناسب راهنمایت می‌کند.';
      if (btn) btn.innerHTML = '<span class="btnIcon liveSpin"><svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg></span>شروع گفتگو با AI ←';
      if (secondary) secondary.textContent = 'مشاهده کاتالوگ';
    }

    document.querySelectorAll('footer a').forEach((a) => {
      if (a.textContent.includes('محصولات')) a.textContent = 'کاتالوگ ابزار';
      if (a.textContent.includes('دستیار')) a.textContent = 'دستیار انتخاب ابزار';
      if (a.textContent.includes('ارتباط')) a.textContent = 'ارتباط با عظیم ابزار';
    });

    const ai = document.querySelector('.ai');
    addConversionSection(ai || document.querySelector('footer'));

    const style = document.createElement('style');
    style.textContent = `
      #azim-choice-guide{padding-top:20px}
      #azim-choice-guide .sectionHead{margin-bottom:22px}
      .az-choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      .az-choice{position:relative;min-height:190px;padding:22px;border:1px solid rgba(255,255,255,.09);border-radius:20px;background:linear-gradient(145deg,rgba(18,24,20,.88),rgba(8,11,9,.95));display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;overflow:hidden;transition:.35s ease}
      .az-choice:before{content:"";position:absolute;inset:-40%;background:radial-gradient(circle at 75% 20%,rgba(245,185,0,.14),transparent 34%);pointer-events:none}
      .az-choice:hover{transform:translateY(-8px);border-color:rgba(245,185,0,.45);box-shadow:0 24px 55px rgba(0,0,0,.35)}
      .az-choice-num{color:#f5b900;font-size:9px;font-weight:900;letter-spacing:.7px}
      .az-choice strong{font-size:18px;margin-top:14px;line-height:1.5;position:relative}
      .az-choice small{font-size:9px;line-height:2;color:#8e9791;margin-top:8px;position:relative}
      .az-choice b{margin-top:auto;padding-top:18px;color:#ffd84f;font-size:9px;position:relative}
      @media(max-width:800px){.az-choice-grid{grid-template-columns:1fr}.az-choice{min-height:155px}}
    `;
    document.head.appendChild(style);

    document.querySelectorAll('.reveal').forEach((el) => {
      if (!el.dataset.azimRevealBound) {
        el.dataset.azimRevealBound = '1';
        requestAnimationFrame(() => el.classList.add('visible'));
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else mount();
})();