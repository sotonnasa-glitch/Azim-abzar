#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = 'https://azimabzar.com'; // production proxy now tracks main source
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 900 };
const PUBLIC_PAGES = [
  '/',
  '/products-v4.html',
  '/wishlist.html',
  '/cart.html',
  '/contact.html',
  '/order-status.html',
  '/ai.html',
  '/privacy.html',
  '/terms.html',
  '/payment-callback.html',
  '/admin.html',
  '/404.html',
];
const LEGACY_REDIRECTS = [
  '/products.html',
  '/products2.html',
  '/products-v2.html',
  '/products-v3.html',
  '/products-v5.html',
];
const IGNORE_CONSOLE = /cloudflareinsights|beacon\.min\.js|insights|frame-ancestors.*ignored.*meta/i;

function cleanPath(url){
  try{return new URL(url).pathname || '/';}catch{return '';}
}

async function getWithRetry(context, url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await context.request.get(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function auditPage(browser, path){
  const context = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 1, isMobile:true, hasTouch:true });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const sameOriginFailed = [];

  page.on('console', msg => {
    if(msg.type()==='error' && !IGNORE_CONSOLE.test(msg.text())) consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(String(err?.stack || err)));
  page.on('requestfailed', req => {
    const u=req.url();
    if(u.startsWith(BASE) && !/insights|favicon/i.test(u)) sameOriginFailed.push(u+' :: '+String(req.failure()?.errorText||'failed'));
  });

  const response = await page.goto(BASE + path, {waitUntil:'domcontentloaded', timeout:60000});
  await page.waitForTimeout(900);
  if(path === '/' && response){
    console.log('ROOT_RESPONSE_HEADERS '+JSON.stringify({
      status:response.status(),
      contentType:response.headers()['content-type'],
      csp:response.headers()['content-security-policy']||'',
      cspReportOnly:response.headers()['content-security-policy-report-only']||'',
      xFrame:response.headers()['x-frame-options']||'',
      server:response.headers()['server']||'',
      location:response.headers()['location']||''
    }));
  }
  assert.ok(response, path+': no response');
  assert.ok(response.status() < 400 || path === '/404.html', path+': HTTP '+response.status());

  const metrics = await page.evaluate(() => {
    const vw=document.documentElement.clientWidth;
    const offenders=[...document.querySelectorAll('body *')].map(el=>{
      const r=el.getBoundingClientRect();
      return {tag:el.tagName,id:el.id,cls:String(el.className||'').slice(0,80),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};
    }).filter(x=>x.left < -1 || x.right > vw + 1).sort((a,b)=>(b.right-vw)-(a.right-vw)).slice(0,8);
    return {
      title:document.title,
      viewport:!!document.querySelector('meta[name="viewport"]'),
      clientWidth:vw,
      scrollWidth:document.documentElement.scrollWidth,
      scale:window.visualViewport?.scale||1,
      offenders,
      links:[...document.querySelectorAll('a[href]')].map(a=>a.href),
      buttons:[...document.querySelectorAll('button')].map(b=>({text:(b.innerText||'').trim(),id:b.id,disabled:b.disabled})).filter(x=>x.text||x.id),
      videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc||v.src,readyState:v.readyState,paused:v.paused,networkState:v.networkState,error:v.error?{code:v.error.code,message:v.error.message}:null})),
      forms:[...document.querySelectorAll('form')].map(f=>f.id||f.className||'form'),
    };
  });

  assert.ok(metrics.title, path+': missing document title');
  assert.ok(metrics.viewport, path+': missing viewport meta');
  assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, path+': horizontal overflow '+JSON.stringify(metrics.offenders));
  assert.equal(metrics.scale, 1, path+': mobile visual scale '+metrics.scale);
  assert.equal(pageErrors.length,0,path+': page errors '+pageErrors.join(' | '));
  assert.equal(consoleErrors.length,0,path+': console errors '+consoleErrors.join(' | '));
  assert.equal(sameOriginFailed.length,0,path+': same-origin failed requests '+sameOriginFailed.join(' | '));

  for(const href of [...new Set(metrics.links)].slice(0,80)){
    if(!href.startsWith(BASE)) continue;
    const u=new URL(href);
    if(u.hash && u.pathname===new URL(BASE+path).pathname && !u.search) continue;
    if(/\.(pdf|mp4|jpg|jpeg|png|webp|svg|ico|css|js|json)$/i.test(u.pathname)) continue;
    const rr=await getWithRetry(context,href,{timeout:30000});
    assert.ok(rr.status()<400, path+': broken same-origin link '+href+' => '+rr.status());
  }

  await context.close();
  return {path, ok:true, buttons:metrics.buttons.length, forms:metrics.forms.length, videos:metrics.videos.length, links:metrics.links.length};
}

