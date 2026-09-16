(() => {
  if (window.__azimHomeCopyV4) return;
  window.__azimHomeCopyV4 = true;

  const text = (el, value) => { if (el) el.textContent = value; };
  const html = (el, value) => { if (el) el.innerHTML = value; };

  function injectSection(anchor, id, markup, css) {
    if (!anchor || document.getElementById(id)) return;
    const section = document.createElement('section');
    section.id = id;
    section.className = 'section reveal';
    section.innerHTML = markup;
    anchor.parentNode.insertBefore(section, anchor);
    if (css) {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  function mount() {
    document.title = 'عظیم ابزار | ابزار مناسب کارت را پیدا کن';

    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'عظیم ابزار؛ کاتالوگ ابزارهای مکانیکی، دستی و تعمیرگاهی با تصویر و مشخصات، همراه با دستیار هوشمند برای کمک به انتخاب ابزار مناسب.');

    html(document.querySelector('.hero .eyebrow'), '<i class="dot"></i> دنبال ابزار خاصی هستی؟ از همین‌جا شروع کن');
    html(document.querySelector('.hero h1'), 'ابزار مناسب کارت را،<br><span>سریع‌تر پیدا کن.</span>');
    text(document.querySelector('.hero p'), 'اسم ابزار را می‌دانی؟ مستقیم در کاتالوگ پیدایش کن. کاربردش را می‌دانی ولی اسمش را نه؟ از دستیار هوشمند کمک بگیر تا مسیر انتخابت کوتاه‌تر شود.');

    const heroButtons = document.querySelectorAll('.heroActions .btn');
    if (heroButtons[0]) heroButtons[0].textContent = 'جست‌وجوی ابزار در کاتالوگ ←';
    if (heroButtons[1]) heroButtons[1].textContent = 'نمی‌دانم کدام ابزار را بگیرم ←';

    const stats = document.querySelectorAll('.hero .stat span');
    if (stats[0]) stats[0].textContent = 'جست‌وجو و بررسی ابزار بر اساس دسته';
    if (stats[1]) stats[1].textContent = 'تصویر و مشخصات برای بررسی محصول';
    if (stats[2]) stats[2].textContent = 'کمک هوشمند برای شروع انتخاب';

    const firstHead = document.querySelector('.sectionHead');
    if (firstHead) {
      text(firstHead.querySelector('.eyebrowText'), 'از کجا شروع کنم؟');
      text(firstHead.querySelector('.title'), 'اول نیازت را مشخص کن؛ بعد برو سراغ ابزار.');
      text(firstHead.querySelector('.lead'), 'برای پیدا کردن ابزار لازم نیست همه محصولات را زیرورو کنی؛ از دسته و کاربرد شروع کن و مسیرت را کوتاه کن.');
      const all = firstHead.querySelector('.allLink');
      if (all) all.textContent = 'رفتن به کاتالوگ کامل ←';
    }

    const cards = document.querySelectorAll('.catGrid .cat');
    const categoryCopy = [
      ['01', 'برای تعمیر و کارهای فنی', 'ابزارهای مناسب برای کارهای روزمره، تعمیر و پروژه‌های فنی را از دسته مرتبط پیدا کن.'],
      ['02', 'ابزار دستی برای باز و بست', 'از پیچ‌گوشتی و انبر تا ابزارهای موردنیاز مونتاژ و تعمیر؛ دسته مناسب را انتخاب کن.'],
      ['03', 'برای کارگاه و پروژه', 'وقتی ابزار جدی‌تری لازم داری، دسته تجهیزات کارگاهی را ببین و مشخصات گزینه‌ها را بررسی کن.']
    ];
    cards.forEach((card, i) => {
      const item = categoryCopy[i];
      if (!item) return;
      text(card.querySelector('small'), item[0]);
      text(card.querySelector('h3'), item[1]);
      text(card.querySelector('p'), item[2]);
    });

    const note = document.querySelector('.note');
    if (note) html(note, '<strong>دو راه ساده داری:</strong> اسم ابزار را در کاتالوگ جست‌وجو کن، یا فقط کاربردت را برای AI توضیح بده تا از همان‌جا شروع کنی.');

    const aiSection = document.querySelector('.ai');
    if (aiSection) {
      text(aiSection.querySelector('.eyebrowText'), 'دستیار انتخاب ابزار');
      text(aiSection.querySelector('h2'), 'فقط کاربردت را بگو؛ ابزار را پیدا کن.');
      text(aiSection.querySelector('p'), 'مثلاً بگو «برای باز کردن این پیچ چه ابزاری لازم دارم؟» یا اسم قطعه و نوع کارت را توضیح بده. دستیار هوشمند عظیم ابزار کمکت می‌کند گزینه‌های مرتبط را راحت‌تر پیدا کنی.');
      const primary = aiSection.querySelector('.aiBtns .primary');
      const secondary = aiSection.querySelector('.aiBtns .glass');
      if (primary) primary.innerHTML = '<span class="btnIcon liveSpin"><svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg></span>شروع گفتگو با AI ←';
      if (secondary) secondary.textContent = 'رفتن به کاتالوگ';
    }

    const insertionAnchor = document.querySelector('.ai');
    injectSection(
      insertionAnchor,
      'azim-buy-steps',
      `
        <div class="sectionHead">
          <div>
            <div class="eyebrowText">سه قدم تا انتخاب</div>
            <h2 class="title">کمتر بگرد، دقیق‌تر انتخاب کن.</h2>
            <p class="lead">تجربه صفحه را روی نیاز واقعی مشتری چیدیم: پیدا کردن، بررسی کردن، تصمیم گرفتن.</p>
          </div>
        </div>
        <div class="az-step-grid">
          <div class="az-step"><span>01</span><strong>پیدا کن</strong><p>دسته ابزار یا نام محصول را جست‌وجو کن.</p></div>
          <div class="az-step"><span>02</span><strong>بررسی کن</strong><p>تصویر و مشخصات محصول را ببین.</p></div>
          <div class="az-step"><span>03</span><strong>انتخاب کن</strong><p>برای انتخاب متناسب با کارت، از AI کمک بگیر.</p></div>
        </div>`,
      `#azim-buy-steps{padding-top:10px;padding-bottom:50px}#azim-buy-steps .sectionHead{margin-bottom:20px}.az-step-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.az-step{padding:22px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:linear-gradient(145deg,rgba(18,23,20,.82),rgba(8,11,9,.92));min-height:150px;transition:.3s}.az-step:hover{transform:translateY(-6px);border-color:rgba(245,185,0,.4);box-shadow:0 20px 50px rgba(0,0,0,.28)}.az-step span{display:block;color:#f5b900;font-size:9px;font-weight:900}.az-step strong{display:block;font-size:19px;margin-top:16px}.az-step p{font-size:9px;color:#929b95;line-height:2;margin:8px 0 0}@media(max-width:800px){.az-step-grid{grid-template-columns:1fr}.az-step{min-height:125px}}`
    );

    document.querySelectorAll('.reveal').forEach((el) => {
      if (el.dataset.azimRevealBound) return;
      el.dataset.azimRevealBound = '1';
      requestAnimationFrame(() => el.classList.add('visible'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();