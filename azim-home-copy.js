(() => {
  if (window.__azimHomeCopyV4) return;
  window.__azimHomeCopyV4 = true;

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }
  function setHTML(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = value;
  }

  function mount() {
    document.title = 'عظیم ابزار | ابزار موردنیازت را راحت‌تر پیدا کن';
    setText('meta[name="description"]', 'عظیم ابزار؛ برای پیدا کردن ابزار مناسب، کاربردت را مشخص کن، محصولات را ببین و قبل از انتخاب مشخصات را بررسی کن.');

    // Hero: benefit-first copy, not generic brand language.
    setHTML('.hero .eyebrow', '<i class="dot"></i> ابزار مناسب، برای کاری که داری');
    setHTML('.hero h1', 'دنبال ابزار می‌گردی؟<br><span>از همین‌جا شروع کن.</span>');
    setText('.hero p', 'اسم ابزار را می‌دانی؟ مستقیم جست‌وجو کن. فقط می‌دانی چه کاری باید انجام شود؟ کاربردت را برای دستیار هوشمند بگو تا مسیر انتخابت کوتاه‌تر شود.');

    const heroButtons = document.querySelectorAll('.heroActions .btn');
    if (heroButtons[0]) heroButtons[0].textContent = 'جست‌وجوی ابزار ←';
    if (heroButtons[1]) heroButtons[1].textContent = 'نمی‌دانم چه ابزاری لازم دارم ←';

    // Small trust/utility statements under the hero.
    const stats = document.querySelectorAll('.hero .stat');
    const statCopy = [
      ['شروع سریع', 'از دسته یا نام ابزار برو سراغ محصول موردنظر'],
      ['بررسی قبل از انتخاب', 'تصویر و مشخصات محصول را ببین'],
      ['راهنمایی هوشمند', 'برای انتخاب ابزار، از AI کمک بگیر']
    ];
    stats.forEach((stat, i) => {
      if (!statCopy[i]) return;
      const b = stat.querySelector('b');
      const s = stat.querySelector('span');
      if (b) b.textContent = statCopy[i][0];
      if (s) s.textContent = statCopy[i][1];
    });

    // Category section.
    const head = document.querySelector('.sectionHead');
    if (head) {
      setText('.sectionHead .eyebrowText', 'محصول موردنظرت را پیدا کن');
      setText('.sectionHead .title', 'اول بگو برای چه کاری ابزار می‌خواهی.');
      setText('.sectionHead .lead', 'دسته مناسب را انتخاب کن، گزینه‌ها را ببین و قبل از تصمیم‌گیری مشخصات ابزار را بررسی کن.');
      const all = head.querySelector('.allLink');
      if (all) all.textContent = 'مشاهده کاتالوگ کامل ←';
    }

    const cats = document.querySelectorAll('.catGrid .cat');
    const categoryCopy = [
      ['01', 'ابزارهای پرکاربرد', 'برای تعمیرات، کارهای فنی و استفاده روزمره'],
      ['02', 'ابزار دستی', 'برای باز و بست، مونتاژ و تعمیرات دقیق‌تر'],
      ['03', 'تجهیزات کارگاهی', 'برای کارگاه، پروژه و کارهای تخصصی‌تر']
    ];
    cats.forEach((cat, i) => {
      const c = categoryCopy[i];
      if (!c) return;
      const small = cat.querySelector('small');
      const h = cat.querySelector('h3');
      const p = cat.querySelector('p');
      if (small) small.textContent = c[0];
      if (h) h.textContent = c[1];
      if (p) p.textContent = c[2];
    });

    // Choice guide: remove hesitation and offer three clear paths.
    let guide = document.getElementById('azim-choice-guide');
    if (!guide) {
      const ai = document.querySelector('.ai');
      guide = document.createElement('section');
      guide.id = 'azim-choice-guide';
      guide.className = 'section reveal visible';
      guide.innerHTML = `
        <div class="sectionHead">
          <div>
            <div class="eyebrowText">سه راه ساده برای شروع</div>
            <h2 class="title">الان دقیقاً کجای انتخابی؟</h2>
            <p class="lead">لازم نیست از بین صدها گزینه سردرگم شوی؛ از همان چیزی که می‌دانی شروع کن.</p>
          </div>
        </div>
        <div class="az-choice-grid">
          <a class="az-choice" href="/products">
            <span class="az-choice-num">01</span>
            <strong>اسم ابزار را می‌دانم</strong>
            <small>نام یا دسته ابزار را پیدا کن و مشخصات محصول را ببین.</small>
            <b>جست‌وجوی محصول ←</b>
          </a>
          <a class="az-choice" href="/products">
            <span class="az-choice-num">02</span>
            <strong>چند گزینه دارم</strong>
            <small>وارد کاتالوگ شو و گزینه‌های مناسب کارت را بررسی کن.</small>
            <b>دیدن گزینه‌ها ←</b>
          </a>
          <a class="az-choice" href="/ai">
            <span class="az-choice-num">03</span>
            <strong>فقط کاربردم را می‌دانم</strong>
            <small>کاری که می‌خواهی انجام بدهی را بگو و از دستیار هوشمند کمک بگیر.</small>
            <b>پرسیدن از AI ←</b>
          </a>
        </div>`;
      const anchor = ai || document.querySelector('footer');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(guide, anchor);
    }

    // AI section: direct problem/solution framing.
    const aiSection = document.querySelector('.ai');
    if (aiSection) {
      setText('.ai .eyebrowText', 'برای انتخاب ابزار گیر کردی؟');
      setText('.ai h2', 'کارَت را بگو؛ ابزار را با هم پیدا می‌کنیم.');
      setText('.ai p', 'از تعمیر و مونتاژ تا کارهای کارگاهی، کاربردت را توضیح بده تا دستیار هوشمند عظیم ابزار کمکت کند گزینه‌های مرتبط را راحت‌تر پیدا کنی.');
      const primary = aiSection.querySelector('.aiBtns .primary');
      const secondary = aiSection.querySelector('.aiBtns .glass');
      if (primary) primary.textContent = 'شروع راهنمایی با AI ←';
      if (secondary) secondary.textContent = 'مشاهده محصولات ←';
    }

    const note = document.querySelector('.note');
    if (note) note.innerHTML = '<strong>وقتت را با جست‌وجوی اشتباه هدر نده.</strong> اسم ابزار را داری؟ جست‌وجو کن. فقط کاربردش را می‌دانی؟ از دستیار هوشمند شروع کن.';

    // Footer microcopy.
    document.querySelectorAll('footer a').forEach((a) => {
      const t = a.textContent.trim();
      if (t.includes('محصولات')) a.textContent = 'کاتالوگ ابزار';
      else if (t.includes('دستیار')) a.textContent = 'دستیار انتخاب';
      else if (t.includes('ارتباط')) a.textContent = 'ارتباط با ما';
    });

    // Styling for the conversion section.
    if (!document.getElementById('az-choice-style')) {
      const style = document.createElement('style');
      style.id = 'az-choice-style';
      style.textContent = `
        #azim-choice-guide{padding-top:22px}
        #azim-choice-guide .sectionHead{margin-bottom:22px}
        .az-choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .az-choice{position:relative;min-height:205px;padding:24px;border:1px solid rgba(255,255,255,.09);border-radius:22px;background:linear-gradient(145deg,rgba(18,24,20,.94),rgba(7,10,8,.98));display:flex;flex-direction:column;align-items:flex-start;overflow:hidden;transition:.35s ease}
        .az-choice:before{content:"";position:absolute;inset:-45%;background:radial-gradient(circle at 75% 15%,rgba(245,185,0,.13),transparent 32%);pointer-events:none}
        .az-choice:hover{transform:translateY(-8px);border-color:rgba(245,185,0,.5);box-shadow:0 25px 58px rgba(0,0,0,.4)}
        .az-choice-num{color:#f5b900;font-size:9px;font-weight:900;letter-spacing:.8px;position:relative}
        .az-choice strong{font-size:20px;line-height:1.45;margin-top:16px;position:relative}
        .az-choice small{font-size:9px;line-height:2;color:#929b95;margin-top:9px;position:relative;max-width:320px}
        .az-choice b{margin-top:auto;padding-top:20px;color:#ffd84f;font-size:9px;position:relative}
        @media(max-width:800px){.az-choice-grid{grid-template-columns:1fr}.az-choice{min-height:165px}.az-choice strong{font-size:18px}}
      `;
      document.head.appendChild(style);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();