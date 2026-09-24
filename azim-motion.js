(() => {
  if (window.__azimIndustrialMotionV7) return;
  window.__azimIndustrialMotionV7 = true;

  const style = document.createElement('style');
  style.id = 'azim-enhanced-motion-styles-v7';
  style.textContent = `
    /* === Floating Ambient Canvas === */
    #az-ambient-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 0;
      opacity: 0.65;
    }

    /* === Brand Gear Smooth Spin === */
    .brand .mark {
      transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease;
      cursor: pointer;
    }
    .brand .mark svg {
      animation: azBrandGearIdle 32s linear infinite;
      transition: transform 0.4s ease;
      transform-origin: center center;
    }
    .brand:hover .mark svg {
      animation: none;
      transform: rotate(180deg) scale(1.1);
    }
    @keyframes azBrandGearIdle {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* === Hero Ambient Rings & Engineering Grid Overlay === */
    .az-motion-stage {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
      opacity: .8;
    }
    .az-motion-stage .ring {
      position: absolute;
      border: 1px solid rgba(245,185,0,.14);
      border-radius: 50%;
      box-shadow: inset 0 0 40px rgba(245,185,0,.03);
    }
    .az-motion-stage .r1 {
      width: 540px;
      height: 540px;
      left: 10px;
      top: -10%;
      border-style: dashed;
      animation: azRingSpinSlow 90s linear infinite;
    }
    .az-motion-stage .r2 {
      width: 340px;
      height: 340px;
      left: 120px;
      top: 15%;
      border: 1px solid rgba(255,216,79,.1);
      animation: azRingSpinReverse 60s linear infinite;
    }
    @keyframes azRingSpinSlow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes azRingSpinReverse {
      from { transform: rotate(0deg); }
      to { transform: rotate(-360deg); }
    }

    /* Engineering Coordinates Grid Mask */
    .az-motion-stage .grid {
      position: absolute;
      left: 0;
      top: 0;
      width: 50%;
      height: 100%;
      opacity: .07;
      background-image: linear-gradient(rgba(255,216,79,.25) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,216,79,.25) 1px, transparent 1px);
      background-size: 50px 50px;
      mask-image: radial-gradient(circle at 40% 50%, black, transparent 75%);
    }

    /* === Interactive Laser Scanline for Category & Featured Cards === */
    .az-scanline-card {
      position: relative;
      overflow: hidden;
    }
    .az-scanline-card::before {
      content: "";
      position: absolute;
      top: -60px;
      left: 0;
      width: 100%;
      height: 48px;
      background: linear-gradient(180deg, transparent, rgba(245,185,0,.15) 30%, rgba(255,216,79,.75) 50%, rgba(245,185,0,.25) 70%, transparent);
      box-shadow: 0 0 16px rgba(245,185,0,.6), 0 0 32px rgba(255,216,79,.35);
      opacity: 0;
      pointer-events: none;
      z-index: 5;
      transition: opacity 0.25s ease;
    }
    .az-scanline-card:hover::before {
      opacity: 1;
      animation: azLaserSweep 1.35s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
    }
    @keyframes azLaserSweep {
      0% { top: -60px; }
      100% { top: 110%; }
    }

    /* === Smooth Mouse Glow on Cards === */
    .card, .az-choice, .az-feat-card, .az-showcase-card, .az-cat-bento, .az-cat-card-item {
      position: relative;
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease !important;
    }
    .az-card-glow {
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      opacity: 0;
      transition: opacity 0.3s ease;
      background: radial-gradient(circle 320px at var(--mx, 50%) var(--my, 50%), rgba(245,185,0,.22), transparent 75%);
      z-index: 4;
    }
    .card:hover .az-card-glow, 
    .az-choice:hover .az-card-glow, 
    .az-feat-card:hover .az-card-glow,
    .az-showcase-card:hover .az-card-glow,
    .az-cat-bento:hover .az-card-glow,
    .az-cat-card-item:hover .az-card-glow {
      opacity: 1;
    }

    /* === Smooth Natural Scroll Reveal === */
    .az-scroll-fade {
      opacity: 0;
      transform: translateY(22px);
      transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
      will-change: opacity, transform;
    }
    .az-scroll-fade.az-visible {
      opacity: 1;
      transform: translateY(0);
    }

    @media (max-width: 1040px) {
      .az-cat-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .az-cat-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);

  // 1. Mount Canvas for Subtle Floating Metallic Particles & Ember Sparks
  function mountAmbientCanvas() {
    if (document.getElementById('az-ambient-canvas')) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'az-ambient-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = -1000;
    let mouseY = -1000;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }, { passive: true });

    window.addEventListener('pointermove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      mouseX = -1000;
      mouseY = -1000;
    }, { passive: true });

    // Particle count: 50 rich glowing industrial embers and sparks
    const count = 50;
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.8 + 1.1,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 0.45 + 0.2), // buoyant drift upwards like workshop embers
        baseAlpha: Math.random() * 0.45 + 0.35,
        twinkleSpeed: Math.random() * 0.03 + 0.015,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.35 ? '255, 216, 79' : (Math.random() > 0.5 ? '245, 185, 0' : '255, 244, 184')
      });
    }

    let isVisible = true;
    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
    });

    let time = 0;
    function draw() {
      if (!isVisible) {
        requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      time += 0.02;

      for (let i = 0; i < count; i++) {
        const p = particles[i];
        p.twinklePhase += p.twinkleSpeed;
        const currentAlpha = Math.max(0.12, p.baseAlpha + Math.sin(p.twinklePhase) * 0.25);

        // Sinusoidal sway
        const sway = Math.sin(time + i) * 0.25;
        p.x += p.vx + sway;
        p.y += p.vy;

        // Interactive mouse disturbance
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.hypot(dx, dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120;
          p.x += (dx / dist) * force * 1.8;
          p.y += (dy / dist) * force * 1.8;
        }

        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.y > height + 10) p.y = -10;

        // Glowing halo gradient for each spark
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.6);
        grad.addColorStop(0, `rgba(${p.color}, ${Math.min(1, currentAlpha * 1.3)})`);
        grad.addColorStop(0.4, `rgba(${p.color}, ${currentAlpha * 0.6})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // 2. Mount Mechanical Stage in Hero
  function mountHeroStage() {
    const hero = document.querySelector('.heroBox');
    if (!hero || hero.querySelector('.az-motion-stage')) return;

    const stage = document.createElement('div');
    stage.className = 'az-motion-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="grid"></div>
      <div class="ring r1"></div>
      <div class="ring r2"></div>
    `;
    hero.appendChild(stage);
  }

  // 3. Interactive Smooth Parallax on Hero HUD
  function setupHeroParallax() {
    const heroBox = document.querySelector('.heroBox');
    const hud = document.querySelector('.az-hero-interactive-hud');
    if (!heroBox || !hud) return;

    let ticking = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    heroBox.addEventListener('pointermove', e => {
      const rect = heroBox.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = nx * -16;
      targetY = ny * -16;

      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateHudParallax);
      }
    }, { passive: true });

    heroBox.addEventListener('pointerleave', () => {
      targetX = 0;
      targetY = 0;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateHudParallax);
      }
    });

    function updateHudParallax() {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      hud.style.transform = `translateY(-50%) translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;

      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        requestAnimationFrame(updateHudParallax);
      } else {
        ticking = false;
      }
    }
  }

  // 4. Torque Gauge Interactive Needle & Number Count-Up
  function setupGaugeInteractivity() {
    const numEl = document.getElementById('az-gauge-num');
    const needle = document.querySelector('.az-gauge-needle');
    const hudCard = document.querySelector('.az-hud-card');
    if (!numEl) return;

    const toPersian = num => String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

    let start = 0;
    const target = 450;
    const duration = 1400;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      numEl.textContent = toPersian(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        numEl.textContent = toPersian(target);
      }
    }
    requestAnimationFrame(step);

    if (hudCard && needle) {
      hudCard.addEventListener('pointerenter', () => {
        needle.style.animationPlayState = 'paused';
        needle.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        needle.style.transform = 'rotate(24deg)';
        numEl.textContent = toPersian(520);
        numEl.style.color = '#fff';
      });

      hudCard.addEventListener('pointerleave', () => {
        needle.style.transition = 'transform 0.5s ease';
        needle.style.transform = 'rotate(-18deg)';
        setTimeout(() => {
          needle.style.animationPlayState = 'running';
          numEl.textContent = toPersian(450);
          numEl.style.color = '#ffd84f';
        }, 500);
      });
    }
  }

  // 5. Card Glow with Mouse Follow
  function setupCardGlow() {
    const cards = document.querySelectorAll('.card, .az-choice, .az-feat-card, .az-showcase-card, .az-cat-bento, .az-photo-card, .az-cat-card-item');
    cards.forEach(card => {
      if (card.querySelector('.az-card-glow')) return;

      const glow = document.createElement('div');
      glow.className = 'az-card-glow';
      card.appendChild(glow);

      let ticking = false;
      card.addEventListener('pointermove', e => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty('--mx', `${x}px`);
          card.style.setProperty('--my', `${y}px`);
          ticking = false;
        });
      }, { passive: true });
    });
  }

  // 6. Scroll Reveal for Sections and Cards
  function setupScrollReveal() {
    const targets = document.querySelectorAll('.section, .az-choice-grid > *, .az-features-grid > *, .az-category-card, .az-feat-card, .az-photo-card, .az-cat-showcase-grid > *, .az-cat-card-item');
    if (!targets.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('az-visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -30px 0px'
    });

    targets.forEach(el => {
      el.classList.add('az-scroll-fade');
      observer.observe(el);
    });
  }

  // 7. Interactive Lightbox for Industrial Tool Photo Gallery
  function setupLightbox() {
    const lightbox = document.getElementById('az-lightbox');
    if (!lightbox) return;

    const lbImg = document.getElementById('az-lightbox-img');
    const lbCaption = document.getElementById('az-lightbox-caption');
    const closeBtn = document.getElementById('az-lightbox-close');
    const backdrop = document.getElementById('az-lightbox-backdrop');
    const photoCards = document.querySelectorAll('.az-photo-card');

    function openLightbox(card) {
      const fullSrc = card.getAttribute('data-full-src') || card.querySelector('img')?.src;
      const caption = card.getAttribute('data-caption') || card.querySelector('img')?.alt || '';
      if (!fullSrc) return;

      lbImg.src = fullSrc;
      lbImg.alt = caption;
      lbCaption.textContent = caption;
      lightbox.classList.add('active');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      setTimeout(() => {
        if (!lightbox.classList.contains('active')) {
          lbImg.src = '';
        }
      }, 300);
    }

    photoCards.forEach(card => {
      card.addEventListener('click', () => openLightbox(card));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(card);
        }
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (backdrop) backdrop.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

  function init() {
    mountAmbientCanvas();
    mountHeroStage();
    setupHeroParallax();
    setupGaugeInteractivity();
    setupCardGlow();
    setupScrollReveal();
    setupLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
