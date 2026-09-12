window.AZIM_CATALOG_READY=(async()=>{
  const files=Array.from({length:8},(_,i)=>`azim-catalog-chunk-${i+1}.js?v=catalog1855-price20`);
  const load=u=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=u;s.onload=resolve;s.onerror=()=>reject(new Error('خطا در بارگذاری بخش کاتالوگ: '+u));document.head.appendChild(s)});
  try{
    window.AZIM_CATALOG_PARTS=[];
    for(const f of files)await load(f);
    const raw=window.AZIM_CATALOG_PARTS.flat();
    const data=raw.map(p=>({...p,price:Number(p.original_price??p.price)}));
    if(!Array.isArray(data)||data.length!==1855)throw new Error(`تعداد محصولات نادرست است: ${data.length} (باید ۱۸۵۵ باشد)`);
    if(data.some(p=>!p||!String(p.name||'').trim()||!Number.isFinite(Number(p.price))))throw new Error('داده محصول نامعتبر است');
    window.AZIM_CATALOG=data;
    window.AZIM_PRODUCTS=data;
    return data;
  }catch(e){throw new Error(e?.message||'خطا در بارگذاری کاتالوگ')}
})();
