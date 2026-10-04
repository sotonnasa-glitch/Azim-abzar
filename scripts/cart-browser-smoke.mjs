import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const HOSTS = ['https://azimabzar.com', 'https://www.azimabzar.com'];
const P1 = 'P0001';
const P2 = 'P0002';
const P1_PRICE = 63600000;
const CART_KEY = 'azim_abzar_cart_v2';

async function waitForProduct(page, code) {
  await page.waitForFunction(
    (productCode) => !!document.querySelector('select[data-id="' + productCode + '"]')
      || !!document.querySelector('[data-cart-add-link="' + productCode + '"]'),
    code,
    { timeout: 60000 }
  );
}

async function addProduct(page, host, code, variantLabel = '') {
  await page.goto(host + '/products-v4.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForProduct(page, code);

  const card = page.locator('#card-' + code).first();
  await card.waitFor({ state: 'visible', timeout: 60000 });

  if (variantLabel) {
    const select = card.locator('select[data-id="' + code + '"]').first();
    await select.waitFor({ state: 'visible', timeout: 30000 });
    const options = await select.locator('option').evaluateAll(nodes =>
      nodes.map((n, i) => ({ i, text: (n.textContent || '').trim() }))
    );
    const option = options.find(x => x.text === variantLabel || x.text.startsWith(variantLabel + ' '));
    assert.ok(option, code + ': variant ' + variantLabel + ' not found');
    await select.selectOption({ index: option.i });
  }

  const link = card.locator('[data-cart-add-link="' + code + '"]').first();
  await link.waitFor({ state: 'visible', timeout: 30000 });
  await link.click();
  await page.waitForTimeout(250);
  assert.ok((await page.url()).includes('/products-v4.html'), host + ': adding a product unexpectedly navigated away from catalog');
  await page.waitForFunction(
    (productCode) => document.querySelector('[data-cart-count]')?.textContent !== '۰',
    code,
    { timeout: 10000 }
  );
}

async function readCart(page) {
  return page.evaluate((cartKey) => ({
    localStorage: localStorage.getItem(cartKey),
    items: window.AZIM_CART?.items?.().map(x => ({
      product_id: String(x.product_id || ''),
      code: String(x.code || ''),
      name: String(x.name || ''),
      img: String(x.img || ''),
      variant_label: String(x.variant_label || ''),
      qty: Number(x.qty || 0),
      unit_price: Number(x.unit_price || 0)
    })) || null,
    moduleLoaded: !!window.AZIM_CART
  }), CART_KEY);
}

async function assertCart(page, expectedCount, p1Variant = '46') {
  const cart = await readCart(page);
  assert.equal(cart.moduleLoaded, true, 'AZIM_CART module is not loaded on cart page');
  assert.equal(cart.items.length, expectedCount, 'unexpected cart item count');
  const p1 = cart.items.find(x => x.code === P1 && x.variant_label === p1Variant);
  assert.ok(p1, 'P0001 size 46 is missing from cart');
  assert.equal(p1.unit_price, P1_PRICE, 'P0001 size 46 price changed unexpectedly');
  assert.notEqual(p1.name, 'محصول', 'cart product name fell back to generic label');
  assert.ok(p1.name.length >= 2, 'cart product name is empty');
  assert.ok(p1.img, 'cart product image URL is missing');
  assert.ok(cart.localStorage, 'cart localStorage key is missing');
}

async function runHost(host) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(String(err)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  const relevantConsoleErrors = () => consoleErrors.filter(message =>
    !/static\.cloudflareinsights\.com\/beacon\.min\.js/i.test(message)
  );

  await addProduct(page, host, P1, '46');
  await assertCart(page, 1);

  await addProduct(page, host, P2);
  await assertCart(page, 2);

  await page.goto(host + '/cart.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.AZIM_CART && document.querySelector('#cartItems'), null, { timeout: 30000 });
  const checkoutBefore = await readCart(page);
  assert.equal(checkoutBefore.items.length, 2, host + ': cart changed before checkout-method test');
  assert.notEqual(checkoutBefore.items.find(x=>x.code===P2)?.name, 'محصول', host + ': P0002 name is generic');
  assert.ok(checkoutBefore.items.find(x=>x.code===P2)?.img, host + ': P0002 image URL is missing');
  await page.waitForFunction(() => {
    const imgs=[...document.querySelectorAll('#cartItems .cart-img img')];
    return imgs.length >= 2 && imgs.every(img => img.complete && img.naturalWidth > 0);
  }, null, {timeout:30000});

  const startCheckout = page.locator('#startCheckoutBtn').first();
  await startCheckout.click();
  await page.locator('#checkoutBox').waitFor({ state: 'visible', timeout: 15000 });

  const paymentState = await page.evaluate(() => {
    const phone = document.querySelector('input[name="paymentMethod"][value="phone"]');
    const message = document.querySelector('input[name="paymentMethod"][value="message"]');
    const online = document.querySelector('input[name="paymentMethod"][value="online"]');
    const option = document.querySelector('#onlinePaymentOption');
    return {
      phonePresent: !!phone,
      messagePresent: !!message,
      onlinePresent: !!online,
      onlineVisible: !!option && !option.hidden,
      onlineDisabled: !!online && online.disabled
    };
  });
  assert.equal(paymentState.phonePresent, false, host + ': phone payment option still exists');
  assert.equal(paymentState.messagePresent, false, host + ': message payment option still exists');
  assert.equal(paymentState.onlinePresent, true, host + ': online payment option is missing');
  assert.equal(paymentState.onlineVisible, true, host + ': online payment option is not visible');
  const otherHost = host.includes('://www.') ? 'https://azimabzar.com' : 'https://www.azimabzar.com';
  await page.goto(otherHost + '/cart.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.AZIM_CART && document.querySelector('#cartItems'), null, { timeout: 30000 });
  const crossHost = await readCart(page);
  assert.equal(crossHost.items.length, 2, 'cross-host cart lost items');
  assert.ok(crossHost.items.some(x => x.code === P1 && x.variant_label === '46'), 'cross-host cart lost P0001 size 46');
  assert.notEqual(crossHost.items.find(x=>x.code===P1)?.name, 'محصول', 'cross-host cart lost P0001 name');
  assert.ok(crossHost.items.every(x=>x.img), 'cross-host cart lost a product image URL');

  // Verify delegated remove works and, critically, that removing the final
  // item clears the cross-host cookie shadow instead of resurrecting the item.
  const removeButtons=page.locator('#cartItems [data-remove]');
  await removeButtons.first().click();
  await page.waitForFunction(() => window.AZIM_CART?.items?.().length === 1, null, {timeout:10000});
  await page.locator('#cartItems [data-remove]').first().click();
  await page.waitForFunction(() => window.AZIM_CART?.items?.().length === 0, null, {timeout:10000});

  await browser.close();
  assert.equal(relevantConsoleErrors().length, 0, host + ': browser console/page errors: ' + relevantConsoleErrors().join(' | '));
  return { host, items: 2, crossHost: true };
}

async function runMissingModule(host) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(host + '/products-v4.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForProduct(page, P1);
  await page.evaluate(() => { window.AZIM_CART = undefined; });
  const card = page.locator('#card-' + P1).first();
  const link = card.locator('[data-cart-add-link="' + P1 + '"]').first();
  await link.click();
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => ({
    url: location.href,
    visibleText: document.body.innerText.includes('سبد سفارش بارگذاری نشد')
  }));
  assert.equal(result.visibleText, true, 'missing-cart-module did not show a visible error');
  assert.ok(result.url.includes('/products-v4.html'), 'missing-cart-module unexpectedly navigated away');
  await browser.close();
  return { host, missingModuleGuard: true };
}

async function runMobileResponsive(host) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(host + '/products-v4.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForProduct(page, P1);
  await page.waitForTimeout(500);

  const base = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scale: window.visualViewport?.scale || 1
  }));
  assert.ok(base.scrollWidth <= base.clientWidth + 1, host + ': catalog has horizontal overflow at mobile width (' + base.scrollWidth + ' > ' + base.clientWidth + ')');
  assert.equal(base.scale, 1, host + ': unexpected browser visual scale ' + base.scale);

  const card = page.locator('#card-' + P1).first();
  await card.locator('.photo-wrap').click();
  await page.waitForSelector('#quickModal.show', { timeout: 10000 });
  const quick = await page.locator('#quickModal .modal-box').boundingBox();
  assert.ok(quick, host + ': product detail modal did not render');
  assert.ok(quick.x >= -1 && quick.x + quick.width <= base.clientWidth + 1, host + ': product modal is wider than mobile viewport');
  assert.ok(quick.width <= base.clientWidth, host + ': product modal width exceeds viewport');

  await page.locator('#closeModalBtn').click();
  const aiBtn = card.locator('.az-product-ai-btn').first();
  await aiBtn.click();
  await page.waitForSelector('#azProductAiModal.show', { timeout: 10000 });
  const ai = await page.locator('#azProductAiModal .az-ai-modal').boundingBox();
  assert.ok(ai, host + ': product assistant modal did not render');
  assert.ok(ai.x >= -1 && ai.x + ai.width <= base.clientWidth + 1, host + ': assistant modal is wider than mobile viewport');
  assert.ok(ai.width <= base.clientWidth, host + ': assistant modal width exceeds viewport');

  await browser.close();
  return { host, mobileViewport: '390x844', noHorizontalOverflow: true, quickModalResponsive: true, assistantModalResponsive: true };
}