async function testHomepage(browser){
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[]; const failedResponses=[];
  page.on('console',m=>{if(m.type()==='error'&&!IGNORE_CONSOLE.test(m.text()))errors.push(m.text())});
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400 && r.status()!==404 || (r.status()===404 && /(?:js|css|json|svg|png|jpe?g|webp|woff2?|html)$/i.test(new URL(r.url()).pathname))) failedResponses.push(r.url()+' => '+r.status());});
  await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(1000);
  const home=await page.evaluate(()=>({
    nav:[...document.querySelectorAll('header a[href]')].map(a=>({id:a.id,href:a.getAttribute('href'),text:(a.innerText||'').trim()})),
    heroVideo:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc||v.src,readyState:v.readyState,muted:v.muted,loop:v.loop})),
    heroVisual: {
      canvas:!!document.querySelector('.az-hero-photo-canvas'),
      panels:[...document.querySelectorAll('.az-photo-panel img')].length,
      loaded:[...document.querySelectorAll('.az-photo-panel img')].filter(img=>img.complete&&img.naturalWidth>0).length
    },
    tracking:!!document.querySelector('#orderTrackingSection'),
    ai:!!document.querySelector('#nav-btn-ai'),
    productCTA:!!document.querySelector('a[href*="products-v4.html"]'),
    contactCTA:!!document.querySelector('a[href*="contact.html"]'),
  }));
  assert.equal(errors.length,0,'homepage JS errors: '+errors.join(' | '));
  assert.ok(home.nav.length>=3,'homepage header navigation is incomplete');
  assert.ok(home.productCTA,'homepage product CTA missing');
  assert.ok(home.contactCTA,'homepage contact CTA missing');
  assert.ok(home.tracking,'homepage order tracking section missing');
  assert.ok(home.ai,'homepage AI button missing');
  assert.ok(home.heroVisual.canvas,'homepage hero visual canvas missing');
  assert.ok(home.heroVisual.panels>=4,'homepage hero visual panels are incomplete');
  assert.ok(home.heroVisual.loaded>=1,'homepage hero visual images did not load');

  await page.locator('#nav-btn-ai').click();
  await page.waitForURL(/\/ai\.html/,{timeout:30000});
  await page.goBack(); await page.waitForTimeout(300);
  await page.locator('a[href*="products-v4.html"]').first().click();
  await page.waitForURL(/\/products-v4\.html/,{timeout:30000});
  await context.close();
  return {homepage:true,heroVisual:true,nav:true,tracking:true,ai:true};
}

