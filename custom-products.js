// Full catalog loader — uses the historical restored catalog blob, which contains the complete catalog dataset.
(()=>{
  const HISTORICAL='https://raw.githubusercontent.com/sotonnasa-glitch/Azim-abzar/e1421ee34f63798246519a6e255621be4404fbb8/azim-catalog-data.js';
  const load=()=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=HISTORICAL+'?v=full-catalog-1';
    s.async=false;
    s.onload=resolve;
    s.onerror=()=>reject(new Error('full historical catalog failed to load'));
    document.head.appendChild(s);
  });
  const normalizeRows=()=>{
    const raw=Array.isArray(window.AZIM_CATALOG)?window.AZIM_CATALOG:[];
    window.AZIM_CATALOG=raw.map((r,i)=>({
      name:String(r?.name??r?.title??'محصول').replace(/\s+/g,' ').trim(),
      original_price:Number(r?.original_price??r?.basePrice??r?.price)||0,
      price:Number(r?.price??r?.salePrice)||0,
      brand:String(r?.brand??'').trim()||'بدون برند',
      code:String(r?.code??`PDF-${String(i+1).padStart(4,'0')}`).trim(),
      cat:r?.cat||r?.category||'hand',
      img:r?.img||r?.image||'',
      atlasIndex:i,
      description:r?.description||r?.desc||'اطلاعات محصول از کاتالوگ اصلی عظیم ابزار.'
    }));
    document.dispatchEvent(new CustomEvent('azim-catalog-loaded',{detail:{count:window.AZIM_CATALOG.length}}));
    if(typeof window.loadCatalog==='function') window.loadCatalog();
    if(typeof window.render==='function'){
      window.products=window.AZIM_CATALOG.slice();
      window.page=1;
      window.render();
    }
    document.querySelectorAll('#count,#sourceCount,#footerCount').forEach(el=>{ if(el.id==='footerCount') el.textContent=new Intl.NumberFormat('fa-IR').format(window.AZIM_CATALOG.length)+' محصول'; else el.textContent=new Intl.NumberFormat('fa-IR').format(window.AZIM_CATALOG.length); });
  };
  const start=()=>load().then(normalizeRows).catch(e=>console.error('Azim full catalog:',e));
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
