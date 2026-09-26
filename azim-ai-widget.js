(() => {
  'use strict';
  if (window.__AZIM_AI_WIDGET_LOADED__) return;
  window.__AZIM_AI_WIDGET_LOADED__ = true;

  // اگر کاربر در خود صفحه اختصاصی هوش مصنوعی باشد، دکمه شناور نشان داده نمی‌شود
  if (window.location.pathname.endsWith('ai.html') || window.location.href.includes('ai.html')) {
    return;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // وکتور اختصاصی و فوق‌العاده جذاب ربات مکانیک عظیم ابزار
  function miniRobotSvg() {
    return '<svg class="az-fab-robot-svg" viewBox="0 0 50 50" fill="none" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="azFabBotArmor" x1="10" y1="5" x2="40" y2="48" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#3b4d45"/>' +
          '<stop offset="35%" stop-color="#24332c"/>' +
          '<stop offset="100%" stop-color="#121b16"/>' +
        '</linearGradient>' +
        '<linearGradient id="azFabGold" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#fff2a3"/>' +
          '<stop offset="40%" stop-color="#ffd84f"/>' +
          '<stop offset="85%" stop-color="#f5b900"/>' +
          '<stop offset="100%" stop-color="#c98a00"/>' +
        '</linearGradient>' +
        '<linearGradient id="azFabChrome" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0%" stop-color="#ffffff"/>' +
          '<stop offset="60%" stop-color="#cbd5e1"/>' +
          '<stop offset="100%" stop-color="#64748b"/>' +
        '</linearGradient>' +
        '<filter id="azFabGlow" x="-20%" y="-20%" width="140%" height="140%">' +
          '<feGaussianBlur stdDeviation="0.8" result="b"/>' +
          '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
      '</defs>' +
      '<!-- چکمه‌ها -->' +
      '<rect x="15" y="38" width="6.5" height="4.5" rx="1.5" fill="#1b2520" stroke="#3d5047" stroke-width="0.8"/>' +
      '<rect x="28.5" y="38" width="6.5" height="4.5" rx="1.5" fill="#1b2520" stroke="#3d5047" stroke-width="0.8"/>' +
      '<path d="M14 42.5h8.5" stroke="url(#azFabGold)" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M27.5 42.5h8.5" stroke="url(#azFabGold)" stroke-width="1.4" stroke-linecap="round"/>' +
      '<!-- تنه -->' +
      '<rect x="16.5" y="24" width="17" height="15" rx="4" fill="url(#azFabBotArmor)" stroke="#4a6156" stroke-width="1.1"/>' +
      '<path d="M17 33.5h16" stroke="url(#azFabGold)" stroke-width="1.5" stroke-linecap="round"/>' +
      '<circle cx="25" cy="29" r="2.6" fill="#080e0b" stroke="url(#azFabGold)" stroke-width="0.8"/>' +
      '<circle class="az-fab-core" cx="25" cy="29" r="1.5" fill="#22d3ee" filter="url(#azFabGlow)"/>' +
      '<!-- مهره کارگاهی -->' +
      '<polygon points="6,38 10,35.5 14,38 14,43 10,45.5 6,43" fill="#23302a" stroke="url(#azFabGold)" stroke-width="1.1"/>' +
      '<circle cx="10" cy="40.5" r="1.5" fill="#0b110e"/>' +
      '<!-- جرقه‌های کارگاهی حین چرخاندن آچار -->' +
      '<g class="az-fab-sparks">' +
        '<line class="az-fab-spark s1" x1="8" y1="36" x2="5" y2="33.5" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>' +
        '<line class="az-fab-spark s2" x1="12" y1="36" x2="15" y2="33" stroke="#ffd84f" stroke-width="1.4" stroke-linecap="round"/>' +
      '</g>' +
      '<!-- دست راست با آچار -->' +
      '<g class="az-fab-arm-wrench">' +
        '<path d="M17.5 26 C 14.5 28.5, 12.5 32.5, 11 36.5" stroke="#32443c" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="17.5" cy="26" r="2" fill="url(#azFabGold)"/>' +
        '<line x1="11" y1="36.5" x2="6" y2="41.5" stroke="url(#azFabChrome)" stroke-width="2.6" stroke-linecap="round"/>' +
        '<line x1="9.8" y1="37.5" x2="12" y2="35.3" stroke="url(#azFabGold)" stroke-width="2.8" stroke-linecap="round"/>' +
        '<path d="M6.8 40.8 L 4.5 38.8 A 2 2 0 0 1 7.8 37.2 L 9.2 38.5" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>' +
      '</g>' +
      '<!-- دست چپ احوال‌پرسی -->' +
      '<g class="az-fab-arm-wave">' +
        '<path d="M32.5 26 C 35 28.5, 37 32, 38 35.5" stroke="#32443c" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="32.5" cy="26" r="2" fill="url(#azFabGold)"/>' +
        '<circle cx="38.5" cy="36" r="2.3" fill="url(#azFabGold)"/>' +
        '<line x1="37.2" y1="36.8" x2="36" y2="39.5" stroke="#ffd84f" stroke-width="1.1" stroke-linecap="round"/>' +
        '<line x1="38.8" y1="37.2" x2="38.8" y2="40.5" stroke="#ffd84f" stroke-width="1.1" stroke-linecap="round"/>' +
        '<line x1="40.4" y1="36.8" x2="41.6" y2="39.5" stroke="#ffd84f" stroke-width="1.1" stroke-linecap="round"/>' +
      '</g>' +
      '<!-- سر و کلاهخود -->' +
      '<g class="az-fab-head">' +
        '<line x1="25" y1="7" x2="25" y2="3.2" stroke="url(#azFabGold)" stroke-width="1.6" stroke-linecap="round"/>' +
        '<circle class="az-fab-antenna" cx="25" cy="2.5" r="2" fill="#ffd84f" filter="url(#azFabGlow)"/>' +
        '<rect x="12.5" y="10.5" width="2.6" height="7.5" rx="1.3" fill="url(#azFabGold)"/>' +
        '<rect x="34.9" y="10.5" width="2.6" height="7.5" rx="1.3" fill="url(#azFabGold)"/>' +
        '<rect x="14.5" y="6.5" width="21" height="17" rx="5.5" fill="url(#azFabBotArmor)" stroke="#4a6156" stroke-width="1.3"/>' +
        '<path d="M15.5 9h19" stroke="url(#azFabGold)" stroke-width="1.5" stroke-linecap="round"/>' +
        '<rect x="17" y="10.5" width="16" height="10" rx="3.6" fill="#0b1310" stroke="#23352c" stroke-width="0.8"/>' +
        '<!-- چشم‌های نورانی -->' +
        '<g class="az-fab-eyes-normal">' +
          '<circle cx="21" cy="15.2" r="1.8" fill="#22d3ee" filter="url(#azFabGlow)"/>' +
          '<circle cx="29" cy="15.2" r="1.8" fill="#22d3ee" filter="url(#azFabGlow)"/>' +
          '<circle cx="21.6" cy="14.6" r="0.6" fill="#ffffff"/>' +
          '<circle cx="29.6" cy="14.6" r="0.6" fill="#ffffff"/>' +
        '</g>' +
        '<g class="az-fab-eyes-smile">' +
          '<path d="M19.5 16.2 C 20.5 14, 22 14, 23 16.2" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" fill="none" filter="url(#azFabGlow)"/>' +
          '<path d="M27 16.2 C 28 14, 29.5 14, 30.5 16.2" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" fill="none" filter="url(#azFabGlow)"/>' +
        '</g>' +
        '<path d="M23 18.2c1 .7 3 .7 4 0" stroke="#ffd84f" stroke-width="1" stroke-linecap="round" fill="none"/>' +
      '</g>' +
    '</svg>';
  }

  // تزریق استایل‌های اختصاصی و لوکس ویجت شناور
  function injectStyles() {
    if (document.getElementById('azim-ai-widget-style')) return;
    const style = document.createElement('style');
    style.id = 'azim-ai-widget-style';
    style.textContent = `
      /* دکمه شناور هوش مصنوعی عظیم ابزار */
      #azimAiFab {
        position: fixed;
        bottom: 24px;
        right: 22px;
        z-index: 9998;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px 6px 8px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(22, 29, 25, 0.97) 0%, rgba(10, 15, 12, 0.99) 100%);
        border: 1.5px solid rgba(245, 185, 0, 0.45);
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.65), 0 0 22px rgba(245, 185, 0, 0.28);
        color: #fff;
        cursor: pointer;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        user-select: none;
        transition: transform 0.26s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.26s ease, border-color 0.26s ease;
        animation: azFabFloat 4s ease-in-out infinite alternate;
      }

      #azimAiFab:hover {
        transform: translateY(-3px) scale(1.03);
        border-color: #ffd84f;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75), 0 0 28px rgba(245, 185, 0, 0.45);
      }

      #azimAiFab:active {
        transform: scale(0.97);
      }

      @keyframes azFabFloat {
        0% { transform: translateY(0px); }
        100% { transform: translateY(-5px); }
      }

      /* آیکون ربات درون دکمه شناور */
      .az-fab-icon-box {
        width: 44px;
        height: 44px;
        flex: 0 0 44px;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 35%, rgba(36, 50, 43, 0.9), rgba(9, 14, 11, 0.98));
        border: 1.5px solid rgba(245, 185, 0, 0.5);
        display: grid;
        place-items: center;
        box-shadow: 0 0 12px rgba(245, 185, 0, 0.25);
        position: relative;
        overflow: visible;
      }

      .az-fab-robot-svg {
        width: 38px;
        height: 38px;
        overflow: visible;
      }

      /* انیمیشن‌های ربات دکمه شناور */
      .az-fab-arm-wrench {
        transform-box: view-box;
        transform-origin: 17.5px 26px;
        animation: azWrenchWork 4.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      .az-fab-arm-wave {
        transform-box: view-box;
        transform-origin: 32.5px 26px;
        animation: azWaveHand 4.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      #azimAiFab:hover .az-fab-arm-wave {
        animation: azWaveHover 0.7s ease-in-out infinite alternate !important;
      }
      #azimAiFab:hover .az-fab-arm-wrench {
        animation: none !important;
        transform: rotate(12deg) !important;
      }
      .az-fab-head {
        transform-box: view-box;
        transform-origin: 25px 22px;
        animation: azHeadFocus 4.6s ease-in-out infinite;
      }
      #azimAiFab:hover .az-fab-head {
        transform: rotate(4deg) translateY(-1px) !important;
        animation: none !important;
      }
      .az-fab-eyes-normal {
        animation: azEyesNormalAnim 4.6s ease-in-out infinite;
      }
      .az-fab-eyes-smile {
        animation: azEyesSmileAnim 4.6s ease-in-out infinite;
        opacity: 0;
      }
      #azimAiFab:hover .az-fab-eyes-normal { opacity: 0 !important; }
      #azimAiFab:hover .az-fab-eyes-smile { opacity: 1 !important; }
      .az-fab-spark {
        transform-origin: 10px 38px;
        animation: azSparks 4.6s ease-out infinite;
      }
      .az-fab-spark.s2 { animation-delay: 0.12s; }
      .az-fab-antenna { animation: azAntennaPulse 4.6s ease-in-out infinite; }
      .az-fab-core { animation: azCorePulse 2.4s ease-in-out infinite alternate; }

      /* نوشته‌ها و متون دکمه شناور */
      .az-fab-info {
        display: flex;
        flex-direction: column;
        text-align: right;
        gap: 2px;
      }

      .az-fab-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .az-fab-title {
        font: 800 12.5px/1.2 'Vazirmatn', Tahoma, sans-serif;
        color: #ffd84f;
        letter-spacing: -0.2px;
      }

      .az-fab-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 1px 6px;
        border-radius: 999px;
        background: rgba(16, 185, 129, 0.18);
        border: 1px solid rgba(16, 185, 129, 0.35);
        color: #34d399;
        font: 700 9px/1 'Vazirmatn', sans-serif;
      }

      .az-fab-pulse {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 6px #10b981;
        animation: azDotPulse 1.8s ease-in-out infinite;
      }

      @keyframes azDotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.3); }
      }

      .az-fab-subtitle {
        font: 600 10.5px/1 'Vazirmatn', sans-serif;
        color: #9eb0a8;
      }

      /* پنخره پاپ‌آپ مشاوره سریع هوش مصنوعی */
      #azAiQuickModal {
        position: fixed;
        bottom: 90px;
        right: 22px;
        z-index: 9999;
        width: min(380px, calc(100vw - 32px));
        max-height: min(600px, calc(100vh - 110px));
        overflow-y: auto;
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(20, 26, 23, 0.99) 0%, rgba(9, 13, 11, 0.995) 100%);
        border: 1.5px solid rgba(245, 185, 0, 0.45);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(245, 185, 0, 0.2);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: none;
        flex-direction: column;
        color: #f0f6f3;
        font-family: 'Vazirmatn', Tahoma, sans-serif;
        transform-origin: bottom right;
        animation: azModalPop 0.26s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      #azAiQuickModal.open {
        display: flex;
      }

      @keyframes azModalPop {
        0% { opacity: 0; transform: scale(0.85) translateY(20px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }

      .az-modal-header {
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid rgba(245, 185, 0, 0.2);
        background: rgba(255, 216, 79, 0.05);
      }

      .az-modal-header .az-fab-icon-box {
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
      }

      .az-modal-header .az-fab-robot-svg {
        width: 32px;
        height: 32px;
      }

      .az-modal-header-info {
        flex: 1;
        min-width: 0;
        text-align: right;
      }

      .az-modal-header-info strong {
        display: block;
        font-size: 13px;
        font-weight: 800;
        color: #ffd84f;
      }

      .az-modal-header-info small {
        display: block;
        color: #9eb0a8;
        font-size: 10px;
      }

      .az-modal-close-btn {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        color: #dbe7e2;
        cursor: pointer;
        display: grid;
        place-items: center;
        font-size: 18px;
        transition: all 0.2s;
      }

      .az-modal-close-btn:hover {
        background: rgba(255, 80, 80, 0.25);
        color: #ff9a9a;
        border-color: rgba(255, 80, 80, 0.4);
      }

      .az-modal-body {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        text-align: right;
      }

      /* دکمه ورود به صفحه اختصاصی هوش مصنوعی */
      .az-full-ai-link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(245, 185, 0, 0.2) 0%, rgba(245, 185, 0, 0.08) 100%);
        border: 1.5px solid rgba(245, 185, 0, 0.45);
        color: #fff;
        text-decoration: none;
        font-size: 11.5px;
        font-weight: 800;
        box-shadow: 0 4px 14px rgba(245, 185, 0, 0.12);
        transition: all 0.22s;
      }

      .az-full-ai-link:hover {
        background: linear-gradient(135deg, rgba(245, 185, 0, 0.3) 0%, rgba(245, 185, 0, 0.15) 100%);
        border-color: #ffd84f;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(245, 185, 0, 0.25);
      }

      .az-full-ai-link span b {
        color: #ffd84f;
        display: block;
        font-size: 12px;
      }

      .az-full-ai-link span small {
        color: #dbe7e2;
        font-size: 10px;
        font-weight: 500;
      }

      .az-full-ai-link svg {
        flex-shrink: 0;
        stroke: #ffd84f;
      }

      /* سوالات پرتکرار */
      .az-quick-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .az-quick-chip {
        padding: 6px 10px;
        border-radius: 8px;
        background: rgba(245, 185, 0, 0.08);
        border: 1px solid rgba(245, 185, 0, 0.22);
        color: #ffd84f;
        font-size: 10.5px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        text-align: right;
      }

      .az-quick-chip:hover {
        background: rgba(245, 185, 0, 0.22);
        border-color: #ffd84f;
        transform: translateY(-1px);
      }

      /* کادر پاسخ سریع هوشمند */
      .az-quick-answer-box {
        padding: 12px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(245, 185, 0, 0.18);
        color: #f0f6f3;
        font-size: 11px;
        line-height: 1.85;
        white-space: pre-wrap;
        display: none;
      }

      .az-quick-answer-box.active {
        display: block;
      }

      /* فرم پرسش سریع در داخل ویجت */
      .az-widget-form {
        display: flex;
        gap: 6px;
        margin-top: 4px;
      }

      .az-widget-input {
        flex: 1;
        min-width: 0;
        height: 38px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: #090e0c;
        color: #fff;
        padding: 0 12px;
        font: 700 11px 'Vazirmatn';
        outline: none;
        transition: border-color 0.2s;
      }

      .az-widget-input:focus {
        border-color: #ffd84f;
        box-shadow: 0 0 10px rgba(245, 185, 0, 0.2);
      }

      .az-widget-submit {
        height: 38px;
        padding: 0 14px;
        border-radius: 10px;
        border: 1px solid rgba(245, 185, 0, 0.45);
        background: linear-gradient(135deg, #ffd84f, #f5b900);
        color: #0b110e;
        font: 800 11px 'Vazirmatn';
        cursor: pointer;
        transition: all 0.2s;
      }

      .az-widget-submit:hover {
        background: linear-gradient(135deg, #fff2a3, #ffd84f);
        transform: translateY(-1px);
      }

      /* گزینه‌های ارتباطی مستقیم */
      .az-contact-strip {
        display: flex;
        gap: 6px;
        margin-top: 4px;
      }

      .az-contact-btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 8px 6px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 700;
        text-decoration: none;
        color: #fff;
        transition: all 0.2s;
      }

      .az-btn-call {
        background: rgba(16, 185, 129, 0.18);
        border: 1px solid rgba(16, 185, 129, 0.35);
        color: #6ee7b7;
      }

      .az-btn-call:hover {
        background: rgba(16, 185, 129, 0.3);
      }

      .az-btn-wa {
        background: rgba(37, 211, 102, 0.18);
        border: 1px solid rgba(37, 211, 102, 0.35);
        color: #86efac;
      }

      .az-btn-wa:hover {
        background: rgba(37, 211, 102, 0.3);
      }

      @media (max-width: 640px) {
        #azimAiFab {
          bottom: 20px;
          right: 16px;
          padding: 6px 10px 6px 6px;
        }
        .az-fab-icon-box {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
        }
        .az-fab-robot-svg {
          width: 34px;
          height: 34px;
        }
        .az-fab-subtitle {
          display: none;
        }
        #azAiQuickModal {
          bottom: 80px;
          right: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // پایگاه دانش فنی سریع برای ویجت شناور
  function getQuickAnswer(text) {
    const q = String(text || '').trim().toLocaleLowerCase('fa')
      .replace(/[يى]/g,'ی').replace(/ك/g,'ک')
      .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/\s+/g,' ');

    if (q.includes('ترکمتر') || q.includes('گشتاور')) {
      return '🔧 راهنمای ترکمتر عظیم ابزار:\n' +
        '• درایو ۱/۴ اینچ: مناسب کارهای ظریف، موتور سیکلت و پیچ‌های آلومینیومی (۵ تا ۲۵ نیوتن‌متر).\n' +
        '• درایو ۳/۸ و ۱/۲ اینچ: پرکاربردترین سایز مکانیکی برای سرسیلندر، چرخ و سیستم تعلیق خودرو.\n' +
        '• درایو ۳/۴ و ۱ اینچ: مخصوص صنایع سنگین، کامیون و ماشین‌آلات راه‌سازی.\n' +
        'تمامی ترکمترها با برگه کالیبراسیون رسمی و استاندارد ISO 6789 ارائه می‌شوند.';
    }
    if (q.includes('بکس') || q.includes('جعبه') || q.includes('آچار')) {
      return '🧰 جعبه بکس‌ها و آچارهای کارگاهی:\n' +
        '• آلیاژ کروم وانادیوم (Cr-V): با پوشش مات ضدلغزش و مقاوم در برابر سایش.\n' +
        '• بکس‌های فشار قوی مشکی (Cr-Mo): ویژه بکس بادی و گشتاورهای سنگین کارگاهی.\n' +
        'کاتالوگ کامل شامل ست‌های ۲۴ تا ۱۵۰ پارچه کامل در بخش محصولات موجود است.';
    }
    if (q.includes('قیمت') || q.includes('تخفیف') || q.includes('همکار') || q.includes('عمده')) {
      return '⚡ تخفیف خرید عمده و استعلام قیمت همکار:\n' +
        'برای سفارشات تیراژ، شرکت‌ها و همکاران گرامی صنف ابزار، تخفیف پلکانی و صدور پیش‌فاکتور رسمی لحاظ می‌گردد.\n' +
        'جهت دریافت لیست قیمت همکاری مستقیم با ۰۹۱۲-۲۳۹۴۵۹۷ تماس حاصل فرمایید.';
    }
    if (q.includes('ارسال') || q.includes('گارانتی') || q.includes('خرید') || q.includes('سفارش')) {
      return '📦 ارسال و ضمانت عظیم ابزار:\n' +
        '• ارسال فوری تهران از طریق پیک موتوری و اسنپ بار.\n' +
        '• ارسال به سراسر کشور از طریق باربری، تیپاکس و پست پیشتاز.\n' +
        '• ضمانت اصالت ۱۰۰٪ فیزیکی کالا و امکان مرجوعی در صورت عدم تطابق مشخصات.';
    }

    return `سلام! من دستیار هوشمند عظیم ابزار هستم. پاسخ سوال شما درباره «${esc(text)}»:\n` +
      `برای بررسی دقیق این کالا و بیش از ۹۰۸ قلم ابزار کارگاهی دیگر، می‌توانید از کاتالوگ سایت دیدن کنید یا مستقیماً وارد صفحه اختصاصی هوش مصنوعی شوید.\n` +
      `همچنین کارشناسان ما با شماره ۰۹۱۲-۲۳۹۴۵۹۷ آماده راهنمایی تلفنی هستند.`;
  }

  // ایجاد و اتصال دکمه شناور و مودال
  function createWidget() {
    if (document.getElementById('azimAiFab')) return;
    injectStyles();

    // ۱. دکمه شناور FAB
    const fab = document.createElement('div');
    fab.id = 'azimAiFab';
    fab.setAttribute('role', 'button');
    fab.setAttribute('aria-label', 'مشاور هوشمند عظیم ابزار');
    fab.setAttribute('tabindex', '0');
    fab.innerHTML =
      '<div class="az-fab-icon-box">' + miniRobotSvg() + '</div>' +
      '<div class="az-fab-info">' +
        '<div class="az-fab-title-row">' +
          '<span class="az-fab-title">مشاور هوشمند</span>' +
          '<span class="az-fab-badge"><span class="az-fab-pulse"></span>آنلاین</span>' +
        '</div>' +
        '<span class="az-fab-subtitle">راهنمای تخصصی ابزارآلات</span>' +
      '</div>';
    document.body.appendChild(fab);

    // ۲. پنجره پاپ‌آپ مشاوره سریع
    const modal = document.createElement('div');
    modal.id = 'azAiQuickModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="az-modal-header">' +
        '<div class="az-fab-icon-box">' + miniRobotSvg() + '</div>' +
        '<div class="az-modal-header-info">' +
          '<strong>مشاور هوشمند عظیم ابزار</strong>' +
          '<small>راهنمای ۹۰۸ قلم ابزار تخصصی و کارگاهی</small>' +
        '</div>' +
        '<button type="button" class="az-modal-close-btn" id="azAiModalCloseBtn" aria-label="بستن">×</button>' +
      '</div>' +
      '<div class="az-modal-body">' +
        '<a href="ai.html" class="az-full-ai-link">' +
          '<span>' +
            '<b>ورود به محیط هوش مصنوعی پیشرفته</b>' +
            '<small>تحلیل جامع ابزارها، تطبیق گشتاور و چت فنی هوشمند</small>' +
          '</span>' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M15 18l-6-6 6-6"/>' +
          '</svg>' +
        '</a>' +
        '<div class="az-quick-chips">' +
          '<button type="button" class="az-quick-chip" data-q="ترکمتر">🔧 راهنمای انتخاب ترکمتر</button>' +
          '<button type="button" class="az-quick-chip" data-q="بکس">🧰 جعبه بکس و آچارها</button>' +
          '<button type="button" class="az-quick-chip" data-q="همکار">⚡ استعلام تخفیف خرید عمده</button>' +
          '<button type="button" class="az-quick-chip" data-q="ارسال">📦 شرایط ارسال و ضمانت</button>' +
        '</div>' +
        '<div class="az-quick-answer-box" id="azQuickAnswerBox"></div>' +
        '<form class="az-widget-form" id="azWidgetForm">' +
          '<input class="az-widget-input" id="azWidgetInput" placeholder="سوالی درباره سایز یا کارایی ابزار دارید؟">' +
          '<button type="submit" class="az-widget-submit">پرسش</button>' +
        '</form>' +
        '<div class="az-contact-strip">' +
          '<a href="tel:09122394597" class="az-contact-btn az-btn-call">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
            '<span>تماس فنی: ۰۹۱۲-۲۳۹۴۵۹۷</span>' +
          '</a>' +
          '<a href="https://wa.me/989122394597" target="_blank" rel="noopener" class="az-contact-btn az-btn-wa">' +
            '<span>واتساپ پشتیبانی</span>' +
          '</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // مدیریت باز و بسته شدن
    function toggleModal() {
      const isOpen = modal.classList.toggle('open');
      modal.setAttribute('aria-hidden', String(!isOpen));
      if (isOpen) {
        setTimeout(() => modal.querySelector('#azWidgetInput')?.focus(), 100);
      }
    }

    fab.addEventListener('click', toggleModal);
    fab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleModal(); } });
    modal.querySelector('#azAiModalCloseBtn').onclick = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    };

    // پرسش سریع با چیپ‌ها
    const answerBox = modal.querySelector('#azQuickAnswerBox');
    modal.querySelectorAll('.az-quick-chip').forEach(chip => {
      chip.onclick = () => {
        const q = chip.dataset.q;
        answerBox.textContent = getQuickAnswer(q);
        answerBox.classList.add('active');
      };
    });

    // ثبت فرم
    modal.querySelector('#azWidgetForm').onsubmit = e => {
      e.preventDefault();
      const input = modal.querySelector('#azWidgetInput');
      const text = String(input.value || '').trim();
      if (!text) return;
      answerBox.textContent = getQuickAnswer(text);
      answerBox.classList.add('active');
      input.value = '';
    };

    // بستن با کلیک بیرون از مودال
    document.addEventListener('click', e => {
      if (!modal.classList.contains('open')) return;
      if (!modal.contains(e.target) && !fab.contains(e.target)) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget, { once: true });
  } else {
    createWidget();
  }
})();