async function testCatalog(browser){
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[]; const failedResponses=[];
  page.on('console',m=>{if(m.type()==='error'&&!IGNORE_CONSOLE.test(m.text()))errors.push(m.text())});
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400 && (r.status()!==404 || /(?:js|css|json|svg|png|jpe?g|webp|woff2?|html)$/i.test(new URL(r.url()).pathname))) failedResponses.push(r.url()+' => '+r.status());});
  await page.goto(BASE+'/products-v4.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#grid .card')||document.querySelector('[data-cart-add-link]'),null,{timeout:60000});

  const initial=await page.evaluate(()=>({cards:document.querySelectorAll('#grid .card').length,search:!!document.querySelector('#q'),sort:!!document.querySelector('#sortSelect'),cart:!!document.querySelector('#nav-btn-cart'),contact:!!document.querySelector('#nav-btn-contact'),tracking:!!document.querySelector('#nav-btn-order-tracking')}));
  assert.ok(initial.cards>0,'catalog cards did not render');
  assert.ok(initial.search&&initial.sort&&initial.cart&&initial.contact&&initial.tracking,'catalog controls missing');

  await page.locator('#sortSelect').selectOption('variants_first');
  await page.waitForTimeout(550);
  assert.ok(await page.locator('#grid .card').first().locator('select[data-id]').count()===1,
    'variants-first sort did not prioritize products with variants');

  const search=page.locator('#q');
  await search.fill('P0502');
  await page.waitForFunction(()=>!!document.querySelector('#card-P0502 img'),null,{timeout:15000});
  await page.waitForFunction(()=>{
    const img=document.querySelector('#card-P0502 .photo-wrap img');
    return !!img && img.complete && img.naturalWidth>0 && new URL(img.src).pathname.endsWith('/placeholder.svg');
  },null,{timeout:15000});
  await search.fill('P0001');
  await page.waitForFunction(()=>!!document.querySelector('#card-P0001'),null,{timeout:15000});
  assert.ok(await page.locator('#card-P0001').count(),'catalog search failed for P0001');
  await page.locator('#clearSearch').click(); await page.waitForTimeout(200);

  await page.locator('#sortSelect').selectOption({index:1}); 
  await page.waitForFunction(() => !!document.querySelector('#card-P0001 .photo-wrap'), null, {timeout:15000});
  await page.waitForTimeout(150);

  const card=page.locator('#card-P0001').first(); 
  await card.locator('.photo-wrap').click({timeout:15000});
  await page.waitForSelector('#quickModal.show',{timeout:10000});
  assert.ok(await page.locator('#quickModal .modal-box').count(),'catalog product modal missing');
  await page.locator('#closeModalBtn').click();
  await search.fill('P0001');
  await page.waitForFunction(() => !!document.querySelector('#card-P0001 .az-product-ai-btn'), null, {timeout:15000});

  await page.locator('#card-P0001 .az-product-ai-btn').first().click();
  await page.waitForSelector('#azProductAiModal.show',{timeout:10000});
  assert.ok(await page.locator('#azProductAiModal').isVisible(),'product AI assistant did not open');
  await page.locator('#azAiModalClose').click();

  await page.evaluate(()=>{
    window.AZIM_CART?.clear?.();
    window.__catalogAddCalls = [];
    const originalAdd = window.AZIM_CART?.add?.bind(window.AZIM_CART);
    if (originalAdd) window.AZIM_CART.add = payload => {
      window.__catalogAddCalls.push(payload);
      return originalAdd(payload);
    };
  });
  const p1VariantSelect = card.locator('select[data-id="P0001"]').first();
  await p1VariantSelect.waitFor({state:'visible',timeout:15000});
  const p1Options = await p1VariantSelect.locator('option').evaluateAll(nodes =>
    nodes.map((n, i) => ({ i, text: (n.textContent || '').trim() }))
  );
  const unpricedVariant = p1Options.find(x => x.text.startsWith('1-1/16'));
  assert.ok(unpricedVariant, 'P0001 unpriced variant 1-1/16 is missing');
  assert.match(unpricedVariant.text, /قیمت در لیست درج نشده/, 'unpriced variant incorrectly displays the base product price');
  await p1VariantSelect.selectOption({index:unpricedVariant.i});
  assert.match(await card.locator('[data-price]').innerText(), /قیمت در لیست درج نشده/, 'selected unpriced variant did not update card price');
  const add1=card.locator('[data-cart-add-link="P0001"]').first();
  await add1.click(); await page.waitForTimeout(500);
  const unpricedCartState = await page.evaluate(() => ({
    items: window.AZIM_CART?.items?.() || [],
    addCalls: window.__catalogAddCalls || [],
    selectedIndex: document.querySelector('#card-P0001 select[data-id="P0001"]')?.value || '',
    selectedOption: document.querySelector('#card-P0001 select[data-id="P0001"] option:checked')?.textContent || '',
    displayPrice: document.querySelector('#card-P0001 [data-price]')?.textContent || '',
    stored: localStorage.getItem('azim_abzar_cart_v2') || ''
  }));
  assert.equal(unpricedCartState.addCalls.length,0,'unpriced variant called AZIM_CART.add: '+JSON.stringify(unpricedCartState));
  assert.equal(unpricedCartState.items.length,0,'catalog added an unpriced size using the base product price: '+JSON.stringify(unpricedCartState));
  const p1Variant = p1Options.find(x => x.text === '46' || x.text.startsWith('46 '));
  assert.ok(p1Variant, 'P0001 size 46 option is missing');
  await p1VariantSelect.selectOption({index:p1Variant.i});
  await add1.click(); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => window.AZIM_CART?.items?.().some(x => x.code === 'P0001' && x.variant_label === '46')), 'catalog did not preserve selected P0001 size 46');
  assert.ok((await page.url()).includes('/products-v4.html'),'adding first product navigated away from catalog');
  assert.ok(await page.locator('[data-cart-count]').first().evaluate(el=>!el.hidden),'cart badge did not update after first add');

  await search.fill('P0002');
  await page.waitForFunction(() => !!document.querySelector('#card-P0002 [data-cart-add-link="P0002"]'), null, {timeout:15000});
  const card2=page.locator('#card-P0002').first();
  await card2.locator('[data-cart-add-link="P0002"]').first().click(); await page.waitForTimeout(300);
  assert.ok((await page.url()).includes('/products-v4.html'),'adding second product navigated away from catalog');
  const count=await page.evaluate(()=>window.AZIM_CART?.items?.().length||0);
  assert.equal(count,2,'multi-product catalog selection failed');
  assert.equal(errors.length,0,'catalog JS errors: '+errors.join(' | ')+'; failed responses: '+failedResponses.join(' | '));
  await context.close();
  return {catalog:true,search:true,sort:true,detailModal:true,productAssistant:true,multiProductAdd:true};
}