async function runContactResponsive(host) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(host + '/contact.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);

  const base = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')].map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { tag:el.tagName, id:el.id, cls:el.className?.toString?.().slice(0,100)||'', left:Math.round(r.left), right:Math.round(r.right), width:Math.round(r.width), pos:cs.position, overflowX:cs.overflowX };
    }).filter(x => x.left < -1 || x.right > vw + 1).sort((a,b) => (b.right-vw) - (a.right-vw)).slice(0,12);
    return {
      innerWidth: window.innerWidth,
      clientWidth: vw,
      scrollWidth: document.documentElement.scrollWidth,
      scale: window.visualViewport?.scale || 1,
      offenders
    };
  });
  assert.ok(base.scrollWidth <= base.clientWidth + 1, host + ': contact page has horizontal overflow (' + base.scrollWidth + ' > ' + base.clientWidth + '): ' + JSON.stringify(base.offenders));
  assert.equal(base.scale, 1, host + ': contact page visual scale is ' + base.scale);

  const header = await page.locator('.header .head-inner').boundingBox();
  const brand = await page.locator('#header-brand').boundingBox();
  const back = await page.locator('#btn-back-prev').boundingBox();
  const cart = await page.locator('.header .az-cart-link').boundingBox();
  for (const [name, box] of [['header',header],['brand',brand],['back',back],['cart',cart]]) {
    assert.ok(box, host + ': missing mobile header element ' + name);
    assert.ok(box.x >= -1 && box.x + box.width <= base.clientWidth + 1, host + ': header element ' + name + ' is outside viewport');
  }

  // Focus a form control: font-size >=16px prevents mobile browser focus zoom.
  const controlFont = await page.locator('#contactForm input, #contactForm select, #contactForm textarea').first().evaluate(el => getComputedStyle(el).fontSize);
  assert.ok(parseFloat(controlFont) >= 16, host + ': contact form control is below 16px and may trigger mobile focus zoom');

  await browser.close();
  return { host, contactMobile: '390x844', noHorizontalOverflow: true, headerResponsive: true, noFocusZoomSizing: true };
}

const results = [];
for (const host of HOSTS) results.push(await runHost(host));
results.push(await runMissingModule(HOSTS[0]));
results.push(await runMobileResponsive(HOSTS[0]));
results.push(await runContactResponsive(HOSTS[0]));

console.log(JSON.stringify({ ok: true, results }, null, 2));
