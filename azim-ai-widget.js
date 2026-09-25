(() => {
  'use strict';
  if (window.__AZIM_AI_WIDGET__) return;
  window.__AZIM_AI_WIDGET__ = true;

  const AI_PATH = './ai.html';
  const MASCOT_SRC = './assets/ai/azim-mascot.webp';

  const css = `
    .az-ai-fab{
      position:fixed;
      right:18px;
      bottom:20px;
      z-index:95;
      width:58px;height:58px;
      padding:3px;
      display:grid;
      place-items:center;
      border-radius:16px;
      border:1px solid rgba(245,185,0,.38);
      background:linear-gradient(180deg,rgba(24,28,24,.97),rgba(7,10,8,.99));
      color:#ffd84f;
      cursor:pointer;
      box-shadow:0 13px 34px rgba(0,0,0,.56),0 0 22px rgba(245,185,0,.10),inset 0 1px 0 rgba(255,255,255,.08);
      transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease;
      user-select:none;
      -webkit-tap-highlight-color:transparent;
    }
    .az-ai-fab:hover{
      transform:translateY(-3px) scale(1.025);
      border-color:rgba(255,216,79,.78);
      box-shadow:0 18px 40px rgba(0,0,0,.60),0 0 26px rgba(245,185,0,.16);
    }
    .az-ai-fab:focus-visible{outline:2px solid rgba(255,216,79,.78);outline-offset:3px}
    .az-ai-fab img{
      width:100%;height:100%;display:block;object-fit:contain;
      border-radius:13px;
      transform-origin:50% 72%;
      animation:azFabIdle 4.8s ease-in-out infinite;
    }
    .az-ai-fab.is-attention img{animation:azFabAttention .72s cubic-bezier(.2,.8,.2,1)}
    .az-ai-fab-label{
      position:absolute;
      right:69px;
      bottom:8px;
      white-space:nowrap;
      padding:7px 10px;
      border-radius:10px;
      border:1px solid rgba(245,185,0,.22);
      background:rgba(8,11,9,.96);
      color:#eadfae;
      font:800 10px Vazirmatn,Tahoma,sans-serif;
      opacity:0;
      transform:translateX(8px);
      pointer-events:none;
      transition:opacity .2s ease,transform .2s ease;
      box-shadow:0 10px 24px rgba(0,0,0,.42);
    }
    .az-ai-fab:hover .az-ai-fab-label,
    .az-ai-fab:focus-visible .az-ai-fab-label{opacity:1;transform:translateX(0)}
    @keyframes azFabIdle{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-1px) scale(1.016)}}
    @keyframes azFabAttention{0%,100%{transform:translateY(0) rotate(0)}35%{transform:translateY(-2px) rotate(-2.6deg)}70%{transform:translateY(0) rotate(1.3deg)}}
    @media(max-width:700px){
      .az-ai-fab{right:14px;bottom:calc(14px + env(safe-area-inset-bottom));width:52px;height:52px;border-radius:14px}
      .az-ai-fab img{border-radius:11px}
      .az-ai-fab-label{display:none}
    }
    @media(prefers-reduced-motion:reduce){
      .az-ai-fab img,.az-ai-fab.is-attention img{animation:none!important}
      .az-ai-fab,.az-ai-fab:hover{transform:none}
    }
  `;

  function mountStyle(){
    if (document.getElementById('azim-ai-widget-style')) return;
    const style=document.createElement('style');
    style.id='azim-ai-widget-style';
    style.textContent=css;
    document.head.appendChild(style);
  }

  function isAiPage(){
    const path=(location.pathname||'').toLowerCase();
    return /(?:^|\/)ai(?:\.html)?(?:$|[?#\/])/.test(path) ||
      path.includes('/ai') ||
      document.body?.dataset?.page==='ai' ||
      !!document.querySelector('[data-page="ai"], .ai-assistant-page, #azim-ai-core-view');
  }

  function isProductCatalogPage(){
    const path=(location.pathname||'').toLowerCase();
    return /(?:^|\/)products(?:-v\d+)?(?:\.html)?$/.test(path);
  }

  function focusAiInput(){
    const input=document.getElementById('input') || document.getElementById('chatInput');
    if (input) {
      input.focus({preventScroll:false});
      input.scrollIntoView({behavior:'smooth',block:'center'});
    }
  }

  function mountFab(){
    if (isProductCatalogPage()) return;
    if (isAiPage()) {
      document.getElementById('azimAiFab')?.remove();
      return;
    }
    if (document.getElementById('azimAiFab')) return;

    const button=document.createElement('button');
    button.id='azimAiFab';
    button.type='button';
    button.className='az-ai-fab';
    button.setAttribute('aria-label','دستیار هوشمند عظیم ابزار');
    button.title='دستیار هوشمند عظیم ابزار';
    button.innerHTML='<img src="' + MASCOT_SRC + '" alt="" aria-hidden="true"><span class="az-ai-fab-label">دستیار هوشمند عظیم ابزار</span>';

    button.addEventListener('mouseenter',()=>button.classList.add('is-attention'));
    button.addEventListener('mouseleave',()=>button.classList.remove('is-attention'));
    button.addEventListener('click',()=>{
      if (isAiPage()) focusAiInput();
      else location.href=AI_PATH;
    });

    document.body.appendChild(button);
    try{
      if (!sessionStorage.getItem('azim-ai-global-attention-v1')){
        sessionStorage.setItem('azim-ai-global-attention-v1','1');
        setTimeout(()=>button.classList.add('is-attention'),3800);
        setTimeout(()=>button.classList.remove('is-attention'),4550);
      }
    }catch(_){}
  }

  function removeHomeFloatingCart(){
    if (!document.querySelector('#home')) return;
    const selectors=[
      '#floatingCart','#floating-cart','#cartFloating','.floating-cart',
      '.floating-cart-button','.cart-floating','.az-floating-cart',
      '[data-floating-cart]','[aria-label*="سبد خرید"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el=>{
      if (el.id!=='azimAiFab' && !el.closest('.az-ai-fab')) el.remove();
    });
  }

  function ready(fn){
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  ready(()=>{
    mountStyle();
    removeHomeFloatingCart();
    mountFab();
  });
})();