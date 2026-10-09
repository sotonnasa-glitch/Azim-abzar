import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = (process.env.AZIM_ADMIN_BASE_URL || 'https://azimabzar.com').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const failed = [];
page.on('pageerror', e => errors.push(e.message));
page.on('requestfailed', r => { if (r.url().startsWith(base)) failed.push(r.url() + ': ' + r.failure()?.errorText); });
try {
  const response = await page.goto(base + '/admin.html?admin_smoke=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  assert.ok(response?.ok(), 'admin page did not return HTTP success');
  await page.waitForSelector('#loginBtn', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('#loginScreen')?.classList.contains('hidden') && document.querySelector('#app')?.classList.contains('hidden'), null, { timeout: 15000 });
  assert.equal(await page.locator('#loginEmail').getAttribute('type'), 'email');
  assert.equal(await page.locator('#loginPassword').getAttribute('type'), 'password');
  await page.locator('#loginBtn').click();
  let msg = (await page.locator('#loginStatus').innerText()).trim();
  assert.ok(msg.includes('ایمیل و رمز عبور را وارد کن'), 'empty login was not blocked');
  await page.locator('#loginEmail').fill('smoke-test@example.invalid');
  await page.locator('#loginBtn').click();
  msg = (await page.locator('#loginStatus').innerText()).trim();
  assert.ok(msg.includes('ایمیل و رمز عبور را وارد کن'), 'email-only login was not blocked');
  assert.equal(await page.locator('#app').isVisible(), false, 'admin workspace exposed without session');
  assert.ok(await page.locator('.nav button').count() >= 18, 'admin navigation inventory is incomplete');
  await page.waitForTimeout(500);
  assert.deepEqual(errors, [], 'uncaught browser JavaScript errors: ' + errors.join('; '));
  assert.deepEqual(failed, [], 'same-origin requests failed: ' + failed.join('; '));

  // Exercise all admin navigation handlers in an isolated browser using a mocked Supabase client.
  // This avoids changing real orders, products, users, or payment settings.
  const mockPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const mockErrors = [];
  mockPage.on('pageerror', e => mockErrors.push(e.message));
  await mockPage.addInitScript(() => {
    const adminUser = { id: '00000000-0000-4000-8000-000000000001', email: 'admin-smoke@example.invalid' };
    const mockedRole = new URL(location.href).searchParams.get('admin_role_mock') || 'owner';
    const tables = {
      admin_users: [{ user_id: adminUser.id, role: mockedRole, is_active: true, created_at: '2026-01-01T00:00:00Z' }]
    };
    class Query {
      constructor(table) { this.table = table; this.rows = (tables[table] || []).slice(); this.filters = []; }
      select() { return this; } insert() { return this; } update() { return this; } delete() { return this; } upsert() { return this; }
      eq(k,v) { this.filters.push(x => x[k] === v); return this; }
      neq(k,v) { this.filters.push(x => x[k] !== v); return this; }
      in(k,v) { this.filters.push(x => v.includes(x[k])); return this; }
      not() { return this; } is() { return this; } gte() { return this; } lte() { return this; }
      gt() { return this; } lt() { return this; } like() { return this; } ilike() { return this; }
      or() { return this; } order() { return this; } limit() { return this; } range() { return this; }
      contains() { return this; } match() { return this; }
      result() { const rows = this.rows.filter(x => this.filters.every(f => f(x))); return { data: rows, error: null, count: rows.length }; }
      maybeSingle() { const r = this.result(); return Promise.resolve({ data: r.data[0] || null, error: null }); }
      single() { const r = this.result(); return Promise.resolve({ data: r.data[0] || null, error: null }); }
      then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
    }
    const client = {
      auth: {
        getUser: async () => ({ data: { user: adminUser }, error: null }),
        getSession: async () => ({ data: { session: { user: adminUser, access_token: 'mock-token' } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null }),
        mfa: {
          getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null }),
          listFactors: async () => ({ data: { all: [], totp: [] }, error: null })
        }
      },
      from: table => new Query(table),
      rpc: async name => ({
        data: name === 'azim_admin_payment_dashboard'
          ? { online_enabled: false, gateway_ready: false, provider: null, recent_transactions: [], recent_refunds: [], summary: {} }
          : { ok: true, rows: [], data: [] },
        error: null
      }),
      functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
      storage: { from: () => ({
        upload: async () => ({ data: { path: 'smoke-test' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.invalid/smoke-test' } }),
        remove: async () => ({ data: [], error: null })
      }) }
    };
    const mockedLibrary = { createClient: () => client };
    Object.defineProperty(window, 'supabase', { configurable: true, get: () => mockedLibrary, set: () => {} });
  });
  await mockPage.route('**/functions/v1/azim-notification-config', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      settings: { sms_enabled: false, email_enabled: false, events: {}, templates: { sms: {}, email: {} }, email_subjects: {} },
      configured: { sms: false, email: false }
    })
  }));
  try {
    await mockPage.goto(base + '/admin.html?admin_ui_mock=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mockPage.waitForFunction(() => !document.querySelector('#app')?.classList.contains('hidden'), null, { timeout: 20000 });
    const views = await mockPage.locator('.az-menu-item[data-menu-view]').evaluateAll(nodes => nodes.map(n => n.dataset.menuView).filter(Boolean));
    assert.ok(views.length >= 18, 'mocked authenticated menu inventory is incomplete');
    const openView = async view => {
      if (view === 'notifications') await mockPage.waitForSelector('#notificationNavBtn', { state: 'attached', timeout: 8000 });
      await mockPage.locator('#azMenuTrigger').click();
      await mockPage.waitForFunction(() => document.querySelector('#azMenuOverlay')?.classList.contains('show'), null, { timeout: 5000 });
      await mockPage.locator('.az-menu-item[data-menu-view="' + view + '"]').click({ timeout: 5000 });
      await mockPage.waitForFunction(name => document.querySelector('#view-' + name)?.classList.contains('active'), view, { timeout: 5000 });
    };
    for (const view of views) await openView(view);
    const modalChecks = [
      ['products', 'newProductBtn'],
      ['categories', 'newCategoryBtn'],
      ['brands', 'newBrandBtn'],
      ['orders', 'newOrderBtn'],
      ['customers', 'newCustomerBtn'],
      ['discounts', 'newDiscountBtn'],
      ['discount-codes', 'newDiscountCodeBtn'],
      ['content', 'newContentBtn']
    ];
    for (const [view, buttonId] of modalChecks) {
      await openView(view);
      await mockPage.locator('#' + buttonId).click({ timeout: 5000 });
      await mockPage.waitForFunction(() => document.querySelector('#modal')?.classList.contains('show'), null, { timeout: 5000 });
      await mockPage.locator('#modal button[onclick="closeModal()"]').first().click({ timeout: 5000 });
      await mockPage.waitForFunction(() => !document.querySelector('#modal')?.classList.contains('show'), null, { timeout: 5000 });
    }
    await mockPage.locator('#azMenuTrigger').click();
    assert.ok(await mockPage.locator('#azMenuOverlay').evaluate(el => el.classList.contains('show')), 'admin menu did not open');
    await mockPage.locator('#azMenuClose').click();
    assert.ok(!(await mockPage.locator('#azMenuOverlay').evaluate(el => el.classList.contains('show'))), 'admin menu did not close');
    await mockPage.keyboard.press('Control+k');
    assert.ok(await mockPage.locator('#commandPalette').evaluate(el => el.classList.contains('show')), 'command palette did not open');
    await mockPage.locator('#commandClose').click();
    assert.ok(!(await mockPage.locator('#commandPalette').evaluate(el => el.classList.contains('show'))), 'command palette did not close');
    // Verify the same authorization matrix is reflected in all three navigation surfaces.
    const allowedByRole = {
      owner: new Set([...views, 'notifications']),
      admin: new Set([...views, 'notifications']),
      editor: new Set(['dashboard','products','reviews','categories','brands','media','content','ai-products','ai']),
      sales: new Set(['dashboard','reports','products','inquiries','orders','customers','discounts','discount-codes'])
    };
    for (const role of ['owner','admin','editor','sales']) {
      await mockPage.goto(base + '/admin.html?admin_ui_mock=1&admin_role_mock=' + role, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await mockPage.waitForFunction(() => !document.querySelector('#app')?.classList.contains('hidden'), null, { timeout: 20000 });
      const allowed = allowedByRole[role];
      await mockPage.locator('#azMenuTrigger').click();
      await mockPage.waitForFunction(() => document.querySelector('#azMenuOverlay')?.classList.contains('show'), null, { timeout: 5000 });
      const notificationMenuItem = mockPage.locator('.az-menu-item[data-menu-view="notifications"]');
      assert.equal(
        await notificationMenuItem.evaluate(n => n.style.display !== 'none'),
        allowed.has('notifications'),
        role + ' notification menu permission mismatch'
      );
      await mockPage.locator('#azMenuClose').click();
      const navState = await mockPage.locator('.nav button[data-view]').evaluateAll(nodes =>
        nodes.filter(n => n.dataset.view !== 'notifications').map(n => ({ view: n.dataset.view, shown: n.style.display !== 'none' })));
      for (const item of navState) assert.equal(item.shown, allowed.has(item.view), role + ' side-nav visibility mismatch for ' + item.view);
      const menuState = await mockPage.locator('.az-menu-item[data-menu-view]').evaluateAll(nodes =>
        nodes.map(n => ({ view: n.dataset.menuView, shown: n.style.display !== 'none' })));
      for (const item of menuState) assert.equal(item.shown, allowed.has(item.view), role + ' menu visibility mismatch for ' + item.view);
      const shortcutState = await mockPage.locator('[data-go]').evaluateAll(nodes =>
        nodes.map(n => ({ view: n.dataset.go, shown: n.style.display !== 'none' })));
      for (const item of shortcutState) assert.equal(item.shown, allowed.has(item.view), role + ' dashboard shortcut visibility mismatch for ' + item.view);
      await mockPage.keyboard.press('Control+k');
      for (const view of ['reports','reviews','notifications']) {
        const count = await mockPage.locator('[data-command-view="' + view + '"]').count();
        assert.equal(count > 0, allowed.has(view), role + ' command palette visibility mismatch for ' + view);
      }
      await mockPage.locator('#commandClose').click();
    }
    assert.deepEqual(mockErrors, [], 'mocked admin UI raised browser errors: ' + mockErrors.join('; '));
    console.log(JSON.stringify({ ok: true, checks: [
      'all admin menu destinations opened with an isolated mock admin session',
      'new product/category/brand/order/customer/discount/code/content dialogs open and close',
      'admin menu and command palette open and close',
      'notification settings reachable through the visible admin menu; notification config API mocked to avoid real writes',
      'owner/admin/editor/sales navigation, dashboard shortcuts and quick search match role permissions',
      'no uncaught browser JavaScript errors in mocked admin UI'
    ] }, null, 2));
  } finally {
    await mockPage.close();
  }
  console.log(JSON.stringify({ ok: true, checks: ['page loads', 'login validation', 'unauthenticated access gate', 'navigation inventory', 'no uncaught JS errors'], navButtons: await page.locator('.nav button').count() }, null, 2));
} finally { await browser.close(); }
