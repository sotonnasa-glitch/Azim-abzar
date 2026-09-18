(() => {
  if (window.__azimIndustrialMotionV3) return;
  window.__azimIndustrialMotionV3 = true;

  const style = document.createElement('style');
  style.id = 'azim-enhanced-motion-styles';
  style.textContent = `
    /* === Typography & Highlight Shimmer === */
    @keyframes azGoldShimmer {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .hero h1 span, .brand strong, .top b, .num {
      background: linear-gradient(135deg, #ffd84f 0%, #ffffff 30%, #f5b900 65%, #ffd84f 100%);
      background-size: 250% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: azGoldShimmer 6s ease-in-out infinite;
      display: inline-block;
    }

    /* === Brand Gear Animation === */
    .brand .mark {
      transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s ease;
      cursor: pointer;
    }
    .brand:hover .mark {
      transform: rotate(180deg) scale(1.08);
      box-shadow: 0 0 38px rgba(245,185,0,.65);
    }

    /* === Hero Ambient Glow & Particle Motion === */
    .az-motion-stage {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
      opacity: .96;
      transition: transform .25s cubic-bezier(.2,.8,.2,1);
    }
    .az-motion-stage:before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 75% 40%, rgba(245,185,0,.18), transparent 32%),
                  radial-gradient(circle at 90% 75%, rgba(255,255,255,.05), transparent 25%);
      mix-blend-mode: screen;
    }
    .az-motion-stage .ring {
      position: absolute;
      border: 1px solid rgba(245,185,0,.22);
      border-radius: 50%;
      box-shadow: inset 0 0 50px rgba(245,185,0,.06), 0 0 30px rgba(245,185,0,.04);
    }
    .az-motion-stage .ring:after {
      content: "";
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--gold2, #ffd84f);
      box-shadow: 0 0 18px rgba(255,216,79,1);
      left: 12%;
      top: 18%;
      animation: azDot 7s linear infinite;
    }
    .az-motion-stage .r1 { width: 540px; height: 540px; right: -130px; top: -8%; animation: azFloatRing 14s ease-in-out infinite; }
    .az-motion-stage .r2 { width: 340px; height: 340px; right: 9%; top: 16%; border-style: dashed; opacity: .65; animation: azSpin 24s linear infinite reverse; }
    .az-motion-stage .r3 { width: 160px; height: 160px; right: 28%; top: 32%; opacity: .45; animation: azFloatRing 10s ease-in-out infinite reverse; }
    
    .az-motion-stage .orbit {
      position: absolute;
      width: 450px;
      height: 160px;
      right: 3%;
      top: 30%;
      border: 1px solid rgba(255,216,79,.2);
      border-radius: 50%;
      transform: rotate(-24deg);
      animation: azOrbit 14s linear infinite;
    }
    .az-motion-stage .orbit:before {
      content: "";
      position: absolute;
      width: 10px;
      height: 10px;
      right: 18%;
      top: 2px;
      border-radius: 50%;
      background: var(--gold2, #ffd84f);
      box-shadow: 0 0 25px rgba(255,216,79,1);
    }
    .az-motion-stage .beam {
      position: absolute;
      right: -10%;
      top: 0%;
      width: 70%;
      height: 85%;
      background: linear-gradient(120deg, transparent 0%, rgba(255,216,79,.12) 48%, transparent 56%);
      filter: blur(4px);
      animation: azBeam 9s ease-in-out infinite;
    }
    .az-motion-stage .grid {
      position: absolute;
      right: 0;
      top: 0;
      width: 60%;
      height: 100%;
      opacity: .14;
      background-image: linear-gradient(rgba(255,216,79,.25) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,216,79,.25) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(circle at 70% 40%, black, transparent 75%);
      animation: azGrid 20s linear infinite;
    }
    .az-motion-stage .crosshair {
      position: absolute;
      right: 25%;
      top: 25%;
      width: 96px;
      height: 96px;
      border: 1px solid rgba(255,216,79,.3);
      border-radius: 50%;
      animation: azCross 8s ease-in-out infinite;
    }
    .az-motion-stage .crosshair:before, .az-motion-stage .crosshair:after {
      content: "";
      position: absolute;
      background: rgba(255,216,79,.35);
    }
    .az-motion-stage .crosshair:before { width: 130%; height: 1px; left: -15%; top: 50%; }
    .az-motion-stage .crosshair:after { height: 130%; width: 1px; top: -15%; left: 50%; }

    /* Animated Sparks */
    .az-motion-stage .spark {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #ffd84f;
      box-shadow: 0 0 16px #f5b900, 0 0 30px #f5b900;
      animation: azSpark 4.5s ease-in-out infinite;
    }
    .az-motion-stage .s1 { right: 16%; top: 26%; animation-delay: 0s; }
    .az-motion-stage .s2 { right: 38%; top: 16%; animation-delay: -1.4s; }
    .az-motion-stage .s3 { right: 22%; bottom: 20%; animation-delay: -2.8s; }
    .az-motion-stage .s4 { right: 48%; bottom: 28%; animation-delay: -3.5s; }
    .az-motion-stage .s5 { right: 30%; top: 48%; animation-delay: -2.1s; }

    /* Animated Tech Chips */
    .az-motion-stage .chip {
      position: absolute;
      padding: 7px 14px;
      border: 1px solid rgba(255,216,79,.3);
      border-radius: 10px;
      background: rgba(8,11,9,.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      font: 800 9px/1.2 Vazirmatn, Tahoma, sans-serif;
      color: rgba(255,216,79,.95);
      letter-spacing: .08em;
      box-shadow: 0 10px 25px rgba(0,0,0,.45), inset 0 1px 1px rgba(255,255,255,.12);
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .az-motion-stage .chip .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ffd84f;
      box-shadow: 0 0 10px #ffd84f;
      animation: azPulseGlow 1.5s infinite alternate;
    }
    .az-motion-stage .chip.one { right: 9%; top: 11%; animation: azChip 4.6s ease-in-out infinite; }
    .az-motion-stage .chip.two { right: 36%; bottom: 12%; animation: azChip 5.6s ease-in-out infinite reverse; }
    .az-motion-stage .chip.three { right: 2%; bottom: 32%; animation: azChip 6.2s ease-in-out infinite 1s; }
    .az-motion-stage .chip b { color: #fff; }

    /* === Interactive Card 3D & Mouse Glow === */
    .card, .az-choice, .az-feat-card {
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
                  border-color 0.28s ease,
                  box-shadow 0.28s ease !important;
    }
    .az-card-glow {
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      opacity: 0;
      transition: opacity 0.35s ease;
      background: radial-gradient(circle 200px at var(--mx, 50%) var(--my, 50%), rgba(245,185,0,.22), transparent 75%);
      z-index: 2;
    }
    .card:hover .az-card-glow, .az-choice:hover .az-card-glow, .az-feat-card:hover .az-card-glow {
      opacity: 1;
    }

    /* === Scroll Reveal & Stagger Animations === */
    .az-reveal {
      opacity: 0;
      transform: translateY(28px);
      transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1), transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
      will-change: opacity, transform;
    }
    .az-reveal.az-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .card.az-reveal:nth-child(1) { transition-delay: 0.05s; }
    .card.az-reveal:nth-child(2) { transition-delay: 0.12s; }
    .card.az-reveal:nth-child(3) { transition-delay: 0.19s; }
    .card.az-reveal:nth-child(4) { transition-delay: 0.26s; }
    .card.az-reveal:nth-child(5) { transition-delay: 0.33s; }
    .card.az-reveal:nth-child(6) { transition-delay: 0.40s; }

    /* === Keyframe Definitions === */
    @keyframes azSpin { to { transform: rotate(360deg); } }
    @keyframes azFloatRing {
      0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
      50% { transform: translate3d(-14px, 16px, 0) rotate(9deg); }
    }
    @keyframes azDot { to { transform: rotate(360deg) translateX(180px) rotate(-360deg); } }
    @keyframes azOrbit { to { transform: rotate(336deg); } }
    @keyframes azBeam {
      0%, 100% { transform: translateX(35%); opacity: 0; }
      35% { opacity: 1; }
      70% { transform: translateX(-30%); opacity: .55; }
    }
    @keyframes azGrid { to { transform: translate3d(-60px, 60px, 0); } }
    @keyframes azCross {
      0%, 100% { transform: scale(.92) rotate(0); opacity: .25; }
      50% { transform: scale(1.08) rotate(90deg); opacity: .65; }
    }
    @keyframes azSpark {
      0%, 100% { transform: translate3d(0, 0, 0) scale(.5); opacity: .15; }
      50% { transform: translate3d(-15px, -22px, 0) scale(1.7); opacity: 1; }
    }
    @keyframes azChip {
      0%, 100% { transform: translate3d(0, 0, 0); opacity: .6; }
      50% { transform: translate3d(-8px, -10px, 0); opacity: 1; }
    }
    @keyframes azPulseGlow {
      0% { transform: scale(0.9); opacity: 0.6; box-shadow: 0 0 6px #ffd84f; }
      100% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 16px #ffd84f; }
    }

    @media(max-width:700px){
      .az-motion-stage{opacity:.65;}
      .az-motion-stage .r1{width:320px;height:320px;right:-120px;top:6%;}
      .az-motion-stage .r2{width:200px;height:200px;right:4%;top:28%;}
      .az-motion-stage .r3{width:95px;height:95px;right:22%;top:38%;}
      .az-motion-stage .orbit{width:260px;height:100px;right:-8%;top:36%;}
      .az-motion-stage .grid{width:80%;background-size:48px 48px;}
      .az-motion-stage .crosshair{right:20%;top:30%;width:70px;height:70px;}
      .az-motion-stage .chip{font-size:7px;padding:5px 8px;}
      .az-motion-stage .chip.two, .az-motion-stage .chip.three{display:none;}
    }

    @media(prefers-reduced-motion:reduce){
      .az-motion-stage *, .card, .btn.primary {
        animation: none !important;
        transition: none !important;
      }
      .az-reveal {
        opacity: 1 !important;
        transform: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  // 1. Mount Hero Interactive Stage
  function mountHero() {
    const hero = document.querySelector('.heroBox');
    if (!hero || hero.querySelector('.az-motion-stage')) return;

    const stage = document.createElement('div');
    stage.className = 'az-motion-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="grid"></div>
      <div class="beam"></div>
      <div class="ring r1"></div>
      <div class="ring r2"></div>
      <div class="ring r3"></div>
      <div class="orbit"></div>
      <div class="crosshair"></div>
      <i class="spark s1"></i>
      <i class="spark s2"></i>
      <i class="spark s3"></i>
      <i class="spark s4"></i>
      <i class="spark s5"></i>
      <div class="chip one"><span class="dot"></span> <b>PRECISION</b> 908 TOOLS</div>
      <div class="chip two"><span class="dot"></span> <b>TORQUE</b> 40-210 Nm</div>
      <div class="chip three"><span class="dot"></span> <b>CR-V</b> ALLOY STEEL</div>
    `;
    hero.appendChild(stage);

    // Interactive 3D tilt on hero box
    hero.addEventListener('pointermove', e => {
      if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      stage.style.transform = `translate3d(${x * -14}px, ${y * -9}px, 0)`;
    }, { passive: true });

    hero.addEventListener('pointerleave', () => {
      stage.style.transform = '';
    });
  }

  // 2. Interactive 3D Tilt on Category & Feature Cards with Dynamic Spotlight Glow
  function setupCardTilt() {
    const cards = document.querySelectorAll('.card, .az-choice, .az-feat-card');
    cards.forEach(card => {
      if (card.querySelector('.az-card-glow')) return;

      const glow = document.createElement('div');
      glow.className = 'az-card-glow';
      card.appendChild(glow);

      card.addEventListener('pointermove', e => {
        if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5.5;
        const rotateY = ((x - centerX) / centerX) * 5.5;

        card.style.transform = `perspective(850px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-6px)`;
        card.style.setProperty('--mx', `${x}px`);
        card.style.setProperty('--my', `${y}px`);
      });

      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }

  // 3. Scroll Reveal Observer
  function setupScrollReveal() {
    const targets = document.querySelectorAll('.card, .sectionHead, .az-ticker-section, .note, #azim-choice-guide, #azim-why-us, footer');
    targets.forEach(el => el.classList.add('az-reveal'));

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('az-visible');
            obs.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -40px 0px', threshold: 0.1 });

      targets.forEach(el => observer.observe(el));
    } else {
      targets.forEach(el => el.classList.add('az-visible'));
    }
  }

  function init() {
    mountHero();
    setupCardTilt();
    setupScrollReveal();

    setTimeout(() => {
      setupCardTilt();
      setupScrollReveal();
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
