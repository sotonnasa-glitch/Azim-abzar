// Full catalog loader — use the restored historical catalog blob and wait for its async decompression.
(()=>{
  const HISTORICAL='https://raw.githubusercontent.com/sotonnasa-glitch/Azim-abzar/e1421ee34f63798246519a6e255621be4404fbb8/azim-catalog-data.js';
  const apply=()=>{
    const raw=Array.isArray(window.AZIM_CATALOG)?window.AZIM_CATALOG:[];
    if(raw.length<1)return;
    window.AZIM_CATALOG=raw.map((r,i)=>({
      name:String(r?.name??r?.title??'محصول').replace(/\s+/g,' ').trim(),
      original_price:Number(r?.original_price??r?.basePrice??r?.price)||0,
      price:Number(r?.price??r?.salePrice)||0,
      brand:String(r?.brand??'').trim()||'بدون برند',
      code:String(r?.code??`PDF-${String(i+1).padStart(4,'0')}`).trim(),
      cat:r?.cat||r?.category||'hand', img:r?.img||r?.image||'', atlasIndex:i,
      description:r?.description||r?.desc||'اطلاعات محصول از کاتالوگ اصلی عظیم ابزار.'
    }));
    if(typeof window.loadCatalog==='function') window.loadCatalog();
    if(typeof window.render==='function'){ window.products=window.AZIM_CATALOG.slice(); window.page=1; window.render(); }
    const n=new Intl.NumberFormat('fa-IR').format(window.AZIM_CATALOG.length);
    const count=document.getElementById('count'); if(count)count.textContent=n;
    const source=document.getElementById('sourceCount'); if(source)source.textContent=n;
    const footer=document.getElementById('footerCount'); if(footer)footer.textContent=n+' محصول';
    const info=document.getElementById('info'); if(info)info.innerHTML='کاتالوگ کامل بارگذاری شد: <b>'+n+'</b> محصول';
  };
  window.addEventListener('azim-catalog-ready',apply,{once:true});
  const s=document.createElement('script'); s.src=HISTORICAL+'?v=full-catalog-2'; s.async=false; s.onerror=()=>console.error('Full catalog failed to load'); document.head.appendChild(s);
})();
