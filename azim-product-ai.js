(() => {
  'use strict';
  if (window.__AZIM_PRODUCT_AI__) return;
  window.__AZIM_PRODUCT_AI__ = true;

  const MASCOT_SRC = './assets/ai/azim-mascot.webp';
  const AI_API = () => String(window.AZIM_AI_API_URL || '').trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
  const norm = s => String(s ?? '').trim().toLocaleLowerCase('fa')
    .replace(/[يى]/g,'ی').replace(/ك/g,'ک')
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g,' ');

  let current = { id:'', code:'', name:'', variant:'', variantIndex:-1 };
  let activeSourceButton = null;

  function mascotImg(cls=''){
    return '<img class="az-ai-robot-image ' + cls + '" src="' + MASCOT_SRC + '" alt="" aria-hidden="true">';
  }

  function labelFor(name, variant){
    return variant ? 'راهنمای محصول · ' + String(variant) : 'راهنمای محصول';
  }

  function stateButton(btn, state, duration){
    if (!btn) return;
    ['attention','click','thinking','answer','variant','notify'].forEach(x => btn.classList.remove('is-' + x));
    if (state) {
      btn.classList.add('is-' + state);
      btn.dataset.state = state;
    } else {
      btn.dataset.state = 'idle';
    }
    if (duration) {
      window.setTimeout(() => {
        if (btn.isConnected && (!state || btn.dataset.state === state)) {
          btn.classList.remove('is-' + state);
          btn.dataset.state = 'idle';
        }
      }, duration);
    }
  }

  function ensureButtonMarkup(btn){
    if (!btn) return;
    let icon = btn.querySelector('.az-ai-robot-icon');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'az-ai-robot-icon';
      btn.prepend(icon);
    }
    if (!icon.querySelector('img')) icon.insertAdjacentHTML('beforeend', mascotImg('is-ready'));
    let label = btn.querySelector('.az-ai-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'az-ai-label';
      btn.appendChild(label);
    }
    if (!label.textContent.trim()) label.textContent = 'راهنمای محصول';
    if (!btn.querySelector('.az-ai-state-dot')) {
      const dot = document.createElement('span');
      dot.className = 'az-ai-state-dot';
      btn.appendChild(dot);
    }
  }

  function readCardContext(btn){
    const card = btn?.closest('.card');
    const id = String(btn?.dataset?.aiProductId || '').trim();
    const code = String(btn?.dataset?.aiProductCode || '').trim().toUpperCase();
    const name = String(btn?.dataset?.aiBaseName || card?.querySelector('.name')?.textContent || 'محصول').trim();
    const select = card?.querySelector('select[data-id]');
    let variant = String(btn?.dataset?.aiVariant || '').trim();
    let variantIndex = -1;
    if (select) {
      variantIndex = Number.isInteger(Number(select.value)) ? Number(select.value) : -1;
      const option = select.selectedOptions?.[0];
      if (option) variant = String(option.textContent || '').split(' — ')[0].trim();
    }
    return { id, code, name, variant, variantIndex };
  }

  function readDetailContext(){
    const modal = document.getElementById('quickModal');
    if (!modal?.classList.contains('show')) return null;
    const title = String(document.getElementById('modalTitle')?.textContent || 'محصول').trim();
    const code = String(document.getElementById('modalCode')?.textContent || '').replace(/^.*?:\s*/,'').trim().toUpperCase();
    const rows = [...modal.querySelectorAll('.modal-variant-row')];
    const selected = rows.findIndex(x => x.classList.contains('selected'));
    const variant = selected >= 0 ? String(rows[selected]?.querySelector('strong')?.textContent || '').trim() : '';
    return { id:'', code, name:title, variant, variantIndex:selected };
  }

  function setButtonContext(btn, ctx){
    if (!btn || !ctx) return;
    btn.dataset.aiProductId = ctx.id || '';
    btn.dataset.aiProductCode = ctx.code || '';
    btn.dataset.aiBaseName = ctx.name || 'محصول';
    btn.dataset.aiVariant = ctx.variant || '';
    btn.dataset.aiVariantIndex = String(Number.isInteger(ctx.variantIndex) ? ctx.variantIndex : -1);
    ensureButtonMarkup(btn);
    const label = btn.querySelector('.az-ai-label');
    if (label) {
      label.textContent = labelFor(ctx.name, ctx.variant);
      label.title = ctx.variant ? 'این دستیار درباره همین مدل/سایز پاسخ می‌دهد' : 'این دستیار درباره همین محصول پاسخ می‌دهد';
    }
    btn.setAttribute('aria-label', ctx.variant ? 'راهنمای محصول ' + ctx.variant : 'راهنمای همین محصول');
  }

  function ensurePanel(){
    let root = document.getElementById('azProductAiModal');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'azProductAiModal';
    root.className = 'az-ai-modal-backdrop';
    root.setAttribute('aria-hidden','true');
    root.innerHTML =
      '<div class="az-ai-modal state-idle" role="dialog" aria-modal="true" aria-labelledby="azAiModalTitle">' +
        '<div class="az-ai-modal-head">' +
          '<div class="az-ai-modal-robot">' + mascotImg() + '</div>' +
          '<div class="az-ai-modal-title"><strong id="azAiModalTitle">راهنمای محصول</strong><small>دستیار هوشمند همان کالا و مدل انتخاب‌شده</small></div>' +
          '<button type="button" class="az-ai-modal-close" id="azAiModalClose" aria-label="بستن">×</button>' +
        '</div>' +
        '<div class="az-ai-modal-context">' +
          '<span class="az-ai-context-pill">محصول: <strong id="azAiContextProduct">—</strong></span>' +
          '<span class="az-ai-context-pill">مدل/سایز: <strong id="azAiContextVariant">انتخاب نشده</strong></span>' +
        '</div>' +
        '<div class="az-ai-reply loading" id="azAiReply">در حال بررسی اطلاعات واقعی همین محصول… <span class="az-ai-thinking-dots"><i></i><i></i><i></i></span></div>' +
        '<div class="az-ai-quick" id="azAiQuick"></div>' +
        '<form class="az-ai-chat-form" id="azAiChatForm">' +
          '<input id="azAiQuestion" autocomplete="off" maxlength="600" placeholder="درباره همین محصول سؤال داری؟">' +
          '<button type="submit">بپرس</button>' +
        '</form>' +
        '<div class="az-ai-status" id="azAiStatus"></div>' +
      '</div>';

    document.body.appendChild(root);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    root.querySelector('#azAiModalClose').addEventListener('click', close);
    root.querySelector('#azAiChatForm').addEventListener('submit', e => {
      e.preventDefault();
      send();
    });
    return root;
  }

  function updatePanelContext(root){
    const title = labelFor(current.name, current.variant);
    root.querySelector('#azAiModalTitle').textContent = title;
    root.querySelector('#azAiContextProduct').textContent = current.name || '—';
    root.querySelector('#azAiContextVariant').textContent = current.variant || 'انتخاب نشده';
  }

  function setPanelState(root, state){
    const panel = root?.querySelector('.az-ai-modal');
    if (!panel) return;
    panel.classList.remove('state-idle','state-thinking','state-answer','state-variant','state-attention');
    panel.classList.add('state-' + (state || 'idle'));
  }

  function setQuick(root){
    const box = root.querySelector('#azAiQuick');
    const items = [
      'برای این کار مناسبه؟',
      'چه نکته‌ای موقع انتخاب مهمه؟',
      'این سایز برای کار من مناسبه؟'
    ];
    box.innerHTML = items.map(x => '<button type="button" data-ai-q="' + esc(x) + '">' + esc(x) + '</button>').join('');
    box.querySelectorAll('[data-ai-q]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelector('#azAiQuestion').value = btn.dataset.aiQ || '';
        send();
      });
    });
  }

  async function requestAI(message=''){
    const endpoint = AI_API();
    if (!endpoint) throw Error('مسیر دستیار هوشمند تنظیم نشده است.');
    const body = {
      mode:'product',
      product_id:current.id,
      product_code:current.code,
      variant_label:current.variant,
      variant_index:current.variantIndex,
      message:String(message || '').trim()
    };
    const r = await fetch(endpoint, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(data.error || ('HTTP ' + r.status));
    return data;
  }

  function open(btn){
    ensureButtonMarkup(btn);
    current = btn?.classList.contains('az-ai-detail-launch')
      ? (readDetailContext() || readCardContext(btn))
      : readCardContext(btn);
    if (!current) return;

    activeSourceButton = btn || null;
    stateButton(btn, 'click', 460);

    const root = ensurePanel();
    updatePanelContext(root);
    setQuick(root);
    root.classList.add('show');
    root.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';

    const reply = root.querySelector('#azAiReply');
    const status = root.querySelector('#azAiStatus');
    const input = root.querySelector('#azAiQuestion');
    reply.innerHTML = 'در حال بررسی اطلاعات واقعی همین محصول… <span class="az-ai-thinking-dots"><i></i><i></i><i></i></span>';
    reply.classList.add('loading');
    status.textContent = '';
    status.className = 'az-ai-status';
    input.value = '';
    setPanelState(root,'thinking');
    if (btn) stateButton(btn,'thinking');

    requestAI('').then(data => {
      reply.textContent = String(data.reply || 'پاسخی دریافت نشد.');
      reply.classList.remove('loading');
      status.textContent = 'پاسخ بر اساس اطلاعات همین محصول و همین انتخاب آماده شد.';
      status.className = 'az-ai-status ok';
      setPanelState(root,'answer');
      if (btn) stateButton(btn,'answer',900);
      window.setTimeout(() => {
        if (root.classList.contains('show')) setPanelState(root,'idle');
      }, 900);
    }).catch(error => {
      reply.textContent = 'برای این محصول فعلاً پاسخ هوشمند دریافت نشد.';
      reply.classList.remove('loading');
      status.textContent = String(error?.message || error);
      status.className = 'az-ai-status error';
      setPanelState(root,'idle');
      if (btn) stateButton(btn,'idle');
    });
  }

  function close(){
    const root = document.getElementById('azProductAiModal');
    if (!root) return;
    root.classList.remove('show');
    root.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    activeSourceButton = null;
  }

  async function send(){
    const root = ensurePanel();
    const input = root.querySelector('#azAiQuestion');
    const reply = root.querySelector('#azAiReply');
    const status = root.querySelector('#azAiStatus');
    const q = String(input.value || '').trim();
    if (!q) return;
    reply.innerHTML = 'در حال پاسخ‌گویی… <span class="az-ai-thinking-dots"><i></i><i></i><i></i></span>';
    reply.classList.add('loading');
    status.textContent = '';
    status.className = 'az-ai-status';
    setPanelState(root,'thinking');
    if (activeSourceButton) stateButton(activeSourceButton,'thinking');

    try {
      const data = await requestAI(q);
      reply.textContent = String(data.reply || 'پاسخی دریافت نشد.');
      reply.classList.remove('loading');
      status.textContent = 'پاسخ بر اساس اطلاعات همین محصول آماده شد.';
      status.className = 'az-ai-status ok';
      setPanelState(root,'answer');
      if (activeSourceButton) stateButton(activeSourceButton,'answer',900);
      input.value = '';
      window.setTimeout(() => {
        if (root.classList.contains('show')) setPanelState(root,'idle');
      }, 900);
    } catch (error) {
      reply.textContent = 'پاسخی برای این سؤال دریافت نشد.';
      reply.classList.remove('loading');
      status.textContent = String(error?.message || error);
      status.className = 'az-ai-status error';
      setPanelState(root,'idle');
      if (activeSourceButton) stateButton(activeSourceButton,'idle');
    }
  }

  function bindButton(btn){
    if (!btn || btn.dataset.aiBound === '1') return;
    btn.dataset.aiBound = '1';
    ensureButtonMarkup(btn);
    btn.addEventListener('pointerenter', () => stateButton(btn,'attention',760));
    btn.addEventListener('focus', () => stateButton(btn,'attention',760));
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      open(btn);
    });
    if (!btn.classList.contains('az-ai-detail-launch')) {
      const ctx = readCardContext(btn);
      setButtonContext(btn, ctx);
    }
  }

  function hydrate(scope=document){
    scope.querySelectorAll?.('.az-product-ai-btn').forEach(bindButton);
  }

  function syncCardVariant(select){
    const card = select?.closest('.card');
    const btn = card?.querySelector('.az-product-ai-btn:not(.az-ai-detail-launch)');
    if (!btn) return;
    const ctx = readCardContext(btn);
    setButtonContext(btn, ctx);
    stateButton(btn,'variant',640);

    const root = document.getElementById('azProductAiModal');
    const matchesOpenContext = root?.classList.contains('show') &&
      current.code && ctx.code && current.code === ctx.code;
    if (matchesOpenContext) {
      current.variant = ctx.variant;
      current.variantIndex = ctx.variantIndex;
      updatePanelContext(root);
      setPanelState(root,'variant');
      window.setTimeout(() => {
        if (root.classList.contains('show')) setPanelState(root,'idle');
      }, 650);
    }
  }

  function ensureDetailCTA(){
    const modal = document.getElementById('quickModal');
    if (!modal) return;
    const actions = modal.querySelector('.modal-actions');
    if (!actions) return;
    let wrap = modal.querySelector('.az-ai-detail-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'az-ai-detail-wrap';
      wrap.innerHTML =
        '<button type="button" class="az-product-ai-btn az-ai-detail-launch" aria-label="راهنمای هوشمند همین محصول">' +
          '<span class="az-ai-robot-icon"></span>' +
          '<span class="az-ai-label">راهنمای محصول</span>' +
          '<span class="az-ai-state-dot"></span>' +
        '</button>' +
        '<span class="az-ai-detail-hint">پاسخ‌ها به محصول و سایز/مدل انتخاب‌شده همین صفحه متصل‌اند.</span>';
      actions.parentNode.insertBefore(wrap, actions);
    }
    const btn = wrap.querySelector('.az-ai-detail-launch');
    const ctx = readDetailContext();
    if (ctx) {
      setButtonContext(btn, ctx);
      bindButton(btn);
    }
  }

  function syncDetailCTA(){
    const modal = document.getElementById('quickModal');
    if (!modal?.classList.contains('show')) return;
    ensureDetailCTA();
    const ctx = readDetailContext();
    const btn = modal.querySelector('.az-ai-detail-launch');
    if (!ctx || !btn) return;
    setButtonContext(btn, ctx);

    const root = document.getElementById('azProductAiModal');
    if (root?.classList.contains('show') && current.code && ctx.code && current.code === ctx.code) {
      current.variant = ctx.variant;
      current.variantIndex = ctx.variantIndex;
      updatePanelContext(root);
    }
  }

  document.addEventListener('change', e => {
    const select = e.target.closest?.('select[data-id]');
    if (select) syncCardVariant(select);
  });

  document.addEventListener('click', e => {
    if (e.target.closest?.('.modal-variant-row')) {
      window.setTimeout(syncDetailCTA, 0);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });

  const grid = document.getElementById('grid');
  if (grid) new MutationObserver(m => {
    if (m.some(x => x.addedNodes?.length)) hydrate(grid);
  }).observe(grid,{childList:true,subtree:true});

  const quickModal = document.getElementById('quickModal');
  if (quickModal) {
    new MutationObserver(() => window.setTimeout(syncDetailCTA,0))
      .observe(quickModal,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  }

  function initialAttention(){
    try{
      if (sessionStorage.getItem('azim-ai-mascot-attention-v1')) return;
      sessionStorage.setItem('azim-ai-mascot-attention-v1','1');
      window.setTimeout(() => {
        const btn = document.querySelector('.az-product-ai-btn:not(.az-ai-detail-launch)');
        if (btn && btn.isConnected) stateButton(btn,'attention',760);
      }, 4800);
    }catch(_){}
  }

  window.AZIM_PRODUCT_AI = {
    openFromElement:open,
    close,
    robotMarkup:mascotImg,
    syncDetailCTA,
    readDetailContext
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      hydrate(document);
      syncDetailCTA();
      initialAttention();
    }, {once:true});
  } else {
    hydrate(document);
    syncDetailCTA();
    initialAttention();
  }
})();