(() => {
  'use strict';
  if (window.__AZIM_PRODUCT_AI__) return;
  window.__AZIM_PRODUCT_AI__ = true;

  const api = () => String(window.AZIM_AI_API_URL || '').trim();
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
    return b + ' ' + v;
  }

  function robotSvg() {
    return '<svg class="az-ai-robot-svg" viewBox="0 0 44 44" fill="none" aria-hidden="true">' +
      '<path d="M11 12.5h22l-2.2-5H13.2l-2.2 5Z" fill="#d9f2ed"/>' +
      '<path d="M9.7 12.5h24.6v2.5H9.7z" fill="#9ed8cf"/>' +
      '<rect x="11.5" y="15" width="21" height="15" rx="5.5" fill="#b7d5d0"/>' +
      '<rect x="14" y="17.5" width="16" height="8.4" rx="4" fill="#18302d"/>' +
      '<circle class="az-ai-robot-eye" cx="19" cy="21.5" r="1.55" fill="#63efe2"/>' +
      '<circle class="az-ai-robot-eye" cx="25" cy="21.5" r="1.55" fill="#63efe2"/>' +
      '<path d="M20 24.6h4" stroke="#74ddd3" stroke-width="1.3" stroke-linecap="round"/>' +
      '<rect x="14.5" y="29" width="15" height="7" rx="2.6" fill="#6ca8a1"/>' +
      '<path d="M18.5 31.5h7" stroke="#c8f7f1" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path class="az-ai-robot-leg" d="M13 33.5 9.3 39" stroke="#a8c9c4" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path class="az-ai-robot-leg r" d="M31 33.5l3.7 5.5" stroke="#a8c9c4" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M12 28 6.5 32" stroke="#a8c9c4" stroke-width="2.6" stroke-linecap="round"/>' +
      '<g class="az-ai-robot-wave"><path d="M31 28.5 37 24.5" stroke="#b8dcd7" stroke-width="2.8" stroke-linecap="round"/><path d="M37 24.6c2 .5 2.7 2.1 2.3 3.3-.4 1.3-1.8 1.7-3 .7" stroke="#b8dcd7" stroke-width="2.4" stroke-linecap="round"/></g>' +
      '<g class="az-ai-robot-tool"><path d="M7 32 2.7 26.8" stroke="#d9b25a" stroke-width="2.3" stroke-linecap="round"/><path d="M2.7 26.8 1.8 23.6l2.7 1.3 1.1 2.7" stroke="#d9b25a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<circle class="az-ai-robot-spark" cx="35.5" cy="12" r="1.1" fill="#74eee2"/>' +
      '<circle class="az-ai-robot-spark" cx="7.3" cy="17.4" r=".9" fill="#74eee2"/>' +
    '</svg>';
  }

  let current = { id:'', code:'', name:'', variant:'' };

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
          '<div class="az-ai-modal-title"><strong id="azAiModalTitle">مشاوره ابزار</strong><small>راهنمای هوشمند محصول</small></div>' +
          '<button type="button" class="az-ai-modal-close" id="azAiModalClose" aria-label="بستن">×</button>' +
        '</div>' +
        '<div class="az-ai-modal-product" id="azAiModalProduct"></div>' +
        '<div class="az-ai-reply loading" id="azAiReply">در حال بررسی اطلاعات واقعی محصول…</div>' +
        '<div class="az-ai-quick" id="azAiQuick"></div>' +
        '<form class="az-ai-chat-form" id="azAiChatForm">' +
          '<input id="azAiQuestion" autocomplete="off" maxlength="600" placeholder="درباره این محصول سؤال داری؟">' +
          '<button type="submit">بپرس</button>' +
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
    const items = ['برای این کار مناسبه؟','چه نکته‌ای موقع انتخابش مهمه؟','بین سایزها کدوم مناسب‌تره؟'];
    q.innerHTML = items.map(x => '<button type="button" data-ai-q="' + esc(x) + '">' + esc(x) + '</button>').join('');
    q.querySelectorAll('[data-ai-q]').forEach(b => b.onclick = () => {
      root.querySelector('#azAiQuestion').value = b.dataset.aiQ;
      send();
    });
  }

  async function requestAI(message='') {
    const endpoint = api();
    if (!endpoint) throw Error('مسیر AI تنظیم نشده است.');
    const r = await fetch(endpoint, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        mode:'product',
        product_id:current.id,
        product_code:current.code,
        variant_label:current.variant,
        message:String(message || '').trim()
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(data.error || 'HTTP ' + r.status);
    return data;
  }

  async function open(btn) {
    const root = ensureModal();
    current = {
      id:btn.dataset.aiProductId || '',
      code:btn.dataset.aiProductCode || '',
      name:btn.dataset.aiBaseName || 'محصول',
      variant:btn.dataset.aiVariant || ''
    };
    const title = labelFor(current.name, current.variant);
    root.querySelector('#azAiModalTitle').textContent = title;
    root.querySelector('#azAiModalProduct').innerHTML = '<b>' + esc(title) + '</b> · اطلاعات محصول مستقیماً از دیتابیس خوانده می‌شود.';
    const reply = root.querySelector('#azAiReply');
    const status = root.querySelector('#azAiStatus');
    const input = root.querySelector('#azAiQuestion');
    reply.textContent = 'در حال بررسی اطلاعات واقعی محصول…';
    reply.classList.add('loading');
    status.textContent = '';
    status.classList.remove('error');
    input.value = '';
    setQuick();
    root.classList.add('show');
    root.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    try {
      const data = await requestAI('');
      reply.textContent = String(data.reply || 'پاسخی دریافت نشد.');
      reply.classList.remove('loading');
      status.textContent = 'پاسخ بر اساس اطلاعات همین محصول آماده شد.';
    } catch (e) {
      reply.textContent = 'برای این محصول فعلاً پاسخ هوشمند دریافت نشد.';
      reply.classList.remove('loading');
      status.textContent = String(e.message || e);
      status.classList.add('error');
    }
  }

  async function send() {
    const root = ensureModal();
    const input = root.querySelector('#azAiQuestion');
    const reply = root.querySelector('#azAiReply');
    const status = root.querySelector('#azAiStatus');
    const q = String(input.value || '').trim();
    if (!q) return;
    reply.textContent = 'در حال پاسخ‌گویی…';
    reply.classList.add('loading');
    status.textContent = '';
    status.classList.remove('error');
    try {
      const data = await requestAI(q);
      reply.textContent = String(data.reply || 'پاسخی دریافت نشد.');
      reply.classList.remove('loading');
      status.textContent = 'پاسخ بر اساس اطلاعات همین محصول آماده شد.';
      input.value = '';
    } catch (e) {
      reply.textContent = 'پاسخی برای این سؤال دریافت نشد.';
      reply.classList.remove('loading');
      status.textContent = String(e.message || e);
      status.classList.add('error');
    }
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
    const label = btn.querySelector('.az-ai-label');
    if (label) label.textContent = labelFor(btn.dataset.aiBaseName, variant) + '؟ من راهنماییت می‌کنم';
  });

  window.AZIM_PRODUCT_AI = { openFromElement:open, close, robotSvg, labelFor, hydrate };

  const grid = document.getElementById('grid');
  if (grid) new MutationObserver(hydrate).observe(grid, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate, { once:true });
  else hydrate();
})();
