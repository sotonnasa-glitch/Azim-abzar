(async()=>{
  try{
    if(!window.AZIM_SUPABASE_URL||!window.AZIM_SUPABASE_ANON_KEY)return;
    const r=await fetch(window.AZIM_SUPABASE_URL+'/rest/v1/products?select=id,name,brand,cat,code,badge,desc,img,created_at&order=created_at.asc',{headers:{apikey:window.AZIM_SUPABASE_ANON_KEY,Authorization:'Bearer '+window.AZIM_SUPABASE_ANON_KEY}});
    if(!r.ok)throw new Error('Supabase products request failed');
    const extra=await r.json();
    if(!Array.isArray(extra)||!extra.length)return;
    const normalized=extra.filter(p=>p&&p.name&&p.cat).map(p=>({...p,img:p.img||'',badge:p.badge||''}));
    products.push(...normalized);
    const total=document.getElementById('totalCount');
    if(total)total.textContent=fa(products.length)+'+';
    const footer=document.querySelector('.footer b');
    if(footer)footer.textContent=fa(products.length)+' محصول آماده نمایش';
    render();
  }catch(e){console.warn('Supabase products load failed',e)}
})();
