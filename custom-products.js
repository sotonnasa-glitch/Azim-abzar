// Apply catalog pricing after the local catalog chunks have been loaded.
(()=>{try{
const EXPECTED_CATALOG_COUNT=423;
const apply=()=>{if(!Array.isArray(window.AZIM_CATALOG)||!window.AZIM_CATALOG.length)return false;window.AZIM_CATALOG=window.AZIM_CATALOG.map((p,i)=>{const base=Number(p.original_price??p.price)||0;return{...p,original_price:base,price:Math.round(base*1.2),code:p.code||`PDF-${String(i+1).padStart(4,'0')}`,img:p.img||'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=900&q=85'}});if(window.AZIM_CATALOG.length!==EXPECTED_CATALOG_COUNT)console.warn(`Azim catalog count mismatch: expected ${EXPECTED_CATALOG_COUNT}, got ${window.AZIM_CATALOG.length}`);try{if(typeof products!=='undefined'&&typeof normalize==='function'){products=normalize(window.AZIM_CATALOG);page=1;if(typeof render==='function')render()}}catch(e){console.warn('Azim render',e)}document.dispatchEvent(new CustomEvent('azim-catalog-loaded',{detail:{count:window.AZIM_CATALOG.length}}));return true};
const start=()=>{if(!apply())console.error('Azim catalog was not loaded')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}catch(e){console.error('Azim catalog loader',e)}})();
