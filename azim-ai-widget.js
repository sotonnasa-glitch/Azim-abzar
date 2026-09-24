(() => {
  'use strict';
  if (window.__AZIM_AI_WIDGET__) return;
  window.__AZIM_AI_WIDGET__ = true;

  const AI_PATH = './ai.html';

  const css = `
    /* استایل شکیل و لوکس دکمه شناور دستیار هوش مصنوعی هماهنگ با تم طلایی سایت */
    .az-ai-fab {
      position: fixed;
      right: 20px;
      bottom: 22px;
      z-index: 95;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(28, 30, 24, 0.95), rgba(14, 16, 14, 0.98));
      border: 1.5px solid rgba(245, 185, 0, 0.45);
      color: #ffd84f;
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: 0 14px 38px rgba(0, 0, 0, 0.65), 0 0 24px rgba(245, 185, 0, 0.28), inset 0 1px 2px rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.28s ease, border-color 0.28s ease;
      user-select: none;
    }

    .az-ai-fab:hover {
      transform: translateY(-4px) scale(1.08);
      border-color: #ffd84f;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.7), 0 0 32px rgba(245, 185, 0, 0.55), 0 0 20px rgba(255, 216, 79, 0.35);
    }

    .az-ai-fab:focus-visible {
      outline: 3px solid rgba(245, 185, 0, 0.5);
      outline-offset: 4px;
    }

    /* هاله‌های موجی و درخشان پیرامون دکمه شناور */
    .az-ai-fab::before,
    .az-ai-fab::after {
      content: "";
      position: absolute;
      inset: -6px;
      border: 1.5px solid rgba(245, 185, 0, 0.35);
      border-radius: 50%;
      animation: azAiFabWave 2.8s ease-out infinite;
      pointer-events: none;
    }

    .az-ai-fab::after {
      animation-delay: 1.4s;
      border-color: rgba(255, 216, 79, 0.25);
    }

    @keyframes azAiFabWave {
      0% { transform: scale(0.85); opacity: 0.8; }
      100% { transform: scale(1.42); opacity: 0; }
    }

    /* انیمیشن وکتور ستاره ۴‌پَر جیمینی و مدار کوانتومی با تم طلایی */
    .az-ai-fab-svg {
      width: 32px;
      height: 32px;
      overflow: visible;
    }

    .az-fab-orbit {
      transform-box: fill-box;
      transform-origin: center;
      animation: azFabOrbitSpin 4s linear infinite;
    }

    .az-fab-particle {
      transform-box: fill-box;
      transform-origin: center;
      animation: azFabOrbitSpin 4s linear infinite;
    }

    .az-fab-gemini-star {
      transform-box: fill-box;
      transform-origin: center;
      animation: azFabStarAlive 2.6s ease-in-out infinite;
      filter: drop-shadow(0 0 4px rgba(245, 185, 0, 0.7));
    }

    .az-fab-ministar {
      transform-box: fill-box;
      transform-origin: center;
      animation: azFabMiniTwinkle 1.8s ease-in-out infinite alternate;
    }

    @keyframes azFabOrbitSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes azFabStarAlive {
      0%, 100% {
        transform: scale(0.92) rotate(0deg);
        filter: drop-shadow(0 0 4px rgba(245, 185, 0, 0.65));
      }
      50% {
        transform: scale(1.15) rotate(16deg);
        filter: drop-shadow(0 0 10px rgba(255, 216, 79, 0.95)) drop-shadow(0 0 15px rgba(245, 185, 0, 0.8));
      }
    }

    @keyframes azFabMiniTwinkle {
      0% { transform: scale(0.7); opacity: 0.5; }
      100% { transform: scale(1.3); opacity: 1; filter: drop-shadow(0 0 6px #ffd84f); }
    }

    .az-ai-fab:hover .az-fab-orbit,
    .az-ai-fab:hover .az-fab-particle {
      animation-duration: 1.6s;
    }

    /* برچسب راهنمای شناور دستیار */
    .az-ai-fab-label {
      position: absolute;
      right: 70px;
      bottom: 12px;
      white-space: nowrap;
      padding: 7px 14px;
      border: 1px solid rgba(245, 185, 0, 0.45);
      border-radius: 12px;
      background: rgba(16, 18, 14, 0.96);
      color: #ffd84f;
      font: 800 12px Vazirmatn, Tahoma, sans-serif;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55), 0 0 18px rgba(245, 185, 0, 0.22);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      opacity: 0;
      transform: translateX(8px);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    .az-ai-fab:hover .az-ai-fab-label,
    .az-ai-fab:focus-visible .az-ai-fab-label {
      opacity: 1;
      transform: translateX(0);
    }

    @media (max-width: 700px) {
      .az-ai-fab {
        right: 16px;
        bottom: calc(16px + env(safe-area-inset-bottom));
        width: 52px;
        height: 52px;
      }
      .az-ai-fab-svg {
        width: 28px;
        height: 28px;
      }
      .az-ai-fab-label {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .az-ai-fab::before,
      .az-ai-fab::after,
      .az-fab-orbit,
      .az-fab-particle,
      .az-fab-gemini-star,
      .az-fab-ministar {
        animation: none !important;
      }
      .az-ai-fab, .az-ai-fab:hover {
        transform: none;
      }
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
    const path = (location.pathname || '').toLowerCase();
    return /(?:^|\/)(ai|ai\.html)(?:$|[?#\/])/i.test(path) ||
      path.includes('/ai') ||
      document.body?.dataset?.page === 'ai' ||
      !!document.querySelector('[data-page="ai"], .ai-assistant-page, #azim-ai-core-view');
  }

  function focusAiInput() {
    const input = document.getElementById('input');
    if (input) {
      input.focus({ preventScroll: false });
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function mountFab() {
    if (isAiPage()) {
      const existing = document.getElementById('azimAiFab');
      if (existing) existing.remove();
      return;
    }
    if (document.getElementById('azimAiFab')) return;

    const button = document.createElement('button');
    button.id = 'azimAiFab';
    button.type = 'button';
    button.className = 'az-ai-fab';
    button.setAttribute('aria-label', 'دستیار هوش مصنوعی عظیم ابزار');
    button.title = 'دستیار هوش مصنوعی عظیم ابزار';
    button.innerHTML = `
      <svg class="az-ai-fab-svg" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <!-- Rotating Quantum Orbit Ring -->
        <circle class="az-fab-orbit" cx="18" cy="18" r="14.5" stroke="url(#azFabGoldGrad)" stroke-width="1.3" stroke-dasharray="5 3.5" opacity="0.85"/>
        <circle class="az-fab-particle" cx="18" cy="3.5" r="2" fill="#ffd84f"/>
        <!-- 4-Point Curved Gemini AI Star -->
        <path class="az-fab-gemini-star" d="M18 5C18 12.18 12.18 18 5 18C12.18 18 18 23.82 18 31C18 23.82 23.82 18 31 18C23.82 18 18 12.18 18 5Z" fill="url(#azFabGoldGrad)"/>
        <!-- Companion Gemini Sparkle -->
        <path class="az-fab-ministar" d="M28 4C28 6.2 26.2 8 24 8C26.2 8 28 9.8 28 12C28 9.8 29.8 8 32 8C29.8 8 28 6.2 28 4Z" fill="#fff8db"/>
        <defs>
          <linearGradient id="azFabGoldGrad" x1="5" y1="5" x2="31" y2="31" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fff8db"/>
            <stop offset="45%" stop-color="#ffd84f"/>
            <stop offset="100%" stop-color="#f5b900"/>
          </linearGradient>
        </defs>
      </svg>
      <span class="az-ai-fab-label">دستیار هوشمند عظیم ابزار</span>
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

  function cleanUpBrokenHeroButton() {
    // پاکسازی کامل دکمه قبلی از بخش هیرو که در بنفش علامت زده شده بود
    document.querySelectorAll('.az-ai-home-btn').forEach(el => el.remove());
  }

  function removeHomeFloatingCart() {
    // فقط صفحه اصلی باید سبد شناور قدیمی را حذف کند؛ صفحات محصولات سبد شناور اختصاصی خودشان را نگه می‌دارند.
    if (!document.querySelector('#home')) return;
    const selectors = [
      '#floatingCart',
      '#floating-cart',
      '#cartFloating',
      '.floating-cart',
      '.floating-cart-button',
      '.cart-floating',
      '.az-floating-cart',
      '[data-floating-cart]',
      '[aria-label*="سبد خرید"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      if (el.id !== 'azimAiFab' && !el.closest('.az-ai-fab')) el.remove();
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  ready(() => {
    mountStyle();
    cleanUpBrokenHeroButton();
    removeHomeFloatingCart();
    mountFab();
  });
})();
