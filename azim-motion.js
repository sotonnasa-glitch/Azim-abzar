(() => {
  if (window.__azimIndustrialMotion) return;
  window.__azimIndustrialMotion = true;

  const style = document.createElement('style');
  style.textContent = `
    .az-motion-stage{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden;opacity:.92}
    .az-motion-stage .gear{position:absolute;border:1px solid rgba(245,185,0,.26);border-radius:50%;display:grid;place-items:center;transform-origin:center;filter:drop-shadow(0 0 16px rgba(245,185,0,.08))}
    .az-motion-stage .gear:before{content:"";width:62%;height:62%;border:1px dashed rgba(255,216,79,.36);border-radius:50%;box-shadow:inset 0 0 0 5px rgba(245,185,0,.035)}
    .az-motion-stage .gear:after{content:"";position:absolute;width:9%;height:9%;background:rgba(245,185,0,.55);border-radius:50%;box-shadow:0 0 14px rgba(245,185,0,.35)}
    .az-motion-stage .g1{width:280px;height:280px;right:4%;top:13%;animation:azGear 18s linear infinite}
    .az-motion-stage .g2{width:160px;height:160px;right:24%;top:32%;animation:azGearReverse 11s linear infinite}
    .az-motion-stage .g3{width:92px;height:92px;right:37%;top:19%;animation:azGear 7s linear infinite}
    .az-motion-stage .orbit{position:absolute;width:430px;height:210px;right:-15px;top:8%;border:1px solid rgba(245,185,0,.11);border-radius:50%;transform:rotate(-18deg);animation:azOrbit 15s linear infinite}
    .az-motion-stage .orbit:before,.az-motion-stage .orbit:after{content:"";position:absolute;width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 14px var(--gold)}
    .az-motion-stage .orbit:before{left:16%;top:10%}.az-motion-stage .orbit:after{right:18%;bottom:8%;opacity:.45}
    .az-motion-stage .bolt{position:absolute;width:9px;height:9px;border-radius:2px;background:var(--gold2);box-shadow:0 0 18px rgba(245,185,0,.55);animation:azBolt 4.5s ease-in-out infinite}
    .az-motion-stage .b1{right:12%;bottom:22%}.az-motion-stage .b2{right:32%;top:14%;animation-delay:-1.4s}.az-motion-stage .b3{right:47%;bottom:17%;animation-delay:-2.7s}
    .az-motion-stage .scan{position:absolute;right:4%;top:8%;width:48%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,216,79,.55),transparent);box-shadow:0 0 18px rgba(245,185,0,.28);animation:azScan 5s ease-in-out infinite}
    .az-motion-stage .label{position:absolute;right:8%;bottom:9%;font:700 8px/1 Vazirmatn,Tahoma,sans-serif;letter-spacing:.12em;color:rgba(255,216,79,.55);padding:7px 9px;border:1px solid rgba(245,185,0,.18);border-radius:7px;background:rgba(5,7,6,.28);backdrop-filter:blur(5px);animation:azLabel 3s ease-in-out infinite}
    .az-motion-stage .cross{position:absolute;width:14px;height:14px;opacity:.45}
    .az-motion-stage .cross:before,.az-motion-stage .cross:after{content:"";position:absolute;background:rgba(255,216,79,.55)}
    .az-motion-stage .cross:before{width:14px;height:1px;top:7px}.az-motion-stage .cross:after{height:14px;width:1px;left:7px}
    .az-motion-stage .c1{right:7%;top:52%;animation:azCross 4s ease-in-out infinite}.az-motion-stage .c2{right:45%;top:38%;animation:azCross 5s 1s ease-in-out infinite}
    @keyframes azGear{to{transform:rotate(360deg)}}
    @keyframes azGearReverse{to{transform:rotate(-360deg)}}
    @keyframes azOrbit{to{transform:rotate(342deg)}}
    @keyframes azBolt{0%,100%{transform:translate3d(0,0,0);opacity:.3}50%{transform:translate3d(-22px,-16px,0);opacity:1}}
    @keyframes azScan{0%,100%{transform:translateX(40%);opacity:0}25%{opacity:1}70%{transform:translateX(-70%);opacity:.7}}
    @keyframes azLabel{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-5px);opacity:.9}}
    @keyframes azCross{0%,100%{transform:scale(.8);opacity:.25}50%{transform:scale(1.2);opacity:.8}}
    @media (max-width:700px){.az-motion-stage .g1{width:190px;height:190px;right:-30px;top:15%}.az-motion-stage .g2{width:110px;height:110px;right:23%;top:34%}.az-motion-stage .g3{width:62px;height:62px;right:39%;top:22%}.az-motion-stage .orbit{width:300px;height:150px;right:-75px}.az-motion-stage .label{right:7%;bottom:5%;font-size:7px}.az-motion-stage{opacity:.62}}
    @media (prefers-reduced-motion:reduce){.az-motion-stage *{animation:none!important}}
  `;
  document.head.appendChild(style);

  function mount() {
    const hero = document.querySelector('.heroBox');
    if (!hero || hero.querySelector('.az-motion-stage')) return;
    const stage = document.createElement('div');
    stage.className = 'az-motion-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="gear g1"></div><div class="gear g2"></div><div class="gear g3"></div>
      <div class="orbit"></div><div class="scan"></div>
      <i class="bolt b1"></i><i class="bolt b2"></i><i class="bolt b3"></i>
      <i class="cross c1"></i><i class="cross c2"></i>
      <div class="label">AZIM ABZAR • INDUSTRIAL SYSTEM</div>`;
    hero.appendChild(stage);

    hero.addEventListener('pointermove', (e) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      stage.style.transform = `translate3d(${x * -8}px,${y * -5}px,0)`;
    }, {passive:true});
    hero.addEventListener('pointerleave', () => { stage.style.transform = ''; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