async function testWishlist(browser){
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('console',m=>{if(m.type()==='error'&&!IGNORE_CONSOLE.test(m.text()))errors.push(m.text())});
  page.on('pageerror',e=>errors.push(String(e)));

  await page.goto(BASE+'/products-v4.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('[data-wishlist-count]') && document.querySelector('#grid .card'),null,{timeout:60000});
  await page.evaluate(()=>localStorage.removeItem('azim_wishlist'));

  const search=page.locator('#q');
  await search.fill('P0001');
  await page.waitForFunction(()=>document.querySelector('#card-P0001 [data-wishlist-id]'),null,{timeout:15000});
  const wishButton=page.locator('#card-P0001 [data-wishlist-id]').first();
  const beforeWish=await wishButton.evaluate(btn=>({
    onclick:btn.getAttribute('onclick')||'',
    dataId:btn.getAttribute('data-wishlist-id')||'',
    disabled:!!btn.disabled,
    typeofToggle:typeof window.toggleWishlist
  }));
  await wishButton.click();
  const afterWish=await page.evaluate(()=>({
    raw:localStorage.getItem('azim_wishlist')||'',
    typeofToggle:typeof window.toggleWishlist,
    buttons:[...document.querySelectorAll('[data-wishlist-id]')].filter(b=>b.dataset.wishlistId==='P0001').map(b=>b.getAttribute('onclick')||'')
  }));
  assert.equal(JSON.parse(afterWish.raw||'[]').length,1,'wishlist click did not persist: '+JSON.stringify({beforeWish,afterWish}));
  assert.match(await wishButton.innerText(),/حذف از علاقه‌مندی/,'wishlist button did not switch to remove state');
  assert.equal(await page.locator('[data-wishlist-count]').first().innerText(),'۱','wishlist badge count did not update');

  await page.locator('#nav-btn-wishlist').click();
  await page.waitForURL(/\/wishlist\.html/, {timeout:30000});
  const wishlistResponses=[];
  page.on('response',r=>{if(r.url().includes('wishlist')||r.url().includes('catalog_site_mapping_908')||r.url().includes('/rest/v1/products')) wishlistResponses.push(r.url()+' => '+r.status())});
  // Wishlist resolves static metadata and then attempts a live Supabase lookup;
  // wait for its actual terminal state rather than a fixed 2.5-second sleep.
  await page.waitForFunction(()=>{
    const grid=document.querySelector('#grid');
    const status=document.querySelector('#status');
    const empty=document.querySelector('#empty.show');
    const text=(status?.textContent||'').trim();
    return !!grid?.querySelector('.card') || !!empty ||
      text==='بارگذاری علاقه‌مندی‌ها انجام نشد. دوباره تلاش کنید.' ||
      text.startsWith('بعضی از محصولات دیگر در کاتالوگ فعال نیستند');
  },null,{timeout:20000}).catch(()=>{});
  const wishDiag=await page.evaluate(()=>({
    cards:document.querySelectorAll('#grid .card').length,
    status:document.querySelector('#status')?.textContent||'',
    empty:!!document.querySelector('#empty.show'),
    raw:localStorage.getItem('azim_wishlist')||'',
    supabase:!!window.AZIM_SUPABASE_URL,
    cart:!!window.AZIM_CART
  }));
  assert.equal(wishDiag.cards,1,'wishlist did not render: '+JSON.stringify({wishDiag,wishlistResponses}));
  assert.ok(await page.locator('#grid .card img').first().evaluate(img=>img.complete&&img.naturalWidth>0),'wishlist product image did not load');
  assert.ok(await page.locator('[data-add-cart]').count()===1,'wishlist add-to-cart action missing');
  const addState=await page.locator('[data-add-cart]').first().evaluate(btn=>{
    const item=window.__wishProducts?.get(String(btn.dataset.addCart));
    return {
      dataAdd:btn.dataset.addCart,
      item:item?{id:item.id,code:item.code,name:item.name,price:item.price,variants:item.variants}:null,
      cartReady:!!window.AZIM_CART,
      before:window.AZIM_CART?.items?.().length||0
    };
  });
  await page.locator('[data-add-cart]').first().click();
  await page.waitForTimeout(300);
  const afterAdd=await page.evaluate(()=>({count:window.AZIM_CART?.items?.().length||0,items:window.AZIM_CART?.items?.()||[]}));
  assert.equal(afterAdd.count,1,'wishlist add-to-cart failed: '+JSON.stringify({addState,afterAdd}));


  await page.locator('[data-remove]').first().click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('azim_wishlist')||'[]').length===0,null,{timeout:5000});
  await page.waitForFunction(()=>document.querySelectorAll('#grid .card').length===0,null,{timeout:10000});

  assert.equal(errors.length,0,'wishlist JS errors: '+errors.join(' | '));
  await context.close();
  return {wishlist:true,toggle:true,badge:true,render:true,image:true,addToCart:true,remove:true};
}

