(() => {
  'use strict';
  if (window.__AZIM_PRODUCT_AI__) return;
  window.__AZIM_PRODUCT_AI__ = true;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm = s => String(s ?? '').trim().toLocaleLowerCase('fa')
    .replace(/[يى]/g,'ی').replace(/ك/g,'ک')
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g,' ');

  function labelFor(base, variant) {
    const b = String(base || '').trim();
    const v = String(variant || '').trim();
    if (!v || norm(b) === norm(v) || norm(b).includes(norm(v))) return b;
    return b + ' (' + v + ')';
  }

  // وکتور اختصاصی فوق‌العاده زیبا و بامزه ربات مکانیک عظیم ابزار
  // مجهز به سایه‌روشن‌های لوکس متالیک، کلاهخود براق با آنتن طلایی، چشمان درخشان هوشمند با حالت لبخند،
  // دست آچاربه‌دست متحرک که روی پیچ کارگاهی کار می‌کنه و جرقه‌های فنی می‌زنه،
  // سپس سرش رو بالا میاره و با دست دیگه‌ش با صمیمیت تمام به مشتری دست تکان میده!
  function robotSvg() {
    return '<svg class="az-ai-robot-svg" viewBox="0 0 50 50" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<!-- گرادیان زره و بدنه متالیک تیره تیتانیومی -->' +
        '<linearGradient id="azBotArmor" x1="10" y1="5" x2="40" y2="48" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#3b4d45"/>' +
          '<stop offset="35%" stop-color="#24332c"/>' +
          '<stop offset="100%" stop-color="#121b16"/>' +
        '</linearGradient>' +
        '<!-- گرادیان طلایی لوکس صنعتی عظیم ابزار -->' +
        '<linearGradient id="azBotGold" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fff2a3"/>' +
          '<stop offset="40%" stop-color="#ffd84f"/>' +
          '<stop offset="85%" stop-color="#f5b900"/>' +
          '<stop offset="100%" stop-color="#c98a00"/>' +
        '</linearGradient>' +
        '<!-- گرادیان کروم براق آچار مکانیکی -->' +
        '<linearGradient id="azWrenchChrome" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#ffffff"/>' +
          '<stop offset="45%" stop-color="#e2e8f0"/>' +
          '<stop offset="80%" stop-color="#94a3b8"/>' +
          '<stop offset="100%" stop-color="#64748b"/>' +
        '</linearGradient>' +
        '<!-- شیشه ویزور تیره با انعکاس براق -->' +
        '<linearGradient id="azVisorGlass" x1="18" y1="10" x2="32" y2="20" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#0e1814"/>' +
          '<stop offset="100%" stop-color="#050a08"/>' +
        '</linearGradient>' +
        '<!-- فیلتر درخشش چشمان و جرقه‌ها -->' +
        '<filter id="azGlowEye" x="-20%" y="-20%" width="140%" height="140%">' +
          '<feGaussianBlur stdDeviation="0.8" result="blur"/>' +
          '<feMerge>' +
            '<feMergeNode in="blur"/>' +
            '<feMergeNode in="SourceGraphic"/>' +
          '</feMerge>' +
        '</filter>' +
      '</defs>' +

      '<!-- پایه‌ها و چکمه‌های آهنربایی مکانیک -->' +
      '<g class="az-robot-feet">' +
        '<rect x="15" y="38" width="6.5" height="4.5" rx="1.5" fill="#1b2520" stroke="#3d5047" stroke-width="0.8"/>' +
        '<rect x="28.5" y="38" width="6.5" height="4.5" rx="1.5" fill="#1b2520" stroke="#3d5047" stroke-width="0.8"/>' +
        '<path d="M14 42.5h8.5" stroke="url(#azBotGold)" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M27.5 42.5h8.5" stroke="url(#azBotGold)" stroke-width="1.4" stroke-linecap="round"/>' +
      '</g>' +

      '<!-- شاسی و بدنه ارگونومیک ربات -->' +
      '<g class="az-robot-torso">' +
        '<rect x="16.5" y="24" width="17" height="15" rx="4" fill="url(#azBotArmor)" stroke="#4a6156" stroke-width="1.1"/>' +
        '<!-- کمربند ابزار طلایی -->' +
        '<path d="M17 33.5h16" stroke="url(#azBotGold)" stroke-width="1.5" stroke-linecap="round"/>' +
        '<!-- راکتور یا هسته انرژی مرکزی سینه -->' +
        '<circle cx="25" cy="29" r="2.8" fill="#080e0b" stroke="url(#azBotGold)" stroke-width="0.9"/>' +
        '<circle class="az-robot-core-pulse" cx="25" cy="29" r="1.6" fill="#22d3ee" filter="url(#azGlowEye)"/>' +
        '<circle cx="25" cy="29" r="0.8" fill="#ffffff"/>' +
        '<!-- خطوط تهویه فنی سینه -->' +
        '<line x1="19.5" y1="26.5" x2="22" y2="26.5" stroke="#688075" stroke-width="0.8" stroke-linecap="round"/>' +
        '<line x1="28" y1="26.5" x2="30.5" y2="26.5" stroke="#688075" stroke-width="0.8" stroke-linecap="round"/>' +
      '</g>' +

      '<!-- مهره یا قطعه کارگاهی که ربات با آچار روی آن کار می‌کند -->' +
      '<g class="az-robot-workpiece">' +
        '<polygon points="6,38 10,35.5 14,38 14,43 10,45.5 6,43" fill="#23302a" stroke="url(#azBotGold)" stroke-width="1.1"/>' +
        '<circle cx="10" cy="40.5" r="1.8" fill="#0b110e" stroke="#40554b" stroke-width="0.7"/>' +
        '<circle cx="10" cy="40.5" r="0.9" fill="url(#azBotGold)"/>' +
      '</g>' +

      '<!-- جرقه‌های خیره‌کننده طلایی و سفید هنگام چرخاندن آچار -->' +
      '<g class="az-robot-sparks">' +
        '<line class="az-robot-spark s1" x1="8" y1="36" x2="5" y2="33.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>' +
        '<line class="az-robot-spark s2" x1="12" y1="36" x2="15" y2="33" stroke="#ffd84f" stroke-width="1.4" stroke-linecap="round"/>' +
        '<line class="az-robot-spark s3" x1="10" y1="44" x2="7.5" y2="47" stroke="#ffd84f" stroke-width="1.2" stroke-linecap="round"/>' +
        '<circle class="az-robot-spark s4" cx="10" cy="36" r="1.3" fill="#fff" filter="url(#azGlowEye)"/>' +
      '</g>' +

      '<!-- دست راست مکانیکی همراه با آچار متحرک (کار روی مهره) -->' +
      '<g class="az-robot-arm-wrench" style="transform-origin: 17.5px 26px;">' +
        '<path d="M17.5 26 C 14.5 28.5, 12.5 32.5, 11 36.5" stroke="#32443c" stroke-width="3.2" stroke-linecap="round"/>' +
        '<circle cx="17.5" cy="26" r="2.2" fill="url(#azBotGold)"/>' +
        '<!-- آچار کروم و طلا با فک دقیق -->' +
        '<g class="az-robot-wrench">' +
          '<line x1="11" y1="36.5" x2="6" y2="41.5" stroke="url(#azWrenchChrome)" stroke-width="2.6" stroke-linecap="round"/>' +
          '<line x1="9.8" y1="37.5" x2="12" y2="35.3" stroke="url(#azBotGold)" stroke-width="3" stroke-linecap="round"/>' +
          '<path d="M6.8 40.8 L 4.5 38.8 A 2 2 0 0 1 7.8 37.2 L 9.2 38.5" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" fill="none"/>' +
          '<circle cx="11" y="36.5" r="1.5" fill="url(#azBotGold)"/>' +
        '</g>' +
      '</g>' +

      '<!-- دست چپ مکانیکی (دست تکان دادن صمیمانه به مشتری) -->' +
      '<g class="az-robot-arm-wave" style="transform-origin: 32.5px 26px;">' +
        '<path d="M32.5 26 C 35 28.5, 37 32, 38 35.5" stroke="#32443c" stroke-width="3.2" stroke-linecap="round"/>' +
        '<circle cx="32.5" cy="26" r="2.2" fill="url(#azBotGold)"/>' +
        '<!-- پنجه دست ۳ انگشتی رباتیک شاداب -->' +
        '<g class="az-robot-hand">' +
          '<circle cx="38.5" cy="36" r="2.4" fill="url(#azBotGold)"/>' +
          '<line x1="37.2" y1="36.8" x2="36" y2="39.5" stroke="#ffd84f" stroke-width="1.2" stroke-linecap="round"/>' +
          '<line x1="38.8" y1="37.2" x2="38.8" y2="40.5" stroke="#ffd84f" stroke-width="1.2" stroke-linecap="round"/>' +
          '<line x1="40.4" y1="36.8" x2="41.6" y2="39.5" stroke="#ffd84f" stroke-width="1.2" stroke-linecap="round"/>' +
        '</g>' +
      '</g>' +

      '<!-- سر، کلاهخود محافظ و چشمان ال‌ای‌دی هوشمند -->' +
      '<g class="az-robot-head" style="transform-origin: 25px 22px;">' +
        '<!-- میله آنتن و چراغ چشمک‌زن روی سر -->' +
        '<line x1="25" y1="7" x2="25" y2="3.2" stroke="url(#azBotGold)" stroke-width="1.6" stroke-linecap="round"/>' +
        '<circle class="az-robot-antenna-tip" cx="25" cy="2.5" r="2" fill="#ffd84f" filter="url(#azGlowEye)"/>' +
        '<!-- پیچ و مهره‌های کناری کلاهخود (گوش‌های ربات) -->' +
        '<rect x="12.5" y="10.5" width="2.6" height="7.5" rx="1.3" fill="url(#azBotGold)"/>' +
        '<rect x="34.9" y="10.5" width="2.6" height="7.5" rx="1.3" fill="url(#azBotGold)"/>' +
        '<!-- پوسته کلاهخود محافظ مهندسی -->' +
        '<rect x="14.5" y="6.5" width="21" height="17" rx="5.5" fill="url(#azBotArmor)" stroke="#4a6156" stroke-width="1.3"/>' +
        '<!-- نوار طلایی پیشانی کلاهخود -->' +
        '<path d="M15.5 9h19" stroke="url(#azBotGold)" stroke-width="1.5" stroke-linecap="round"/>' +
        '<!-- ویزور شیشه‌ای براق مشکی -->' +
        '<rect x="17" y="10.5" width="16" height="10" rx="3.6" fill="url(#azVisorGlass)" stroke="#23352c" stroke-width="0.9"/>' +
        '<!-- بازتاب نور براق روی ویزور -->' +
        '<path d="M18.5 12c3-1.2 8-1.2 11 0" stroke="rgba(255,255,255,0.22)" stroke-width="0.8" stroke-linecap="round"/>' +

        '<!-- چشمان ال‌ای‌دی هوشمند در حالت عادی (متمرکز روی کار) -->' +
        '<g class="az-robot-eyes az-robot-eyes-normal">' +
          '<circle cx="21" cy="15.2" r="1.8" fill="#22d3ee" filter="url(#azGlowEye)"/>' +
          '<circle cx="29" cy="15.2" r="1.8" fill="#22d3ee" filter="url(#azGlowEye)"/>' +
          '<circle cx="21.6" cy="14.6" r="0.6" fill="#ffffff"/>' +
          '<circle cx="29.6" cy="14.6" r="0.6" fill="#ffffff"/>' +
        '</g>' +

        '<!-- چشمان خندان ال‌ای‌دی در حالت احوال‌پرسی با مشتری (^ _ ^) -->' +
        '<g class="az-robot-eyes az-robot-eyes-smile">' +
          '<path d="M19.5 16.2 C 20.5 14, 22 14, 23 16.2" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" fill="none" filter="url(#azGlowEye)"/>' +
          '<path d="M27 16.2 C 28 14, 29.5 14, 30.5 16.2" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" fill="none" filter="url(#azGlowEye)"/>' +
        '</g>' +

        '<!-- لبخند یا شیار تنفسی دیجیتال ربات -->' +
        '<path class="az-robot-mouth" d="M23 18.2c1 .7 3 .7 4 0" stroke="#ffd84f" stroke-width="1" stroke-linecap="round" fill="none"/>' +
      '</g>' +
    '</svg>';
  }

  let current = { id:'', code:'', name:'', variant:'' };

  // پایگاه دانش فنی محلی (آفلاین، سریع و پاسخگوی دقیق مشخصات هر کالا)
  function getLocalProductAdvice(code, name, variant, question = '') {
    const title = labelFor(name, variant);
    const q = norm(question);
    
    if (q.includes('قیمت') || q.includes('تخفیف') || q.includes('خرید') || q.includes('فاکتور')) {
      return `برای کالا «${title}» (کد ${code})، قیمت‌ها بر اساس جدول رسمی و سایزبندی انتخابی در سایت و سبد خرید قابل مشاهده است. همچنین برای خرید عمده، تخفیف همکاری و پیش‌فاکتور رسمی، می‌توانید با واحد فروش عظیم ابزار (۰۹۱۲-۲۳۹۴۵۹۷) تماس بگیرید.`;
    }
    if (q.includes('سایز') || q.includes('اندازه') || q.includes('کدوم') || q.includes('کدام')) {
      return `ابزار «${title}» دارای سایزبندی و درایو استاندارد مهندسی است. در کادر انتخاب سایز کارت محصول می‌توانید تمامی اندازه‌ها و مشخصات را بررسی کنید. توصیه می‌شود سایز را دقیقاً متناسب با پیچ و گشتاور مورد نیاز انتخاب نمایید.`;
    }
    if (q.includes('گارانتی') || q.includes('کیفیت') || q.includes('اصل') || q.includes('برند') || q.includes('آلیاژ')) {
      return `تمامی ابزارآلات عظیم ابزار از جمله «${title}» از آلیاژهای سخت‌کاری‌شده صنعتی مانند کروم-وانادیوم (Cr-V) و کروم-مولیبدن (Cr-Mo) با ضمانت اصالت فیزیکی و استانداردهای بین‌المللی DIN/ISO عرضه می‌شوند.`;
    }

    return `سلام! من مشاور فنی ابزار «${title}» (کد کالا: ${code}) هستم:\n` +
      `• آلیاژ و بدنه: استاندارد صنعتی مقاوم در برابر گشتاور و سایش کارگاهی.\n` +
      `• کاربرد اصلی: مکانیکی خودرویی، صنایع سنگین و کارگاه‌های فنی.\n` +
      `• وضعیت کاتالوگ: استخراج شده از کاتالوگ جامع ۹۰۸ قلمی عظیم ابزار.\n` +
      `• نحوه سفارش: می‌توانید مستقیماً کالا را به سبد خرید بیفزایید یا جهت مشاوره تخصصی با ۰۹۱۲-۲۳۹۴۵۹۷ تماس بگیرید.`;
  }

  function ensureModal() {
    let root = document.getElementById('azProductAiModal');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'azProductAiModal';
    root.className = 'az-ai-modal-backdrop';
    root.setAttribute('aria-hidden','true');
    root.innerHTML =
      '<div class="az-ai-modal" role="dialog" aria-modal="true" aria-labelledby="azAiModalTitle">' +
        '<div class="az-ai-modal-head">' +
          '<div class="az-ai-modal-robot">' + robotSvg() + '</div>' +
          '<div class="az-ai-modal-title"><strong id="azAiModalTitle">مشاوره تخصصی ابزار</strong><small>راهنمای هوشمند مکانیک عظیم ابزار</small></div>' +
          '<button type="button" class="az-ai-modal-close" id="azAiModalClose" aria-label="بستن">×</button>' +
        '</div>' +
        '<div class="az-ai-modal-product" id="azAiModalProduct"></div>' +
        '<div class="az-ai-reply" id="azAiReply">در حال بارگذاری مشخصات...</div>' +
        '<div class="az-ai-quick" id="azAiQuick"></div>' +
        '<form class="az-ai-chat-form" id="azAiChatForm">' +
          '<input id="azAiQuestion" autocomplete="off" maxlength="600" placeholder="سوالی درباره سایز، آلیاژ یا کاربرد این ابزار دارید؟">' +
          '<button type="submit">پرسش</button>' +
        '</form>' +
        '<div class="az-ai-status" id="azAiStatus"></div>' +
      '</div>';
    document.body.appendChild(root);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    root.querySelector('#azAiModalClose').onclick = close;
    root.querySelector('#azAiChatForm').onsubmit = e => { e.preventDefault(); send(); };
    return root;
  }

  function close() {
    const root = document.getElementById('azProductAiModal');
    if (!root) return;
    root.classList.remove('show');
    root.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  function setQuick() {
    const root = ensureModal();
    const q = root.querySelector('#azAiQuick');
    const items = ['برای چه کاری مناسب‌تره؟', 'بین سایزها کدوم انتخاب بشه؟', 'کیفیت آلیاژ و استاندارد'];
    q.innerHTML = items.map(x => '<button type="button" data-ai-q="' + esc(x) + '">' + esc(x) + '</button>').join('');
    q.querySelectorAll('[data-ai-q]').forEach(b => b.onclick = () => {
      root.querySelector('#azAiQuestion').value = b.dataset.aiQ;
      send();
    });
  }

  function open(btn) {
    const root = ensureModal();
    current = {
      id: btn.dataset.aiProductId || '',
      code: btn.dataset.aiProductCode || '',
      name: btn.dataset.aiBaseName || 'ابزار تخصصی',
      variant: btn.dataset.aiVariant || ''
    };
    const title = labelFor(current.name, current.variant);
    root.querySelector('#azAiModalTitle').textContent = title;
    root.querySelector('#azAiModalProduct').innerHTML = 'مشخصات فنی برای: <b>' + esc(title) + '</b> (کد: ' + esc(current.code || 'نامشخص') + ')';
    const reply = root.querySelector('#azAiReply');
    const status = root.querySelector('#azAiStatus');
    const input = root.querySelector('#azAiQuestion');
    
    reply.textContent = getLocalProductAdvice(current.code, current.name, current.variant, '');
    status.textContent = 'پاسخ فنی تخصصی بر اساس مشخصات رسمی کاتالوگ آماده است.';
    status.classList.remove('error');
    input.value = '';
    setQuick();
    root.classList.add('show');
    root.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }

  function send() {
    const root = ensureModal();
    const input = root.querySelector('#azAiQuestion');
    const reply = root.querySelector('#azAiReply');
    const status = root.querySelector('#azAiStatus');
    const q = String(input.value || '').trim();
    if (!q) return;

    reply.textContent = getLocalProductAdvice(current.code, current.name, current.variant, q);
    status.textContent = 'راهنمایی بر اساس سوال شما آماده شد.';
    status.classList.remove('error');
    input.value = '';
  }

  function hydrate() {
    document.querySelectorAll('.az-product-ai-btn .az-ai-robot-icon').forEach(el => {
      if (!el.innerHTML.trim()) el.innerHTML = robotSvg();
    });
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest?.('.az-product-ai-btn');
    if (btn) { e.preventDefault(); open(btn); }
  });

  document.addEventListener('change', e => {
    const select = e.target.closest?.('select[data-id]');
    if (!select) return;
    const card = select.closest('.card');
    const btn = card?.querySelector('.az-product-ai-btn');
    if (!btn) return;
    let variant = '';
    try {
      if (typeof window.__AZIM_GET_PRODUCT_VARIANT__ === 'function') {
        variant = window.__AZIM_GET_PRODUCT_VARIANT__(select.dataset.id, Number(select.value || 0)) || '';
      } else {
        variant = (select.selectedOptions?.[0]?.textContent || '').split(' — ')[0].trim();
      }
    } catch (_) {}
    btn.dataset.aiVariant = variant;
    const labelSpan = btn.querySelector('.az-ai-label span');
    if (labelSpan) labelSpan.textContent = labelFor(btn.dataset.aiBaseName, variant);
  });

  window.AZIM_PRODUCT_AI = { openFromElement:open, close, robotSvg, labelFor, hydrate };

  const grid = document.getElementById('grid');
  if (grid) new MutationObserver(hydrate).observe(grid, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate, { once:true });
  else hydrate();
})();
