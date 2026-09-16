(() => {
  if (window.__azimIndustrialMotion) return;
  window.__azimIndustrialMotion = true;

  const style = document.createElement('style');
  style.textContent = `
    .az-motion-stage{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden;opacity:.96;transition:transform .35s cubic-bezier(.2,.8,.2,1);}
    .az-motion-stage:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 72% 43%,rgba(245,185,0,.12),transparent 24%),radial-gradient(circle at 88% 76%,rgba(255,255,255,.035),transparent 20%);mix-blend-mode:screen;}
    .az-motion-stage .ring{position:absolute;border:1px solid rgba(245,185,0,.15);border-radius:50%;box-shadow:0 0 70px rgba(245,185,0,.025) inset,0 0 25px rgba(245,185,0,.025);}
    .az-motion-stage .ring:after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:var(--gold2);box-shadow:0 0 16px rgba(255,216,79,.8);left:12%;top:18%;animation:azDot 6s linear infinite;}
    .az-motion-stage .r1{width:520px;height:520px;right:-145px;top:-5%;animation:azFloatRing 14s ease-in-out infinite;}
    .az-motion-stage .r2{width:320px;height:320px;right:8%;top:17%;border-style:dashed;opacity:.52;animation:azSpin 22s linear infinite reverse;}
    .az-motion-stage .r3{width:145px;height:145px;right:27%;top:33%;opacity:.34;animation:azFloatRing 9s ease-in-out infinite reverse;}
    .az-motion-stage .orbit{position:absolute;width:430px;height:150px;right:4%;top:31%;border:1px solid rgba(255,216,79,.11);border-radius:50%;transform:rotate(-24deg);animation:azOrbit 12s linear infinite;}
    .az-motion-stage .orbit:before{content:"";position:absolute;width:9px;height:9px;right:18%;top:3px;border-radius:50%;background:var(--gold2);box-shadow:0 0 22px rgba(255,216,79,.9);}
    .az-motion-stage .beam{position:absolute;right:-8%;top:5%;width:65%;height:70%;background:linear-gradient(115deg,transparent 0%,rgba(255,216,79,.07) 47%,transparent 53%);filter:blur(3px);animation:azBeam 8s ease-in-out infinite;}
    .az-motion-stage .grid{position:absolute;right:0;top:0;width:58%;height:100%;opacity:.09;background-image:linear-gradient(rgba(255,216,79,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,216,79,.2) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(circle at 70% 38%,black,transparent 72%);animation:azGrid 18s linear infinite;}
    .az-motion-stage .crosshair{position:absolute;right:24%;top:24%;width:92px;height:92px;border:1px solid rgba(255,216,79,.18);border-radius:50%;animation:azCross 7s ease-in-out infinite;}
    .az-motion-stage .crosshair:before,.az-motion-stage .crosshair:after{content:"";position:absolute;background:rgba(255,216,79,.25);}
    .az-motion-stage .crosshair:before{width:130%;height:1px;left:-15%;top:50%;}.az-motion-stage .crosshair:after{height:130%;width:1px;top:-15%;left:50%;}
    .az-motion-stage .spark{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--gold2);box-shadow:0 0 13px var(--gold);animation:azSpark 4s ease-in-out infinite;}
    .az-motion-stage .s1{right:15%;top:28%}.az-motion-stage .s2{right:36%;top:18%;animation-delay:-1.2s}.az-motion-stage .s3{right:23%;bottom:22%;animation-delay:-2.4s}.az-motion-stage .s4{right:46%;bottom:30%;animation-delay:-3.1s}
    .az-motion-stage .chip{position:absolute;padding:8px 11px;border:1px solid rgba(255,216,79,.16);border-radius:10px;background:rgba(8,11,9,.42);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font:700 7px/1 Vazirmatn,Tahoma,sans-serif;color:rgba(255,216,79,.68);letter-spacing:.08em;box-shadow:inset 0 1px rgba(255,255,255,.06),0 12px 30px rgba(0,0,0,.18);}
    .az-motion-stage .chip.one{right:10%;top:12%;animation:azChip 4.2s ease-in-out infinite}.az-motion-stage .chip.two{right:34%;bottom:13%;animation:azChip 5.4s ease-in-out infinite reverse}.az-motion-stage .chip b{color:#fff;margin-left:5px;}
    .az-motion-stage .badge{position:absolute;right:7%;bottom:8%;padding:8px 11px;border:1px solid rgba(255,216,79,.15);border-radius:999px;background:rgba(8,11,9,.35);backdrop-filter:blur(14px);font:700 7px/1 Vazirmatn,Tahoma,sans-serif;letter-spacing:.08em;color:rgba(255,216,79,.62);animation:azBadge 3.5s ease-in-out infinite;}
    @keyframes azSpin{to{transform:rotate(360deg)}}
    @keyframes azFloatRing{0%,100%{transform:translate3d(0,0,0) rotate(0)}50%{transform:translate3d(-12px,14px,0) rotate(8deg)}}
    @keyframes azDot{to{transform:rotate(360deg) translateX(175px) rotate(-360deg)}}
    @keyframes azOrbit{to{transform:rotate(336deg)}}
    @keyframes azBeam{0%,100%{transform:translateX(35%);opacity:0}35%{opacity:1}70%{transform:translateX(-28%);opacity:.5}}
    @keyframes azGrid{to{transform:translate3d(-64px,64px,0)}}
    @keyframes azCross{0%,100%{transform:scale(.92) rotate(0);opacity:.22}50%{transform:scale(1.08) rotate(90deg);opacity:.6}}
    @keyframes azSpark{0%,100%{transform:translate3d(0,0,0) scale(.5);opacity:.12}50%{transform:translate3d(-12px,-18px,0) scale(1.6);opacity:1}}
    @keyframes azChip{0%,100%{transform:translate3d(0,0,0);opacity:.5}50%{transform:translate3d(-7px,-8px,0);opacity:.9}}
    @keyframes azBadge{0%,100%{transform:translateY(0);opacity:.42}50%{transform:translateY(-4px);opacity:.8}}
    @media(max-width:700px){.az-motion-stage{opacity:.58}.az-motion-stage .r1{width:300px;height:300px;right:-110px;top:8%}.az-motion-stage .r2{width:190px;height:190px;right:5%;top:27%}.az-motion-stage .r3{width:90px;height:90px;right:25%;top:39%}.az-motion-stage .orbit{width:250px;height:90px;right:-5%;top:35%}.az-motion-stage .grid{width:75%;background-size:52px 52px}.az-motion-stage .crosshair{right:22%;top:29%;width:65px;height:65px}.az-motion-stage .chip{font-size:6px}.az-motion-stage .chip.two{display:none}.az-motion-stage .badge{right:5%;bottom:5%;font-size:6px}}
    @media(prefers-reduced-motion:reduce){.az-motion-stage *{animation:none!important}}
  `;
  document.head.appendChild(style);

  function mount(){
    const hero=document.querySelector('.heroBox');
    if(!hero||hero.querySelector('.az-motion-stage')) return;
    const stage=document.createElement('div');
    stage.className='az-motion-stage';
    stage.setAttribute('aria-hidden','true');
    stage.innerHTML=`<div class="grid"></div><div class="beam"></div><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div><div class="orbit"></div><div class="crosshair"></div><i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i><i class="spark s4"></i><div class="chip one"><b>01</b> PRECISION</div><div class="chip two"><b>02</b> INDUSTRIAL</div><div class="badge">AZIM ABZAR • PROFESSIONAL TOOLS</div>`;
    hero.appendChild(stage);
    hero.addEventListener('pointermove',e=>{if(window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;stage.style.transform=`translate3d(${x*-9}px,${y*-6}px,0)`},{passive:true});
    hero.addEventListener('pointerleave',()=>{stage.style.transform=''});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