async function testCart(browser){
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  let couponPreviewCaptured=null;
  await page.route('**/rest/v1/rpc/azim_cart_checkout',async route=>{
    const request=route.request();
    let body=null;
    try{body=request.postDataJSON();}catch(_){}
    if(body?.p_mode==='preview' && body?.p_discount_code==='AZIMTEST20'){
      couponPreviewCaptured=body;
      await route.fulfill({
        status:200,
        contentType:'application/json; charset=utf-8',
        body:JSON.stringify({
          valid:true,mode:'preview',subtotal:127200000,eligible_subtotal:127200000,
          discount:5000000,shipping_cost:0,total:122200000,
          discount_id:'00000000-0000-4000-8000-000000000003',
          discount_code:'AZIMTEST20',message:'کد آزمایشی معتبر است.'
        })
      });
      return;
    }
    await route.continue();
  });
  await page.goto(BASE+'/products-v4.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('[data-cart-add-link="P0001"]'),null,{timeout:60000});
  await page.evaluate(()=>window.AZIM_CART?.clear?.());
  // P0001 is a size-variant SKU, so choose a valid variant before testing
  // persistence; the selected variant must survive navigation to the cart.
  const p1VariantSelect = page.locator('#card-P0001 select[data-id="P0001"]').first();
  await p1VariantSelect.waitFor({state:'visible',timeout:15000});
  const p1Options = await p1VariantSelect.locator('option').evaluateAll(nodes =>
    nodes.map((n, i) => ({ i, text: (n.textContent || '').trim() }))
  );
  const p1Variant = p1Options.find(x => x.text === '46' || x.text.startsWith('46 '));
  assert.ok(p1Variant, 'P0001 size 46 option is missing in full-site cart flow');
  await p1VariantSelect.selectOption({index:p1Variant.i});
  await page.locator('#card-P0001 [data-cart-add-link="P0001"]').click();
  await page.waitForFunction(() => window.AZIM_CART?.items?.().length === 1, null, {timeout:10000});
  assert.ok(await page.evaluate(() => window.AZIM_CART?.items?.().some(x => x.code === 'P0001' && x.variant_label === '46')), 'full-site cart flow did not persist P0001 size 46');
  await page.locator('#card-P0002 [data-cart-add-link="P0002"]').click();
  await page.waitForFunction(() => window.AZIM_CART?.items?.().length === 2, null, {timeout:10000});
  await page.goto(BASE+'/cart.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(() => !!window.AZIM_CART && document.querySelector('#cartItems'), null, {timeout:15000});
  await page.waitForFunction(() => document.querySelectorAll('#cartItems .cart-row').length === 2, null, {timeout:20000});
  assert.equal(await page.locator('#cartItems .cart-row').count(),2,'cart did not render two items');
  const cartImages = page.locator('#cartItems .cart-img img');
  assert.equal(await cartImages.count(),2,'cart product image elements missing');
  // Use live locators rather than ElementHandles: the cart can re-render while
  // image loading begins, which detaches ElementHandles returned by locator.all().
  // Each locator action re-resolves its target after a re-render.
  await cartImages.nth(0).scrollIntoViewIfNeeded();
  await cartImages.nth(1).scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const imgs=[...document.querySelectorAll('#cartItems .cart-img img')];
    return imgs.length===2 && imgs.every(i=>i.complete && i.naturalWidth>0);
  }, null, {timeout:30000});
  assert.ok(await page.locator('#cartItems .cart-img img').evaluateAll(imgs=>imgs.length===2 && imgs.every(i=>i.complete&&i.naturalWidth>0)),'cart product images did not load');
  assert.ok(await page.locator('#cartItems [data-remove]').count()===2,'cart remove controls missing');

  const online=page.locator('input[name="paymentMethod"][value="online"]');
  const manualRequest=page.locator('input[name="paymentMethod"][value="phone"]');
  assert.equal(await online.count(),1,'online payment option missing');
  assert.equal(await manualRequest.count(),1,'manual order-request option is missing');
  assert.equal(await page.locator('input[name="paymentMethod"][value="message"]').count(),0,'unsupported message method was shown');
  const onlineDisabled=await online.isDisabled();
  assert.equal(await manualRequest.isChecked(),onlineDisabled,'checkout did not select the safe default method for current gateway state');

  // Coupon preview is mocked so this tests UI state without depending on a live promotion.
  await page.locator('#couponInput').fill('azimtest20');
  await page.locator('#applyCouponBtn').click();
  await page.waitForFunction(()=>document.querySelector('#couponStatus')?.textContent.includes('کد آزمایشی معتبر است.'),null,{timeout:15000});
  assert.ok(couponPreviewCaptured,'coupon button did not call checkout preview RPC');
  assert.equal(couponPreviewCaptured.p_discount_code,'AZIMTEST20','coupon code was not normalized');
  assert.equal(couponPreviewCaptured.p_items.length,2,'coupon preview did not include both cart lines');
  assert.ok((await page.locator('#discount').innerText())!=='− ۰ تومان','valid coupon discount was not displayed');

  // Changing quantity invalidates the displayed quote and clears the stale code;
  // users must explicitly re-apply so the UI never shows a misleading total.
  await page.locator('#cartItems [data-qty="1"]').first().click();
  await page.waitForFunction(()=>window.AZIM_CART?.items?.().find(x=>x.code==='P0001'&&x.variant_label==='46')?.qty===2,null,{timeout:10000});
  assert.equal(await page.locator('#couponInput').inputValue(),'','stale coupon code remained after quantity change');
  assert.equal(await page.locator('#discount').innerText(),'− ۰ تومان','discount was not cleared after basket mutation');
  assert.match(await page.locator('#couponStatus').innerText(),/سبد سفارش تغییر کرد.*کد را مجدداً اعمال کنید/,'coupon invalidation notice missing');
  await page.locator('#cartItems [data-qty="-1"]').first().click();
  await page.waitForFunction(()=>window.AZIM_CART?.items?.().find(x=>x.code==='P0001'&&x.variant_label==='46')?.qty===1,null,{timeout:10000});

  // Removing the last item must leave the visible empty-cart state and disable checkout.
  await page.locator('#cartItems [data-remove]').first().click();
  await page.waitForFunction(()=>document.querySelectorAll('#cartItems .cart-row').length===1,null,{timeout:10000});
  await page.locator('#cartItems [data-remove]').first().click();
  await page.waitForFunction(()=>document.querySelectorAll('#cartItems .cart-row').length===0,null,{timeout:10000});
  assert.equal(await page.locator('#startCheckoutBtn').isDisabled(),true,'checkout remained enabled for an empty cart');
  await context.close();
  return {cart:true,images:true,quantity:true,remove:true,emptyCartGuard:true,couponInvalidation:true,onlineOnly:true};
}


