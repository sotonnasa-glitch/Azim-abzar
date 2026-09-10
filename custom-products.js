// Azim Abzar catalog loader v110 — 433 catalog rows + real product photo extracted from the source PDF.
(()=>{
  const PARTS=['./azim-catalog-part-1.js?v=110','./azim-catalog-part-2.js?v=110'];
  const labels={wrench:'آچار و بکس',hand:'ابزار دستی',workshop:'تعمیرگاهی',measure:'اندازه‌گیری',power:'برقی / بادی',safety:'ایمنی'};
  const catalogPhoto='./assets/pdf-product.svg?v=110';
  const fallbackImages={
    wrench:catalogPhoto,
    hand:catalogPhoto,
    workshop:catalogPhoto,
    measure:catalogPhoto,
    power:catalogPhoto,
    safety:catalogPhoto
  };
  const classify=(name='')=>{
    const s=String(name).toLowerCase();
    if(/بکس|آچار|آلن|جغجغه|ستاره|رینگی/.test(s))return'wrench';
    if(/مولتی|متر|گیج|ترمومتر|تست باطری|تست باتری/.test(s))return'measure';
    if(/بادی|دریل|فرز|اره|کمپرسور/.test(s))return'power';
    if(/ایمنی|عینک|دستکش|ماسک|کلاه/.test(s))return'safety';
    if(/تعمیر|پولوس|سیبک|انژکتور|تایم|صافکاری|جک|کمپرسنج/.test(s))return'workshop';
    return'hand';
  };
  const forceVisibleImages=()=>{
    document.querySelectorAll('.pic').forEach((el,index)=>{
      if(el.querySelector('img'))return;
      let url='';
      const bg=el.style.backgroundImage||getComputedStyle(el).backgroundImage||'';
      const m=bg.match(/url\\((?:\"|')?(.*?)(?:\"|')?\\)/);
      if(m&&m[1])url=m[1];
      if(!url)url=catalogPhoto;
      const img=document.createElement('img');
      img.loading='lazy';
      img.decoding='async';
      img.alt='تصویر محصول عظیم ابزار';
      img.src=url;
      img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0';
      img.onerror=()=>{img.onerror=null;img.src=catalogPhoto};
      el.style.position='relative';
      el.style.overflow='hidden';
      el.insertBefore(img,el.firstChild);
    });
  };
  const watchGrid=()=>{
    const grid=document.getElementById('grid');
    if(!grid||grid.dataset.imageWatcher==='1')return;
    grid.dataset.imageWatcher='1';
    new MutationObserver(()=>forceVisibleImages()).observe(grid,{childList:true,subtree:true});
    forceVisibleImages();
  };
  const apply=()=>{
    const a=Array.isArray(window.AZIM_PART_1)?window.AZIM_PART_1:[];
    const b=Array.isArray(window.AZIM_PART_2)?window.AZIM_PART_2:[];
    const rows=a.concat(b);
    if(!rows.length)return false;
    window.AZIM_CATALOG=rows.map((r,i)=>{
      const original=Number(r?.[1])||0;
      const name=String(r?.[0]??'محصول').replace(/\s+/g,' ').trim();
      const code=String(r?.[3]??'').replace(/\s+/g,' ').trim()||`PDF-${String(i+1).padStart(4,'0')}`;
      const cat=classify(name);
      return{name,original_price:original,price:Math.round(original*1.2),brand:String(r?.[2]??'بدون برند').trim()||'بدون برند',code,cat,img:fallbackImages[cat],description:`${labels[cat]} · اطلاعات این محصول از کاتالوگ عظیم ابزار.`};
    }).filter(p=>p.name);
    try{if(typeof normalize==='function'&&typeof render==='function'){products=normalize(window.AZIM_CATALOG);page=1;render();}}catch(e){console.warn('Azim catalog render sync',e)}
    document.dispatchEvent(new CustomEvent('azim-catalog-loaded',{detail:{count:window.AZIM_CATALOG.length}}));
    document.dispatchEvent(new Event('azim-catalog-ready'));
    setTimeout(watchGrid,0);
    setTimeout(forceVisibleImages,50);
    return true;
  };
  const loadScript=(src)=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(`catalog part failed: ${src}`));document.head.appendChild(s)});
  const fail=()=>{const el=document.getElementById('error');if(el){el.textContent='بارگذاری کاتالوگ انجام نشد. فایل‌های part کاتالوگ در دسترس نیستند.';el.style.display='block'}const ld=document.getElementById('loading');if(ld)ld.style.display='none';const info=document.getElementById('info');if(info)info.textContent='خطا در بارگذاری کاتالوگ'};
  const start=async()=>{if(apply())return;try{await loadScript(PARTS[0]);await loadScript(PARTS[1]);if(!apply())fail()}catch(e){console.error('Azim catalog parts load failed',e);setTimeout(()=>{if(!apply())fail()},500)}};
  document.addEventListener('azim-catalog-ready',()=>{if(!window.AZIM_CATALOG||!window.AZIM_CATALOG.length)apply()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();