(() => {
  if (window.__azimIndustrialMotion) return;
  window.__azimIndustrialMotion = true;

  const style = document.createElement('style');
  style.textContent = `
    .az-motion-stage{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden;opacity:.9;transition:transform .25s ease-out}
    .az-motion-stage .ring{position:absolute;border:1px solid rgba(245,185,0,.16);border-radius:50%;box-shadow:0 0 45px rgba(245,185,0,.035) inset}
    .az-motion-stage .ring:after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:var(--gold2);box-shadow:0 0 14px rgba(255,216,79,.7);left:12%;top:18%;animation:azDot 6s linear infinite}
    .az-motion-stage .r1{width:430px;height:430px;right:-90px;top:7%;animation:azFloatRing 14s ease-in-out infinite}
    .az-motion-stage .r2{width:260px;height:260px;right:12%;top:22%;border-style:dashed;opacity:.55;animation:azSpin 20s linear infinite reverse}
    .az-motion-stage .r3{width:125px;height:125px;right:29%;top:34%;opacity:.4;animation:azFloatRing 9s ease-in-out infinite reverse}
    .az-motion-stage .beam{position:absolute;right:5%;top:14%;width:42%;height:160px;background:linear-gradient(115deg,transparent 0%,rgba(255,216,79,.08) 48%,transparent 55%);filter:blur(2px);animation:azBeam 8s ease-in-out infinite}
    .az-motion-stage .grid{position:absolute;right:0;top:0;width:55%;height:100%;opacity:.12;background-image:linear-gradient(rgba(255,216,79,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,216,79,.18) 1px,transparent 1px);background-size:70px 70px;mask-image:radial-gradient(circle at 70% 35%,black,transparent 70%);animation:azGrid 18s linear infinite}
    .az-motion-stage .spark{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--gold2);box-shadow:0 0 12px var(--gold);animation:azSpark 4s ease-in-out infinite}
    .az-motion-stage .s1{right:15%;top:28%}.az-motion-stage .s2{right:36%;top:18%;animation-delay:-1.2s}.az-motion-stage .s3{right:23%;bottom:22%;animation-delay:-2.4s}.az-motion-stage .s4{right:46%;bottom:30%;animation-delay:-3.1s}
    .az-motion-stage .badge{position:absolute;right:7%;bottom:8%;padding:7px 10px;border:1px solid rgba(255,216,79,.16);border-radius:999px;background:rgba(8,11,9,.38);backdrop-filter:blur(12px);font:700 7px/1 Vazirmatn,Tahoma,sans-serif;letter-spacing:.1em;color:rgba(255,216,79,.6);animation:azBadge 3.5s ease-in-out infinite}
    @keyframes azSpin{to{transform:rotate(360deg)}}
    @keyframes azFloatRing{0%,100%{transform:translate3d(0,0,0) rotate(0)}50%{transform:translate3d(-10px,12px,0) rotate(8deg)}}
    @keyframes azDot{to{transform:rotate(360deg) translateX(150px) rotate(-360deg)}}
    @keyframes azBeam{0%,100%{transform:translateX(40%);opacity:0}35%{opacity:1}70%{transform:translateX(-30%);opacity:.55}}
    @keyframes azGrid{to{transform:translate3d(-70px,70px,0)}}
    @keyframes azSpark{0%,100%{transform:translate3d(0,0,0) scale(.5);opacity:.15}50%{transform:translate3d(-12px,-18px,0) scale(1.5);opacity:1}}
    @keyframes azBadge{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-4px);opacity:.8}}
    @media(max-width:700px){.az-motion-stage{opacity:.55}.az-motion-stage .r1{width:270px;height:270px;right:-90px;top:12%}.az-motion-stage .r2{width:170px;height:170px;right:7%;top:26%}.az-motion-stage .r3{width:85px;height:85px;right:27%;top:36%}.az-motion-stage .grid{width:70%;background-size:55px 55px}.az-motion-stage .badge{right:6%;bottom:5%;font-size:6px}}
    @media(prefers-reduced-motion:reduce){.az-motion-stage *{animation:none!important}}
  `;
  document.head.appendChild(style);

  function mount(){
    const hero=document.querySelector('.heroBox');
    if(!hero||hero.querySelector('.az-motion-stage')) return;
    const stage=document.createElement('div');
    stage.className='az-motion-stage';
    stage.setAttribute('aria-hidden','true');
    stage.innerHTML=`<div class="grid"></div><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div><div class="beam"></div><i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i><i class="spark s4"></i><div class="badge">AZIM ABZAR • PROFESSIONAL TOOLS</div>`;
    hero.appendChild(stage);
    hero.addEventListener('pointermove',e=>{if(window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;stage.style.transform=`translate3d(${x*-7}px,${y*-4}px,0)`},{passive:true});
    hero.addEventListener('pointerleave',()=>{stage.style.transform=''});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