async function testManualCheckoutRequest(browser){
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('console',m=>{if(m.type()==='error'&&!IGNORE_CONSOLE.test(m.text()))errors.push(m.text())});
  page.on('pageerror',e=>errors.push(String(e)));

  let captured=null;
  await page.route('**/rest/v1/rpc/azim_cart_checkout',async route=>{
    const req=route.request();
    let body=null;
    try{body=req.postDataJSON()}catch(_){}
    if(body && body.p_mode==='submit'){
      captured={body,idempotencyKey:req.headers()['x-idempotency-key']||''};
      // This mocked response proves the complete UI flow without writing a fake
      // customer/order or triggering real Telegram notifications in production.
      await route.fulfill({
        status:200,
        contentType:'application/json; charset=utf-8',
        body:JSON.stringify({
          valid:true,
          mode:'submit',
          order_id:'00000000-0000-4000-8000-000000000001',
          order_code:'AZ-20990101-000001-ABCDE',
          customer_id:'00000000-0000-4000-8000-000000000002',
          subtotal:63600000,
          total:63600000,
          discount:0,
          shipping_cost:0,
          payment_method:'phone',
          payment_status:'unpaid',
          message:'درخواست سفارش آزمایشی ثبت شد.'
        })
      });
      return;
    }
    await route.continue();
  });

  await page.goto(BASE+'/products-v4.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!document.querySelector('[data-cart-add-link="P0001"]'),null,{timeout:60000});
  await page.waitForFunction(()=>!!window.AZIM_CART,null,{timeout:15000});
  await page.evaluate(()=>window.AZIM_CART.clear());
  const card=page.locator('#card-P0001').first();
  const select=card.locator('select[data-id="P0001"]').first();
  await select.waitFor({state:'visible',timeout:15000});
  const options=await select.locator('option').evaluateAll(nodes=>nodes.map((n,i)=>({i,text:(n.textContent||'').trim()})));
  const size46=options.find(x=>x.text==='46'||x.text.startsWith('46 '));
  assert.ok(size46,'manual checkout test could not find P0001 size 46');
  await select.selectOption({index:size46.i});
  await card.locator('[data-cart-add-link="P0001"]').first().click();
  await page.waitForFunction(()=>window.AZIM_CART?.items?.().length===1,null,{timeout:10000});

  await page.goto(BASE+'/cart.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.AZIM_CART&&document.querySelector('#cartItems'),null,{timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll('#cartItems .cart-row').length===1,null,{timeout:15000});
  await page.locator('#startCheckoutBtn').click();
  await page.locator('#checkoutBox').waitFor({state:'visible',timeout:10000});
  await page.locator('#fullName').fill('آزمون کنترل‌شده وب‌سایت');
  await page.locator('#mobile').fill('09120000000');
  await page.locator('#termsAccepted').check();
  await page.locator('input[name="paymentMethod"][value="phone"]').check();
  await page.locator('#submitOrderBtn').click();

  await page.waitForFunction(()=>{
    const success=document.querySelector('#cartSuccess');
    return success && !success.hidden && success.textContent.includes('AZ-20990101-000001-ABCDE');
  },null,{timeout:20000});

  assert.ok(captured,'manual checkout did not call the submit RPC');
  assert.equal(captured.body.p_mode,'submit','manual checkout did not send submit mode');
  assert.equal(captured.body.p_payment_method,'phone','manual checkout did not send the no-online-payment method');
  assert.equal(captured.body.p_terms_accepted,true,'manual checkout did not send terms acceptance');
  assert.equal(captured.body.p_full_name,'آزمون کنترل‌شده وب‌سایت','manual checkout sent the wrong customer name');
  assert.equal(captured.body.p_mobile,'09120000000','manual checkout sent the wrong mobile number');
  assert.ok(Array.isArray(captured.body.p_items)&&captured.body.p_items.length===1,'manual checkout sent the wrong cart items');
  assert.equal(captured.body.p_items[0].variant_label,'46','manual checkout lost the selected size');
  assert.equal(Number(captured.body.p_items[0].quantity),1,'manual checkout sent the wrong quantity');
  assert.ok(captured.idempotencyKey.length>=16,'manual checkout omitted its idempotency key');
  const success=await page.locator('#cartSuccess').innerText();
  assert.match(success,/پیش‌فاکتور با موفقیت ثبت شد/,'manual checkout did not display confirmation');
  assert.match(success,/AZ-20990101-000001-ABCDE/,'manual checkout did not display its tracking code');
  assert.equal(errors.length,0,'manual checkout browser errors: '+errors.join(' | '));

  await context.close();
  return {manualCheckoutSubmit:true,serverValidatedPayload:true,confirmation:true,trackingCode:true,idempotencyKey:true,mockedNoProductionOrder:true};
}

async function testContact(browser){
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto(BASE+'/contact.html',{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(700);
  const form=page.locator('#contactForm');
  assert.ok(await form.count(),'contact form missing');
  const fields=await form.locator('input,select,textarea').count();
  assert.ok(fields>=4,'contact form fields incomplete');
  for(const sel of ['#frm-name','#frm-mobile','#frm-details']){
    if(await page.locator(sel).count()) await page.locator(sel).first().fill('تست '+sel);
  }
  if(await page.locator('#frm-subject').count()){
    const subject = page.locator('#frm-subject').first();
    await subject.selectOption({index: Math.min(1, (await subject.locator('option').count()) - 1)});
  }
  assert.equal(await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth,scale:visualViewport?.scale||1})).then(x=>x.s),await page.evaluate(()=>document.documentElement.clientWidth),'contact page still overflows horizontally');
  assert.equal(await page.evaluate(()=>visualViewport?.scale||1),1,'contact page scale changed');
  await context.close();
  return {contact:true,form:true,responsive:true};
}

async function testOrderStatus(browser){
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto(BASE+'/order-status.html',{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(500);
  const form=page.locator('form').first();
  assert.ok(await form.count(),'order tracking form missing');
  const inputs=await form.locator('input').count(); assert.ok(inputs>=2,'order tracking inputs missing');
  await form.locator('input').nth(0).fill('AZ-99999999-000000-AAAAA');
  await form.locator('input').nth(1).fill('09120000000');
  await form.locator('button[type="submit"]').click(); await page.waitForTimeout(1000);
  const body=await page.locator('body').innerText();
  assert.ok(/یافت نشد|پیدا نشد|معتبر|مطابقت|وجود ندارد/i.test(body),'order tracking invalid-code guard did not respond');
  await context.close();
  return {orderTracking:true,invalidLookupGuard:true};
}

async function testAI(browser){
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errs=[]; page.on('console',m=>{if(m.type()==='error'&&!IGNORE_CONSOLE.test(m.text()))errs.push(m.text())}); page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(BASE+'/ai.html',{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(800);
  const form=page.locator('#chatForm'); assert.ok(await form.count(),'AI chat form missing');
  const input=form.locator('textarea').first(); const send=form.locator('button[type="submit"]').first();
  assert.ok(await input.count()&&await send.count(),'AI chat controls missing');
  await input.fill('سلام');
  await send.click(); await page.waitForTimeout(2500);
  const text=await page.locator('body').innerText();
  assert.ok(/سلام|در حال|پاسخ|خطا|اتصال|پاسخ‌گویی/i.test(text),'AI page did not react to submitted message');
  assert.equal(errs.length,0,'AI page JS errors: '+errs.join(' | '));
  await context.close();
  return {aiPage:true,form:true,submitReaction:true};
}

async function testAdmin(browser){
  const path='admin.html';
  const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto(BASE+'/'+path,{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(1200);
  const state=await page.evaluate(()=>({
    loginVisible:!document.querySelector('#loginScreen')?.classList.contains('hidden'),
    appVisible:!document.querySelector('#app')?.classList.contains('hidden'),
    email:!!document.querySelector('#loginEmail'),
    password:!!document.querySelector('#loginPassword'),
    loginBtn:!!document.querySelector('#loginBtn'),
    sidebarViews:[...document.querySelectorAll('.nav [data-view]')].map(x=>x.dataset.view),
    viewSections:[...document.querySelectorAll('.view[id^="view-"]')].map(x=>x.id.replace(/^view-/,''))
  }));
  assert.ok(state.email&&state.password&&state.loginBtn,'admin login controls missing');
  assert.ok(state.loginVisible || !state.appVisible,'admin is not exposing the management app while unauthenticated');
  assert.ok(state.sidebarViews.length>=10,'admin navigation views are unexpectedly incomplete');
  const missing=state.sidebarViews.filter(v=>!state.viewSections.includes(v));
  assert.deepEqual(missing,[],'admin nav points to missing view sections: '+missing.join(','));
  const geom=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth,scale:visualViewport?.scale||1}));
  assert.ok(geom.s<=geom.w+1,'admin login page has mobile overflow');
  assert.equal(geom.scale,1,'admin page scale is not 1');
  await context.close();
  return {adminLoginGate:true,adminViewsWired:true,adminResponsive:true,authenticatedPanelNotOpened:true};
}

async function testCallbackAndLegal(browser){
  const out=[];
  for(const path of ['/payment-callback.html?status=failed','/privacy.html','/terms.html','/404.html']){
    const context=await browser.newContext({viewport:MOBILE,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    const errors=[]; page.on('console',m=>{if(m.type()==='error'&&!IGNORE_CONSOLE.test(m.text()))errors.push(m.text())}); page.on('pageerror',e=>errors.push(String(e)));
    const r=await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(400);
    assert.ok(r && r.status()<400,path+': unexpected HTTP '+r?.status());
    assert.equal(errors.length,0,path+': JS errors '+errors.join(' | '));
    const geom=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth,scale:visualViewport?.scale||1,title:document.title}));
    assert.ok(geom.s<=geom.w+1,path+': mobile overflow');
    assert.equal(geom.scale,1,path+': visual scale');
    assert.ok(geom.title,path+': title missing');
    await context.close(); out.push(path);
  }
  return {legalAndCallback:out};
}

async function testLegacyRedirects(browser){
  const context=await browser.newContext({viewport:DESKTOP});
  const results=[];
  for(const path of LEGACY_REDIRECTS){
    const page=await context.newPage();
    await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(400);
    assert.match(page.url(),/\/products-v4\.html(?:$|\?)/,path+': did not redirect to products-v4');
    results.push({path,final:cleanPath(page.url())});
    await page.close();
  }
  await context.close();
  return results;
}

async function testStaticAdminStructure(){
  const admin=fs.readFileSync('admin.html','utf8');
  const views=[...admin.matchAll(/data-view="([^"]+)"/g)].map(m=>m[1]);
  const sections=[...admin.matchAll(/id="view-([^"]+)"/g)].map(m=>m[1]);
  const unique=[...new Set(views)];
  const missing=unique.filter(v=>!sections.includes(v));
  assert.equal(missing.length,0,'static admin view wiring missing: '+missing.join(','));
  assert.ok(admin.includes('Supabase Auth'),'admin auth integration marker missing');
  assert.ok(admin.includes('mfaScreen'),'admin MFA screen marker missing');
  return {staticAdminViews:unique.length,mfaWired:true,supabaseAuthWired:true};
}

async function main(){
  const browser=await chromium.launch({headless:true});
  const results=[];
  results.push(await testStaticAdminStructure());
  for(const p of PUBLIC_PAGES) results.push(await auditPage(browser,p));
  results.push(await testHomepage(browser));
  results.push(await testCatalog(browser));
  results.push(await testWishlist(browser));
  results.push(await testCart(browser));
  results.push(await testManualCheckoutRequest(browser));
  results.push(await testContact(browser));
  results.push(await testOrderStatus(browser));
  results.push(await testAI(browser));
  results.push(await testAdmin(browser));
  results.push(await testCallbackAndLegal(browser));
  results.push(await testLegacyRedirects(browser));
  await browser.close();
  console.log(JSON.stringify({ok:true,results},null,2));
}

main().catch(err=>{ console.error(err.stack||err); process.exit(1); });
