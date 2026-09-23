(() => {
  'use strict';
  if (window.__AZIM_AI_WIDGET__) return;
  window.__AZIM_AI_WIDGET__ = true;

  const AI_PATH = './ai.html';

  const css = `
    .az-ai-home-btn{position:relative}
    .az-ai-home-btn .az-ai-home-icon{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
    .az-ai-home-btn .az-ai-home-icon svg{width:22px;height:22px;overflow:visible}
    .az-ai-spark{transform-origin:50% 50%;animation:azAiSpark 2.2s ease-in-out infinite}
    .az-ai-core{animation:azAiCore 1.8s ease-in-out infinite}
    .az-ai-orbit{transform-origin:50% 50%;animation:azAiOrbit 3.8s linear infinite}
    @keyframes azAiSpark{0%,100%{transform:scale(.72) rotate(0deg);opacity:.65}50%{transform:scale(1.08) rotate(10deg);opacity:1;filter:drop-shadow(0 0 5px #ffd84f)}}
    @keyframes azAiCore{0%,100%{transform:scale(.9);opacity:.7}50%{transform:scale(1.22);opacity:1;filter:drop-shadow(0 0 6px #ffd84f)}}
    @keyframes azAiOrbit{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    .az-ai-fab{position:fixed;right:18px;bottom:18px;z-index:95;width:58px;height:58px;border:1px solid rgba(255,216,79,.72);border-radius:50%;background:radial-gradient(circle at 35% 28%,#ffe88a 0%,#f5b900 43%,#a96f00 100%);color:#10130f;display:grid;place-items:center;cursor:pointer;box-shadow:0 16px 38px rgba(0,0,0,.46),0 0 24px rgba(245,185,0,.25);transition:transform .28s ease,box-shadow .28s ease,border-color .28s ease}
    .az-ai-fab:hover{transform:translateY(-4px) scale(1.05);border-color:#fff2a5;box-shadow:0 20px 44px rgba(0,0,0,.5),0 0 30px rgba(245,185,0,.42)}
    .az-ai-fab:focus-visible{outline:3px solid rgba(245,185,0,.38);outline-offset:4px}
    .az-ai-fab::before,.az-ai-fab::after{content:"";position:absolute;inset:-7px;border:1px solid rgba(245,185,0,.18);border-radius:50%;animation:azAiRing 2.6s ease-out infinite;pointer-events:none}
    .az-ai-fab::after{animation-delay:1.3s}
    .az-ai-fab svg{width:27px;height:27px}
    .az-ai-fab .az-ai-bolt{animation:azAiCore 1.5s ease-in-out infinite}
    @keyframes azAiRing{0%{transform:scale(.85);opacity:.7}100%{transform:scale(1.45);opacity:0}}
    .az-ai-fab-label{position:absolute;right:69px;bottom:7px;white-space:nowrap;padding:7px 10px;border:1px solid rgba(245,185,0,.25);border-radius:10px;background:rgba(8,11,9,.94);color:#f5f6f4;font:800 11px Vazirmatn,Tahoma,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.35);opacity:0;transform:translateX(6px);pointer-events:none;transition:opacity .2s ease,transform .2s ease}
    .az-ai-fab:hover .az-ai-fab-label,.az-ai-fab:focus-visible .az-ai-fab-label{opacity:1;transform:translateX(0)}
    @media(max-width:700px){
      .az-ai-fab{right:14px;bottom:calc(14px + env(safe-area-inset-bottom));width:54px;height:54px}
      .az-ai-fab-label{display:none}
    }
    @media(prefers-reduced-motion:reduce){
      .az-ai-fab::before,.az-ai-fab::after,.az-ai-spark,.az-ai-core,.az-ai-orbit{animation:none!important}
      .az-ai-fab,.az-ai-fab:hover{transform:none}
    }
  `;

  function mountStyle() {
    if (document.getElementById('azim-ai-widget-style')) return;
    const style = document.createElement('style');
    style.id = 'azim-ai-widget-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function isAiPage() {
    return /(?:^|\/)ai\.html(?:$|[?#])/i.test(location.pathname + location.search);
  }

  function focusAiInput() {
    const input = document.getElementById('input');
    if (input) {
      input.focus({preventScroll:false});
      input.scrollIntoView({behavior:'smooth',block:'center'});
    }
  }

  function mountFab() {
    if (document.getElementById('azimAiFab')) return;
    const button = document.createElement('button');
    button.id = 'azimAiFab';
    button.type = 'button';
    button.className = 'az-ai-fab';
    button.setAttribute('aria-label', 'باز کردن دستیار هوشمند عظیم ابزار');
    button.title = 'دستیار هوشمند عظیم ابزار';
    button.innerHTML = `
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="12.5" stroke="#161a15" stroke-width="1.4" opacity=".32"/>
        <path class="az-ai-orbit" d="M7.5 16c0-5.1 3.8-9.4 8.5-9.4 2.2 0 4.2.8 5.7 2.2" stroke="#fff7cf" stroke-width="1.7" stroke-linecap="round" opacity=".72"/>
        <path class="az-ai-orbit" d="M24.5 16c0 5.1-3.8 9.4-8.5 9.4-2.2 0-4.2-.8-5.7-2.2" stroke="#fff7cf" stroke-width="1.7" stroke-linecap="round" opacity=".72"/>
        <path class="az-ai-bolt" d="M18 7.8 10.9 17h4.8l-1.3 7.2L21.1 15h-4.8L18 7.8Z" fill="#161a15"/>
        <circle cx="24.2" cy="7.8" r="1.4" fill="#fff"/>
      </svg>
      <span class="az-ai-fab-label">دستیار هوشمند</span>
    `;
    button.addEventListener('click', () => {
      if (isAiPage()) {
        focusAiInput();
      } else {
        location.href = AI_PATH;
      }
    });
    document.body.appendChild(button);
  }

  function mountHomeButton() {
    if (!document.querySelector('#home')) return;
    const actions = document.querySelector('#home .hero .actions');
    if (!actions || actions.querySelector('.az-ai-home-btn')) return;
    const a = document.createElement('a');
    a.className = 'btn secondary az-ai-home-btn';
    a.href = AI_PATH;
    a.setAttribute('aria-label', 'باز کردن دستیار هوشمند عظیم ابزار');
    a.innerHTML = `
      <span class="az-ai-home-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.4" stroke="#ffd84f" stroke-width="1.4" opacity=".42"/>
          <path class="az-ai-orbit" d="M5.4 12c0-3.8 2.8-6.9 6.5-6.9 1.8 0 3.4.7 4.7 1.8" stroke="#ffeaa7" stroke-width="1.45" stroke-linecap="round"/>
          <path class="az-ai-orbit" d="M18.6 12c0 3.8-2.8 6.9-6.5 6.9-1.8 0-3.4-.7-4.7-1.8" stroke="#ffeaa7" stroke-width="1.45" stroke-linecap="round"/>
          <path class="az-ai-core" d="m13.6 5.9-5.2 6.8h3.4l-.8 5.4 5.4-7.2H13l.6-5Z" fill="#ffd84f"/>
        </svg>
      </span>
      <span>دستیار هوش مصنوعی</span>
      <span class="az-arrow">←</span>
    `;
    const contact = actions.querySelector('a[href*="contact.html"]');
    if (contact && contact.nextSibling) actions.insertBefore(a, contact.nextSibling);
    else actions.appendChild(a);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  ready(() => {
    mountStyle();
    mountHomeButton();
    mountFab();
  });
})();