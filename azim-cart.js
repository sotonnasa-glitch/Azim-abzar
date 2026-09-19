(function(){
  'use strict';

  const KEY = 'azim_abzar_cart_v2';
  const SUPABASE_URL = window.AZIM_SUPABASE_URL || '';
  const ANON_KEY = window.AZIM_SUPABASE_ANON_KEY || '';

  const state = {
    items: [],
    couponCode: '',
    coupon: null,
    syncing: false
  };

  const fmt = n => new Intl.NumberFormat('fa-IR').format(Math.max(0, Number(n) || 0));
  const money = n => fmt(n) + ' تومان';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function read(){
    try{
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : [];
      state.items = Array.isArray(data) ? data.filter(Boolean).map(x => ({
        key: String(x.key || ((x.product_id || '')+'|'+(x.variant_label || ''))),
        product_id: String(x.product_id || ''),
        code: String(x.code || ''),
        name: String(x.name || 'محصول'),
        img: String(x.img || ''),
        variant_label: x.variant_label ? String(x.variant_label) : '',
        unit_price: Number(x.unit_price || 0),
        base_price: Number(x.base_price || x.unit_price || 0),
        qty: Math.min(99, Math.max(1, Number(x.qty || 1)))
      })).filter(x => x.product_id) : [];
    }catch(_){ state.items = []; }
    return state.items;
  }

  function write(){
    try{ localStorage.setItem(KEY, JSON.stringify(state.items)); }catch(_){}
    updateBadges();
  }

  function find(key){ return state.items.find(x => x.key === key); }

  function add(item){
    const productId = String(item?.product_id || item?.id || '');
    if(!productId) return false;
    const variant = String(item?.variant_label || item?.variant || '');
    const price = Number(item?.unit_price ?? item?.price ?? 0);
    if(!(price > 0)) return false;
    const key = productId + '|' + variant;
    const existing = find(key);
    if(existing){
      existing.qty = Math.min(99, existing.qty + Math.max(1, Number(item.qty || 1)));
    }else{
      state.items.push({
        key, product_id:productId, code:String(item.code || productId),
        name:String(item.name || 'محصول'), img:String(item.img || ''),
        variant_label:variant, unit_price:price, base_price:Number(item.base_price ?? price),
        qty:Math.min(99, Math.max(1, Number(item.qty || 1)))
      });
    }
    write();
    return true;
  }

  function update(key, qty){
    const x = find(key);
    if(!x) return;
    x.qty = Math.min(99, Math.max(1, Number(qty || 1)));
    write();
  }

  function remove(key){
    state.items = state.items.filter(x => x.key !== key);
    write();
  }

  function clear(){
    state.items = [];
    state.couponCode = '';
    state.coupon = null;
    write();
  }

  function count(){
    return state.items.reduce((s,x)=>s + Number(x.qty || 0),0);
  }

  function subtotal(){
    return state.items.reduce((s,x)=>s + Number(x.unit_price||0)*Number(x.qty||0),0);
  }

  function updateBadges(){
    const n = count();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = n.toLocaleString('fa-IR');
      el.hidden = n < 1;
    });
    document.querySelectorAll('[data-cart-empty-state]').forEach(el => {
      el.hidden = n > 0;
    });
  }

  function showToast(msg){
    let t = document.getElementById('azCartToast');
    if(!t){
      t = document.createElement('div');
      t.id='azCartToast';
      t.className='az-cart-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>t.classList.remove('show'),2200);
  }

  function addButton(item){
    const ok = add(item);
    if(!ok) return showToast('قیمت این محصول برای افزودن به سبد مشخص نیست.');
    showToast('✓ محصول به سبد سفارش اضافه شد');
    return true;
  }

  async function syncPrices(){
    if(!SUPABASE_URL || !ANON_KEY || !state.items.length || state.syncing) return;
    state.syncing = true;
    try{
      const url = SUPABASE_URL + '/rest/v1/products?select=id,code,name,img,price,variants,is_active,brand,category_name,cat,discount_type,discount_value,discount_is_active,discount_starts_at,discount_ends_at&limit=2000';
      const r = await fetch(url,{
        headers:{apikey:ANON_KEY,Authorization:'Bearer '+ANON_KEY},
        cache:'no-store'
      });
      if(!r.ok) throw new Error('catalog '+r.status);
      const rows = await r.json();
      const map = new Map(rows.map(x=>[String(x.id),x]));
      const byCode = new Map(rows.map(x=>[String(x.code || '').trim().toUpperCase(),x]).filter(([k])=>k));
      for(const item of state.items){
        const p = map.get(item.product_id) || byCode.get(String(item.code || '').trim().toUpperCase());
        if(!p) { item.unavailable = true; continue; }
        if(!item.product_id && p.id) item.product_id = String(p.id);
        item.unavailable = p.is_active === false;
        item.name = p.name || item.name;
        item.code = p.code || item.code;
        item.img = p.img || item.img;
        let unit = Number(p.price || 0);
        if(item.variant_label){
          const vs = Array.isArray(p.variants) ? p.variants : [];
          const v = vs.find(v => String(v?.size ?? v?.label ?? v?.name ?? '').trim() === item.variant_label);
          if(!v){ item.unavailable=true; continue; }
          if(v.price != null && Number(v.price)>0) unit = Number(v.price);
        }
        const now=Date.now();
        const ds= p.discount_starts_at ? new Date(p.discount_starts_at).getTime() : -Infinity;
        const de= p.discount_ends_at ? new Date(p.discount_ends_at).getTime() : Infinity;
        if(p.discount_is_active && Number(p.discount_value)>0 && now>=ds && now<=de){
          if(p.discount_type==='percentage') unit=Math.max(0,Math.floor(unit*(100-Math.min(100,Math.max(1,Number(p.discount_value))))/100));
          else if(p.discount_type==='fixed') unit=Math.max(0,unit-Number(p.discount_value));
        }
        if(unit>0) item.unit_price=unit;
      }
      state.items = state.items.filter(x=>!x.unavailable);
      write();
    }catch(_){}
    finally{ state.syncing=false; }
  }

  async function rpc(params){
    if(!SUPABASE_URL || !ANON_KEY) throw new Error('اتصال فروشگاه در دسترس نیست.');
    const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/azim_cart_checkout',{
      method:'POST',
      headers:{
        apikey:ANON_KEY,
        Authorization:'Bearer '+ANON_KEY,
        'Content-Type':'application/json'
      },
      body:JSON.stringify(params)
    });
    let data=null;
    try{ data=await r.json(); }catch(_){}
    if(!r.ok){
      const msg = data?.message || data?.error_description || data?.hint || 'خطا در ارتباط با فروشگاه.';
      throw new Error(msg);
    }
    return data;
  }

  async function previewCoupon(code,mobile){
    const clean=String(code||'').trim().toUpperCase().replace(/\s+/g,'');
    if(!clean){
      state.couponCode=''; state.coupon=null; return null;
    }
    const data=await rpc({
      p_mode:'preview',
      p_full_name:null,
      p_mobile:String(mobile||'').trim(),
      p_email:null,
      p_address:null,
      p_city:null,
      p_discount_code:clean,
      p_items:state.items.map(x=>({product_id:x.product_id,variant_label:x.variant_label||null,quantity:x.qty}))
    });
    state.couponCode=clean;
    state.coupon=data;
    return data;
  }

  function cartNavHtml(){
    return '<a href="cart.html" class="az-cart-link" data-cart-link aria-label="سبد سفارش"><span class="az-cart-icon">🛒</span><span>سبد سفارش</span><b class="az-cart-badge" data-cart-count hidden>۰</b></a>';
  }

  function injectFloatingCart(){
    if(document.querySelector('[data-cart-link]')) return;
    const a=document.createElement('a');
    a.href='cart.html';
    a.className='az-floating-cart';
    a.setAttribute('aria-label','سبد سفارش');
    a.innerHTML='<span class="az-floating-cart-icon">🛒</span><span>سبد سفارش</span><b data-cart-count hidden>۰</b>';
    document.body.appendChild(a);
  }

  function addSharedStyles(){
    if(document.getElementById('az-cart-shared-style')) return;
    const s=document.createElement('style');
    s.id='az-cart-shared-style';
    s.textContent=[
      '.az-cart-link{position:relative;display:inline-flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid rgba(245,185,0,.28);border-radius:11px;background:rgba(245,185,0,.07);color:#ffe585;font:800 12px Vazirmatn,system-ui,sans-serif;white-space:nowrap;transition:.2s ease}',
      '.az-cart-link:hover{border-color:rgba(245,185,0,.65);background:rgba(245,185,0,.14);transform:translateY(-1px)}',
      '.az-cart-icon{font-size:15px;line-height:1}',
      '.az-cart-badge{min-width:18px;height:18px;display:grid;place-items:center;padding:0 4px;border-radius:999px;background:#f5b900;color:#111;font-size:10px;line-height:18px}',
      '.az-floating-cart{position:fixed;left:16px;bottom:18px;z-index:90;display:inline-flex;align-items:center;gap:8px;padding:10px 13px;border:1px solid rgba(245,185,0,.45);border-radius:14px;background:rgba(12,16,13,.94);box-shadow:0 14px 34px rgba(0,0,0,.42);color:#fff;text-decoration:none;font:800 12px Vazirmatn,system-ui,sans-serif;backdrop-filter:blur(12px)}',
      '.az-floating-cart:hover{border-color:#ffd84f;box-shadow:0 16px 38px rgba(0,0,0,.48),0 0 18px rgba(245,185,0,.16)}',
      '.az-floating-cart-icon{font-size:16px}.az-floating-cart b{min-width:20px;height:20px;display:grid;place-items:center;border-radius:999px;background:#f5b900;color:#111;font-size:10px}',
      '.az-cart-toast{position:fixed;right:50%;bottom:24px;transform:translate(50%,120px);opacity:0;z-index:200;padding:11px 16px;border:1px solid rgba(245,185,0,.46);border-radius:12px;background:#121713;color:#fff;box-shadow:0 16px 40px rgba(0,0,0,.5);font:800 12px Vazirmatn,system-ui,sans-serif;transition:.28s ease}.az-cart-toast.show{transform:translate(50%,0);opacity:1}'
    ].join('');
    document.head.appendChild(s);
  }

  function initShared(){
    read();
    addSharedStyles();
    injectFloatingCart();
    updateBadges();
    window.addEventListener('storage',()=>{read();updateBadges();});
  }

  window.AZIM_CART = {
    add:addButton, remove, update, clear, count, items:()=>state.items.slice(), subtotal,
    syncPrices, previewCoupon, showToast, format:money, raw:state, cartNavHtml
  };

  document.addEventListener('DOMContentLoaded',initShared);
})();