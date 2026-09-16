(() => {
  if (window.__azimHomeGallery) return;
  window.__azimHomeGallery = true;
  const style = document.createElement('style');
  style.textContent = `
    .az-home-gallery{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;}
    .az-home-gallery:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,5,4,.98) 0%,rgba(3,5,4,.82) 32%,rgba(3,5,4,.18) 72%,rgba(3,5,4,.08) 100%);}
    .az-photo-track{position:absolute;right:-8%;top:6%;width:74%;height:88%;display:flex;align-items:center;gap:22px;transform:rotate(-7deg);animation:azGalleryDrift 22s linear infinite;}
    .az-photo{position:relative;flex:0 0 250px;height:390px;border-radius:30px;overflow:hidden;border:1px solid rgba(255,255,255,.16);background:#101410;box-shadow:0 30px 80px rgba(0,0,0,.42),0 0 50px rgba(245,185,0,.05);transform:translateY(0) scale(.94);animation:azPhotoFloat 6.5s ease-in-out infinite;}
    .az-photo:nth-child(2){height:470px;transform:translateY(-12px) scale(1);animation-delay:-2.1s;}
    .az-photo:nth-child(3){height:350px;animation-delay:-4.2s;}
    .az-photo:nth-child(4){height:430px;animation-delay:-1.1s;}
    .az-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.92) contrast(1.05);transform:scale(1.06);animation:azImageZoom 10s ease-in-out infinite alternate;}
    .az-photo .shine{position:absolute;inset:-20%;background:linear-gradient(110deg,transparent 42%,rgba(255,216,79,.22) 50%,transparent 58%);transform:translateX(-80%) rotate(3deg);animation:azPhotoShine 7s ease-in-out infinite;}
    .az-photo .meta{position:absolute;right:14px;bottom:14px;left:14px;padding:10px 12px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(5,7,6,.42);backdrop-filter:blur(14px);color:#f7f8f6;font:700 9px/1.7 Vazirmatn,Tahoma,sans-serif;text-align:right;z-index:2;}
    .az-photo .meta b{display:block;color:#ffd84f;font-size:8px;letter-spacing:.08em;}
    @keyframes azGalleryDrift{0%{transform:translate3d(3%,0,0) rotate(-7deg)}50%{transform:translate3d(-7%,1.5%,0) rotate(-7deg)}100%{transform:translate3d(3%,0,0) rotate(-7deg)}}
    @keyframes azPhotoFloat{0%,100%{margin-top:0}50%{margin-top:-18px}}
    @keyframes azImageZoom{from{transform:scale(1.05) translate3d(0,0,0)}to{transform:scale(1.12) translate3d(-1.5%, -1%,0)}}
    @keyframes azPhotoShine{0%,68%,100%{transform:translateX(-85%);opacity:0}76%{opacity:1}90%{transform:translateX(85%);opacity:.25}}
    @media(max-width:700px){.az-home-gallery{opacity:.72}.az-photo-track{right:-36%;top:8%;width:130%;height:80%;gap:10px}.az-photo{flex-basis:145px;height:250px;border-radius:20px}.az-photo:nth-child(2){height:305px}.az-photo:nth-child(3){height:225px}.az-photo:nth-child(4){height:275px}.az-photo .meta{display:none}.az-home-gallery:after{background:linear-gradient(90deg,rgba(3,5,4,1) 0%,rgba(3,5,4,.92) 34%,rgba(3,5,4,.34) 100%)}}
    @media(prefers-reduced-motion:reduce){.az-home-gallery *{animation:none!important}}
  `;
  document.head.appendChild(style);
  function mount(){
    const hero=document.querySelector('.heroBox');
    if(!hero||hero.querySelector('.az-home-gallery')) return;
    const gallery=document.createElement('div');
    gallery.className='az-home-gallery';
    gallery.setAttribute('aria-hidden','true');
    gallery.innerHTML=`<div class="az-photo-track">
      <figure class="az-photo"><img src="https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=88" alt="ابزار حرفه‌ای در کارگاه"><span class="shine"></span><figcaption class="meta"><b>WORKSHOP</b>محیط حرفه‌ای ابزار</figcaption></figure>
      <figure class="az-photo"><img src="https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=900&q=88" alt="مجموعه ابزار روی میز کار"><span class="shine"></span><figcaption class="meta"><b>PRECISION</b>ابزار دقیق و کاربردی</figcaption></figure>
      <figure class="az-photo"><img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=88" alt="تجهیزات کارگاهی و فنی"><span class="shine"></span><figcaption class="meta"><b>INDUSTRIAL</b>تجهیزات صنعتی</figcaption></figure>
      <figure class="az-photo"><img src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=88" alt="جزئیات فنی و مهندسی"><span class="shine"></span><figcaption class="meta"><b>ENGINEERING</b>دقت مهندسی</figcaption></figure>
    </div>`;
    hero.appendChild(gallery);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
