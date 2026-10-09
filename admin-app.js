(() => {
  'use strict';

  if (window.__AZIM_ADMIN_V40) return;
  window.__AZIM_ADMIN_V42 = true;
  window.__AZIM_ADMIN_V40 = true;
  window.__AZIM_ADMIN_V39 = true;
  window.__AZIM_ADMIN_V38 = true;
  window.__AZIM_ADMIN_V37 = true;
  window.__AZIM_ADMIN_V36 = true;
  window.__AZIM_ADMIN_V35 = true;
  window.__AZIM_ADMIN_V34 = true;

  const $ = (id) => document.getElementById(id);
  const state = {
    db: null,
    user: null,
    me: null,
    products: [],
    categories: [],
    brands: [],
    customers: [],
    orderItems: [],
    orderProducts: [],
    productCacheLoaded: false,
    contentRows: [],
    viewHistory: []
  };

  const viewInfo = {
    dashboard: ['داشبورد', 'نمای کلی فروشگاه، سفارش‌ها، مشتریان و سلامت سیستم'],
    reports: ['گزارش فروش', 'درآمد ثبت‌شده، روند فروش و محصولات پرفروش'],
    products: ['محصولات', 'افزودن، ویرایش، قیمت، تصویر، دسته، موجودی و وضعیت نمایش'],
    reviews: ['نظرات محصولات', 'بررسی، تأیید و مدیریت نظرات ثبت‌شده کاربران'],
    categories: ['دسته‌بندی‌ها', 'ساختار دسته‌بندی و تعداد محصولات هر دسته'],
    brands: ['برندها', 'مدیریت برند و اتصال آن به محصولات'],
    inquiries: ['درخواست‌ها', 'استعلام قیمت و ارتباط با مشتری'],
    orders: ['سفارش‌ها', 'مدیریت سفارش، پرداخت، ارسال و اقلام سفارش'],
    discounts: ['تخفیف و پروموشن', 'کمپین‌ها و تخفیف‌های خودکار'],
    'discount-codes': ['کدهای تخفیف', 'ساخت و مدیریت کدهای قابل استفاده مشتری'],
    customers: ['مشتریان', 'اطلاعات تماس و سوابق مشتریان'],
    media: ['رسانه', 'آپلود، مشاهده و حذف تصاویر سایت'],
    content: ['محتوای سایت', 'مدیریت متن‌های واقعی صفحه اصلی و ارتباط با ما'],
    admins: ['کاربران مدیر', 'نقش‌ها و سطح دسترسی'],
    audit: ['گزارش فعالیت', 'ردپای تغییرات پنل'],
    security: ['امنیت حساب', 'MFA، نشست و وضعیت دسترسی مدیریتی'],
    ai: ['هوش مصنوعی', 'چت عمومی و تنظیمات سرویس AI فروشگاه'],
    'ai-products': ['ربات محصولات', 'مشاوره خودکار بر اساس اطلاعات واقعی کاتالوگ'],
    payment: ['مدیریت درگاه پرداخت', 'کنترل امن پرداخت آنلاین، تراکنش‌ها و بازگشت وجه']
  };

  const labels = {
    new: 'جدید', in_progress: 'در حال بررسی', quoted: 'پیش‌فاکتور',
    answered: 'پاسخ داده شد', closed: 'بسته', spam: 'اسپم',
    pending: 'در انتظار', confirmed: 'تایید شده', processing: 'در حال پردازش',
    shipped: 'ارسال شده', delivered: 'تحویل شده', cancelled: 'لغو شده',
    unpaid: 'پرداخت نشده', paid: 'پرداخت شده', partially_refunded: 'بخشی مرجوع شده', refunded: 'مرجوع شده',
    packed: 'بسته‌بندی شده',
    owner: 'مالک', admin: 'مدیر', editor: 'ویرایشگر', sales: 'فروش'
  };

  const can = {
    all: () => ['owner', 'admin'].includes(state.me?.role),
    edit: () => ['owner', 'admin', 'editor'].includes(state.me?.role),
    sales: () => ['owner', 'admin', 'sales'].includes(state.me?.role)
  };

  const viewRoles = {
    dashboard: ['owner','admin','editor','sales'],
    reports: ['owner','admin','sales'],
    products: ['owner','admin','editor','sales'],
    categories: ['owner','admin','editor'],
    brands: ['owner','admin','editor'],
    inquiries: ['owner','admin','sales'],
    orders: ['owner','admin','sales'],
    discounts: ['owner','admin','sales'],
    'discount-codes': ['owner','admin','sales'],
    customers: ['owner','admin','sales'],
    media: ['owner','admin','editor'],
    content: ['owner','admin','editor'],
    admins: ['owner','admin'],
    audit: ['owner','admin'],
    security: ['owner','admin'],
    ai: ['owner','admin','editor'],
    'ai-products': ['owner','admin','editor'],
    reviews: ['owner','admin','editor'],
    payment: ['owner','admin']
  };
  const canView = (name) => !viewRoles[name] || viewRoles[name].includes(state.me?.role);

  const animatedIconMap = {
    '__AZICON_WAVE__':'wave','__AZICON_LOCK__':'lock','__AZICON_MAIL__':'mail','__AZICON_USER__':'user','__AZICON_ADMIN__':'admin','__AZICON_MENU__':'menu','__AZICON_EDIT__':'edit','__AZICON_GLOBE__':'globe',
    '__AZICON_HOME__':'home','__AZICON_PHONE__':'phone','__AZICON_SPARK__':'spark','__AZICON_LOCK__':'lock','__AZICON_BLOCK__':'block','__AZICON_ERROR__':'error','__AZICON_SUCCESS__':'success','__AZICON_TARGET__':'target',
    '__AZICON_GEAR__':'gear','__AZICON_COMPASS__':'compass','__AZICON_TOOLS__':'tools','__AZICON_DOWN__':'down','__AZICON_INVOICE__':'invoice','__AZICON_PHONE__':'phone','__AZICON_CLOCK__':'clock',
    '__AZICON_NOTE__':'note','__AZICON_QUESTION__':'question','__AZICON_PIN__':'pin','__AZICON_SAVE__':'save','__AZICON_WARNING__':'warning','__AZICON_SUCCESS__':'success'
  };

  function installAnimatedIconLayer() {
    const root = document.body;
    if (!root || root.dataset.azAnimatedIcons === '1') return;
    root.dataset.azAnimatedIcons = '1';
    const emojiRe = /__AZICON_WAVE__|__AZICON_LOCK__|__AZICON_MAIL__|__AZICON_USER__|__AZICON_ADMIN__|__AZICON_MENU__|__AZICON_EDIT__|__AZICON_GLOBE__|__AZICON_HOME__|__AZICON_PHONE__|__AZICON_SPARK__|__AZICON_BLOCK__|__AZICON_ERROR__|__AZICON_SUCCESS__|__AZICON_TARGET__|__AZICON_GEAR__|__AZICON_COMPASS__|__AZICON_TOOLS__|__AZICON_DOWN__|__AZICON_INVOICE__|__AZICON_CLOCK__|__AZICON_NOTE__|__AZICON_QUESTION__|__AZICON_PIN__|__AZICON_SAVE__|__AZICON_WARNING__/u;

    const replaceNode = (node) => {
      if (!node?.nodeValue || !emojiRe.test(node.nodeValue)) return;
      const frag = document.createDocumentFragment();
      let text = node.nodeValue;
      while (text) {
        const m = text.match(emojiRe);
        if (!m || m.index == null) { frag.appendChild(document.createTextNode(text)); break; }
        if (m.index) frag.appendChild(document.createTextNode(text.slice(0,m.index)));
        const icon = document.createElement('span');
        const type = animatedIconMap[m[0]] || 'spark';
        icon.className = 'az-animated-icon az-animated-icon-' + type;
        icon.setAttribute('aria-hidden','true');
        icon.dataset.icon = type;
        frag.appendChild(icon);
        text = text.slice(m.index + m[0].length);
      }
      node.parentNode?.replaceChild(frag,node);
    };

    const scan = (rootNode) => {
      const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const el = node.parentElement;
          if (!el || ['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(el.tagName)) return NodeFilter.FILTER_REJECT;
          return emojiRe.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(replaceNode);
    };

    scan(root);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        if (m.type === 'characterData') replaceNode(m.target);
        else m.addedNodes?.forEach(n => {
          if (n.nodeType === Node.TEXT_NODE) replaceNode(n);
          else if (n.nodeType === Node.ELEMENT_NODE) scan(n);
        });
      });
    });
    observer.observe(root,{subtree:true,childList:true,characterData:true});
    window.__azAnimatedIconObserver = observer;
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  function money(v) {
    return v == null || v === '' ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v)) + ' تومان';
  }

  function dateFa(v, withTime = true) {
    if (!v) return '—';
    try {
      return new Date(v).toLocaleString('fa-IR', withTime ? undefined : { dateStyle: 'short' });
    } catch (_) { return '—'; }
  }

  function localDateTimeValue(v) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2,'0');
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function isDirectProductDiscountLive(p) {
    if (!p?.discount_is_active || !p.discount_type || p.discount_value == null) return false;
    const now = Date.now();
    const start = p.discount_starts_at ? new Date(p.discount_starts_at).getTime() : -Infinity;
    const end = p.discount_ends_at ? new Date(p.discount_ends_at).getTime() : Infinity;
    return now >= start && now <= end;
  }

  function directProductDiscountPrice(base, p) {
    const n = Number(base || 0);
    if (!(n > 0) || !isDirectProductDiscountLive(p)) return Math.max(0,n);
    const value = Number(p.discount_value || 0);
    const out = p.discount_type === 'percentage' ? Math.floor(n * (100 - value) / 100) : n - value;
    return Math.max(0, out);
  }

  let __azLastUnhandledAt = 0;
  window.addEventListener('unhandledrejection', (event) => {
    const now = Date.now();
    if (now - __azLastUnhandledAt < 1200) return;
    __azLastUnhandledAt = now;
    console.error('Azim Abzar admin unhandled rejection:', event?.reason);
    toast('__AZICON_ERROR__ عملیات با خطای غیرمنتظره متوقف شد. دوباره تلاش کنید.');
  });

  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(window.__azToastTimer);
    window.__azToastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function openModal(title, body) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = body;
    const modal = $('modal');
    modal.classList.toggle('drawer-mode', /محصول|سفارش|محتوا|AI/.test(title));
    modal.classList.toggle('product-editor-modal', /محصول/.test(title));
    modal.classList.toggle('az-order-workspace', /سفارش/.test(title));
    modal.classList.add('show');
  }

  function closeModal() {
    $('modal').classList.remove('show');
    $('modal').classList.remove('drawer-mode');
    $('modal').classList.remove('product-editor-modal');
    $('modal').classList.remove('az-order-workspace');
  }

  window.closeModal = closeModal;


  function passwordForm(required = false) {
    return '<form id="passwordForm" class="grid2">' +
      '<div class="az-password-intro">' +
        '<strong>__AZICON_LOCK__ تغییر رمز عبور</strong>' +
        '<small>رمز جدید فقط در Supabase Auth ثبت می‌شود و داخل پنل ذخیره نمی‌شود.</small>' +
      '</div>' +
      '<div class="field full"><label>رمز فعلی *</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required></div>' +
      '<div class="field"><label>رمز جدید *</label><input class="input" name="newPassword" type="password" minlength="8" autocomplete="new-password" required></div>' +
      '<div class="field"><label>تکرار رمز جدید *</label><input class="input" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></div>' +
      '<div class="field full"><button class="btn" type="submit">ذخیره رمز جدید و ورود مجدد</button></div>' +
      '<div id="passwordStatus" class="status field full"></div>' +
    '</form>';
  }

  function openPasswordChange(required = false) {
    openModal(required ? 'تغییر رمز قبل از ادامه' : 'تغییر رمز عبور', passwordForm(required));
    const close = document.querySelector('#modal .modal-head .x');
    if (close) close.style.display = '';
    $('passwordForm').onsubmit = (e) => changeOwnPassword(e, required);
  }

  async function changeOwnPassword(e, required) {
    e.preventDefault();
    const s = e.target.elements;
    const current = s.currentPassword.value;
    const next = s.newPassword.value;
    const confirm = s.confirmPassword.value;
    const status = $('passwordStatus');
    if (next.length < 8) {
      status.textContent = '__AZICON_ERROR__ رمز جدید باید حداقل ۸ کاراکتر باشد.';
      return;
    }
    if (next !== confirm) {
      status.textContent = '__AZICON_ERROR__ تکرار رمز جدید یکسان نیست.';
      return;
    }
    if (next === current) {
      status.textContent = '__AZICON_ERROR__ رمز جدید باید با رمز فعلی متفاوت باشد.';
      return;
    }
    status.textContent = 'در حال بررسی رمز فعلی…';
    try {
      const authCheck = await state.db.auth.signInWithPassword({ email: state.user.email, password: current });
      if (authCheck.error || !authCheck.data?.user || authCheck.data.user.id !== state.user.id) {
        status.textContent = '__AZICON_ERROR__ رمز فعلی صحیح نیست.';
        return;
      }
      status.textContent = 'در حال ثبت رمز جدید…';
      const updated = await state.db.auth.updateUser({ password: next });
      if (updated.error) throw updated.error;
            await audit('password_change', 'admin_users', state.user.id, {});
      status.textContent = '__AZICON_SUCCESS__ رمز تغییر کرد؛ در حال خروج امن…';
      await state.db.auth.signOut();
      setTimeout(() => location.reload(), 350);
    } catch (err) {
      status.textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  async function audit(action, entity, id, metadata = {}) {
    try {
      await state.db.from('audit_logs').insert({
        actor_id: state.user.id,
        action,
        entity,
        entity_id: String(id || ''),
        metadata
      });
    } catch (_) {}
  }

  function errorText(err) {
    return err?.message || err?.details || err?.hint || 'خطای نامشخص';
  }

  function showSectionError(id, err) {
    const el = $(id);
    if (el) el.innerHTML = '<div class="empty">__AZICON_ERROR__ ' + esc(errorText(err)) + '</div>';
  }

  async function requireData(query, targetId) {
    const r = await query;
    if (r.error) showSectionError(targetId, r.error);
    return r;
  }

  function hideMfaGate() {
    const el = $('mfaScreen');
    if (el) el.classList.add('hidden');
    $('app')?.classList.remove('hidden');
  }

  function showMfaGate(title, html) {
    const el = $('mfaScreen');
    if (!el) return;
    el.innerHTML =
      '<div class="mfa-card">' +
        '<div class="mfa-badge">__AZICON_LOCK__ امنیت حساب مدیر</div>' +
        '<h2>' + esc(title) + '</h2>' +
        html +
        '<button type="button" id="mfaLogoutBtn" class="btn secondary" style="width:100%;margin-top:8px">خروج از حساب</button>' +
        '<div id="mfaStatus" class="mfa-status"></div>' +
      '</div>';
    el.classList.remove('hidden');
    $('app')?.classList.add('hidden');
    $('mfaLogoutBtn')?.addEventListener('click', async () => {
      await state.db.auth.signOut();
      el.classList.add('hidden');
      $('loginScreen').classList.remove('hidden');
      $('loginStatus').textContent = '';
    });
  }

  async function verifyAdminMFA(factorId, code) {
    const status = $('mfaStatus');
    if (status) { status.className = 'mfa-status'; status.textContent = 'در حال بررسی کد…'; }
    const clean = String(code || '').replace(/\\D/g,'').slice(0,6);
    if (clean.length !== 6) {
      if (status) { status.className='mfa-status error'; status.textContent='کد ۶ رقمی برنامه احراز هویت را وارد کنید.'; }
      return false;
    }
    const r = await state.db.auth.mfa.challengeAndVerify({ factorId, code: clean });
    if (r.error) {
      if (status) { status.className='mfa-status error'; status.textContent='کد امنیتی صحیح نیست یا منقضی شده است.'; }
      return false;
    }
    return true;
  }

  async function requireAdminMFA() {
    if (!state.db || !state.user) return false;
    const aal = await state.db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.error) {
      showMfaGate('بررسی امنیتی ناموفق بود.', '<p>وضعیت امنیتی نشست قابل بررسی نیست. دوباره وارد شوید.</p>');
      return false;
    }
    if (aal.data?.currentLevel === 'aal2') return true;

    const factors = await state.db.auth.mfa.listFactors();
    if (factors.error) {
      showMfaGate('احراز هویت دومرحله‌ای در دسترس نیست.', '<p>مدیریت فروشگاه بدون تأیید دومرحله‌ای اجازه ادامه نمی‌دهد.</p>');
      return false;
    }

    const verified = (factors.data?.totp || []).find(f => f.status === 'verified');
    if (verified) {
      showMfaGate(
        'کد امنیتی مدیر را وارد کنید',
        '<p>برای ورود به پنل، کد ۶ رقمی برنامه Authenticator را وارد کنید.</p>' +
        '<input id="mfaChallengeCode" class="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">' +
        '<div class="mfa-actions">' +
          '<button type="button" id="mfaChallengeVerifyBtn" class="btn">تأیید کد</button>' +
        '</div>' +
        '<div class="mfa-help">Google Authenticator، Microsoft Authenticator، 1Password یا برنامه TOTP مشابه قابل استفاده است.</div>'
      );
      const input = $('mfaChallengeCode');
      const verifyBtn = $('mfaChallengeVerifyBtn');
      const finish = async () => {
        const ok = await verifyAdminMFA(verified.id, input.value);
        if (ok) {
          hideMfaGate();
          await loadDashboard();
        }
      };
      input?.focus();
      verifyBtn?.addEventListener('click', finish);
      input?.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 6);
        if (input.value.length === 6) verifyBtn?.focus();
      });
      input?.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        await finish();
      });
      return false;
    }

    try {
      const pending = (factors.data?.totp || []).find(f => f.status !== 'verified');
      let factor = pending;
      let qrData = '';
      let secret = '';

      if (!factor) {
        const enrollment = await state.db.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Azim Abzar Admin'
        });
        if (enrollment.error) throw enrollment.error;
        factor = enrollment.data;
        const qr = String(factor.totp?.qr_code || '');
        secret = String(factor.totp?.secret || '');
        qrData = qr ? 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(qr))) : '';
      }

      showMfaGate(
        'فعال‌سازی احراز هویت دومرحله‌ای',
        (pending ? '<p>یک راه‌اندازی MFA نیمه‌کاره پیدا شد. همان Authenticator قبلی را نگه دارید و کد ۶ رقمی فعلی را وارد کنید.</p>' : '<p>این مرحله را فقط یک‌بار انجام دهید. QR را با برنامه Authenticator اسکن کنید، سپس کد ۶ رقمی همان برنامه را وارد کنید.</p>') +
        (qrData ? '<img class="mfa-qr" alt="QR کد MFA" src="' + qrData + '">' : '') +
        (secret ? '<div class="mfa-secret">' + esc(secret) + '</div>' : '') +
        '<input id="mfaEnrollCode" class="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">' +
        '<div class="mfa-actions"><button type="button" id="mfaVerifyBtn" class="btn">تأیید و فعال‌سازی</button><button type="button" id="mfaCancelBtn" class="btn secondary">خروج از حساب</button></div>' +
        '<div class="mfa-help">' + (pending ? 'عامل قبلی هنوز تأیید نشده است؛ با تأیید کد، همان عامل فعال می‌شود.' : 'اگر QR اسکن نشد، کلید بالا را دستی داخل Authenticator وارد کنید.') + '</div>'
      );
      const input = $('mfaEnrollCode');
      const verifyBtn = $('mfaVerifyBtn');
      const finish = async () => {
        const ok = await verifyAdminMFA(factor.id, input?.value);
        if (ok) {
          hideMfaGate();
          await loadDashboard();
        }
      };
      input?.focus();
      verifyBtn?.addEventListener('click', finish);
      input?.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 6);
        if (input.value.length === 6) verifyBtn?.focus();
      });
      input?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await finish();
        }
      });
      $('mfaCancelBtn')?.addEventListener('click', async () => {
        await state.db.auth.signOut();
        $('mfaScreen')?.classList.add('hidden');
        $('loginScreen')?.classList.remove('hidden');
      });
    } catch (err) {
      showMfaGate('فعال‌سازی MFA انجام نشد.', '<p>' + esc(errorText(err)) + '</p>');
    }
    return false;
  }

  async function ensureAdmin() {
    if (!state.db) return false;
    const auth = await state.db.auth.getUser();
    const u = auth.data?.user;
    if (!u) {
      $('loginScreen').classList.remove('hidden');
      $('app').classList.add('hidden');
      return false;
    }

    const r = await state.db
      .from('admin_users')
      .select('user_id,role,is_active,created_at')
      .eq('user_id', u.id)
      .maybeSingle();

    if (r.error || !r.data || !r.data.is_active) {
      $('loginStatus').textContent = '__AZICON_BLOCK__ این حساب مدیر فعال نیست.';
      $('loginScreen').classList.remove('hidden');
      $('app').classList.add('hidden');
      return false;
    }

    state.user = u;
    state.me = r.data;
    $('userBox').innerHTML = esc(u.email) + '<br>نقش: ' + esc(labels[state.me.role] || state.me.role);
    $('loginScreen').classList.add('hidden');
    $('app').classList.remove('hidden');

    applyRoleUI();
    markAdminMenu();
    if ($('azMenuUser')) $('azMenuUser').innerHTML = esc(u.email) + '<br>نقش: ' + esc(labels[state.me.role] || state.me.role);
    return true;
  }

  function initAdminMenu() {
    const overlay = $('azMenuOverlay');
    const trigger = $('azMenuTrigger');
    const closeBtn = $('azMenuClose');
    if (!overlay || !trigger) return;

    const close = () => {
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden','true');
      trigger.classList.remove('active');
      trigger.setAttribute('aria-expanded','false');
    };
    const open = () => {
      overlay.classList.add('show');
      overlay.setAttribute('aria-hidden','false');
      trigger.classList.add('active');
      trigger.setAttribute('aria-expanded','true');
      markAdminMenu();
    };

    trigger.onclick = () => overlay.classList.contains('show') ? close() : open();
    closeBtn?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) close();
    });
    document.querySelectorAll('[data-menu-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.menuView;
        close();
        setView(view);
      });
    });

    window.__azCloseMenu = close;
  }

  function markAdminMenu() {
    const current = activeView();
    document.querySelectorAll('[data-menu-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.menuView === current);
      // Use the same role matrix as side navigation and setView().
      btn.style.display = canView(btn.dataset.menuView) ? '' : 'none';
    });
  }

  function initCommandPalette() {
    const overlay = $('commandPalette');
    const input = $('commandInput');
    const list = $('commandList');
    if (!overlay || !input || !list) return;
    const navItems = [
      ['dashboard','داشبورد','نمای کلی و سلامت سیستم'],
      ['products','محصولات','جستجو و ویرایش کاتالوگ'],
      ['categories','دسته‌بندی‌ها','گروه‌بندی محصولات'],
      ['brands','برندها','مدیریت برندها'],
      ['inquiries','درخواست‌ها','استعلام و پیگیری'],
      ['orders','سفارش‌ها','سفارش و ارسال'],
      ['discounts','تخفیف و پروموشن','کمپین و تخفیف خودکار'],
      ['discount-codes','کدهای تخفیف','کدهای قابل استفاده مشتری'],
      ['customers','مشتریان','اطلاعات مشتریان'],
      ['media','رسانه','تصاویر و فایل‌ها'],
      ['content','محتوای سایت','CMS'],
      ['admins','کاربران مدیر','نقش‌ها'],
      ['audit','گزارش فعالیت','Audit Log'],
      ['security','امنیت حساب','MFA، نشست و دسترسی'],
      ['ai-products','ربات محصولات','مشاوره خودکار محصولات'],
      ['ai','هوش مصنوعی','چت عمومی و تنظیمات AI'],
      ['payment','مدیریت درگاه پرداخت','تراکنش‌ها، وضعیت درگاه و بازگشت وجه']
    ];
    let active = 0;
    function render(q='') {
      const nq = q.trim().toLowerCase();
      const matches = navItems.filter(x =>
        canView(x[0]) &&
        (!nq || (x[1]+' '+x[2]).toLowerCase().includes(nq))
      );
      list.innerHTML = matches.length ? matches.map((x,i) =>
        '<div class="az-command-item ' + (i===active?'active':'') + '" data-command-view="' + x[0] + '"><span>' + esc(x[1]) + '</span><small>' + esc(x[2]) + '</small></div>'
      ).join('') : '<div class="empty">نتیجه‌ای پیدا نشد.</div>';
      list.querySelectorAll('[data-command-view]').forEach(el => el.onclick = () => { close(); setView(el.dataset.commandView); });
    }
    function open() { overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); input.value=''; active=0; render(); setTimeout(()=>input.focus(),20); }
    function close() { overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); }
    window.__openAzCommandPalette = open;
    $('commandClose').onclick=close;
    overlay.onclick=(e)=>{if(e.target===overlay)close();};
    input.oninput=()=>{active=0;render(input.value);};
    document.addEventListener('keydown',(e)=>{
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k') { e.preventDefault(); open(); }
      if (e.key==='Escape' && overlay.classList.contains('show')) close();
      if (overlay.classList.contains('show') && e.key==='ArrowDown') { e.preventDefault(); active++; render(input.value); }
      if (overlay.classList.contains('show') && e.key==='ArrowUp') { e.preventDefault(); active=Math.max(0,active-1); render(input.value); }
      if (overlay.classList.contains('show') && e.key==='Enter') { const el=list.querySelectorAll('[data-command-view]')[active]; if(el){el.click();} }
    });
  }

  function ensureExtraUI() {
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('.az-nav-group-label')) {
      const addGroup = (text, beforeView) => {
        const target = nav.querySelector('[data-view="' + beforeView + '"]');
        if (!target) return;
        const label = document.createElement('div');
        label.className = 'az-nav-group-label';
        label.textContent = text;
        target.before(label);
      };
      addGroup('فروش و مشتری', 'orders');
      addGroup('کاتالوگ', 'products');
      addGroup('محتوا', 'content');
      addGroup('سیستم', 'admins');
    }

    if (nav && !nav.querySelector('[data-view="discounts"]')) {
      const btn = document.createElement('button');
      btn.dataset.view = 'discounts';
      btn.innerHTML = '🎟️ تخفیف و پروموشن';
      const ordersBtn = nav.querySelector('[data-view="orders"]');
      nav.insertBefore(btn, ordersBtn || null);
    }
    if (nav && !nav.querySelector('[data-view="discount-codes"]')) {
      const btn = document.createElement('button');
      btn.dataset.view = 'discount-codes';
      btn.innerHTML = '🏷️ کدهای تخفیف';
      const discountBtn = nav.querySelector('[data-view="discounts"]');
      if (discountBtn) discountBtn.after(btn);
    }
    if (nav && !nav.querySelector('[data-view="payment"]')) {
      const btn = document.createElement('button');
      btn.dataset.view = 'payment';
      btn.innerHTML = '__AZICON_INVOICE__ مدیریت درگاه پرداخت';
      const target = nav.querySelector('[data-view="admins"]');
      nav.insertBefore(btn, target || null);
    }

    const menuGrid = document.querySelector('.az-menu-grid');
    if (menuGrid && !menuGrid.querySelector('[data-menu-view="payment"]')) {
      const btn = document.createElement('button');
      btn.className = 'az-menu-item az-menu-payment-item';
      btn.dataset.menuView = 'payment';
      btn.innerHTML = '<span class="az-menu-icon">__AZICON_INVOICE__</span><span class="az-menu-copy"><strong>مدیریت درگاه پرداخت</strong><small>کنترل امن پرداخت</small></span>';
      const target = menuGrid.querySelector('[data-menu-view="admins"]');
      menuGrid.insertBefore(btn, target || null);
    }

    const main = document.querySelector('.main');
    const dash = $('view-dashboard');
    if (main && !$('view-payment')) {
      const sec = document.createElement('section');
      sec.id = 'view-payment';
      sec.className = 'view';
      sec.innerHTML = '<div id="paymentAdminPanel"></div>';
      const before = $('view-security');
      if (before?.parentNode) before.before(sec); else main.appendChild(sec);
    }
    ensureDiscountSection();
    ensureDiscountCodeSection();
    if (dash && !$('dashboardHealth')) {
      const h = document.createElement('div');
      h.id = 'dashboardHealth';
      dash.appendChild(h);
    }

    if (main && !$('view-ai')) {
  
    if (!document.getElementById('az-discount-inline-style')) {
      const st = document.createElement('style');
      st.id = 'az-discount-inline-style';
      st.textContent = `
        .az-discount-shell{display:grid;gap:14px}
        .az-discount-hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;align-items:center;gap:22px;padding:26px;border:1px solid rgba(245,185,0,.28);border-radius:22px;background:radial-gradient(circle at 86% 10%,rgba(245,185,0,.18),transparent 31%),radial-gradient(circle at 10% 120%,rgba(46,213,115,.08),transparent 35%),linear-gradient(135deg,#151a16,#0d110f 72%);box-shadow:0 18px 50px rgba(0,0,0,.2)}
        .az-discount-hero:after{content:"";position:absolute;right:-10%;bottom:-55%;width:48%;height:180px;background:radial-gradient(circle,rgba(245,185,0,.10),transparent 65%);pointer-events:none}
        .az-discount-hero h2{margin:5px 0 6px;font-size:clamp(22px,3vw,30px);letter-spacing:-.4px}
        .az-discount-hero p{margin:0;max-width:760px;color:#9aa39c;font-size:12px;line-height:1.9}
        .az-discount-stats{margin-bottom:0}
        .az-discount-stats .card{min-height:100px;display:flex;flex-direction:column;justify-content:center}
        .az-discount-stats .v{font-size:25px}
        .discount-target-wrap{border:1px solid #313c35;border-radius:16px;padding:14px;background:linear-gradient(180deg,#101510,#0b0f0c)}
        .discount-target-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
        .discount-target-list{max-height:320px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
        .discount-target-item{display:flex;gap:8px;align-items:flex-start;padding:10px 11px;border:1px solid #232d27;border-radius:11px;background:#111613;font-size:10px;transition:.18s ease}
        .discount-target-item:hover{border-color:#5a674f;transform:translateY(-1px)}
        .az-coupon-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .az-coupon-card{position:relative;overflow:hidden;padding:16px;border:1px solid #29342e;border-radius:18px;background:linear-gradient(160deg,#131814,#0e1210);box-shadow:0 12px 34px rgba(0,0,0,.16);transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
        .az-coupon-card:before{content:"";position:absolute;top:0;right:0;left:0;height:3px;background:linear-gradient(90deg,rgba(245,185,0,.9),rgba(245,185,0,.05))}
        .az-coupon-card:hover{transform:translateY(-3px);border-color:#4a564d;box-shadow:0 18px 42px rgba(0,0,0,.24)}
        .az-coupon-top,.az-coupon-main,.az-coupon-meta,.az-coupon-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .az-coupon-top{margin-bottom:12px}
        .az-coupon-code{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px dashed #6b5822;border-radius:10px;background:#17160e;color:#f5c51c;font:800 13px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.7px}
        .az-coupon-title{margin:8px 0 0;font-size:14px}
        .az-coupon-sub{margin:4px 0 0;color:#808980;font-size:10px;line-height:1.7}
        .az-coupon-main{padding:13px 0;border-top:1px solid #202823;border-bottom:1px solid #202823}
        .az-coupon-value{font-size:21px;font-weight:950;color:#f3f5ef}
        .az-coupon-scope{font-size:10px;color:#abb5ad;text-align:left}
        .az-coupon-meta{align-items:flex-start;flex-wrap:wrap;padding-top:12px}
        .az-coupon-meta > div{min-width:120px}
        .az-coupon-label{display:block;color:#69736b;font-size:9px;margin-bottom:2px}
        .az-coupon-number{font-size:11px;font-weight:800}
        .az-coupon-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
        .az-coupon-actions{justify-content:flex-start;margin-top:13px;flex-wrap:wrap}
        .az-coupon-actions .btn{min-height:34px}
        .az-coupon-empty{padding:34px 20px;text-align:center;border:1px dashed #334038;border-radius:18px;background:#0d120f}
        .az-coupon-code-row{display:flex;gap:8px;align-items:stretch}
        .az-coupon-code-row .input{flex:1}
        .az-coupon-code-row .btn{white-space:nowrap}
        .az-product-coupon-cta{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:12px 13px;border:1px dashed #5a4c23;border-radius:12px;background:rgba(245,185,0,.035)}
        .az-product-coupon-cta div{display:grid;gap:3px}
        .az-product-coupon-cta strong{font-size:11px}
        .az-product-coupon-cta small{color:#777f79;font-size:9px;line-height:1.7}
        code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#161c18;padding:3px 6px;border-radius:6px}
        @media(max-width:900px){.az-coupon-grid{grid-template-columns:1fr}}
        @media(max-width:720px){.az-discount-hero{align-items:flex-start;flex-direction:column}.discount-target-list{grid-template-columns:1fr}.az-product-coupon-cta{align-items:flex-start;flex-direction:column}.az-coupon-meta > div{min-width:46%}.az-coupon-actions .btn{flex:1}}
      `;
      document.head.appendChild(st);
    }

    const sec = document.createElement('section');
      sec.id = 'view-ai';
      sec.className = 'view';
      sec.innerHTML =
        '<div class="az-ai-shell">' +
          '<div class="az-ai-hero">' +
            '<div><div class="az-section-kicker">AI CONTROL CENTER</div><h2>مرکز کنترل دستیار هوشمند</h2><p>تنظیم، تست و کنترل دستیار فروش عظیم ابزار؛ متصل به کاتالوگ محصولات.</p></div>' +
            '<div class="az-ai-hero-actions"><span id="aiHealth" class="badge">در حال بررسی</span><button id="aiTestTop" class="btn secondary" type="button">تست اتصال</button></div>' +
          '</div>' +
          '<div id="aiEditor"></div>' +
        '</div>';
      main.appendChild(sec);
    }

    const orderHead = document.querySelector('#view-orders .panel-head');
    if (orderHead && !$('newOrderBtn')) {
      const b = document.createElement('button');
      b.id = 'newOrderBtn';
      b.className = 'btn';
      b.textContent = '＋ سفارش جدید';
      orderHead.appendChild(b);
    }
    const customerHead = document.querySelector('#view-customers .panel-head');
    if (customerHead && !$('newCustomerBtn')) {
      const b = document.createElement('button');
      b.id = 'newCustomerBtn';
      b.className = 'btn';
      b.textContent = '＋ مشتری جدید';
      customerHead.appendChild(b);
    }

    document.querySelectorAll('.nav button').forEach((b) => {
      b.onclick = () => setView(b.dataset.view);
    });
    document.querySelectorAll('[data-go]').forEach((b) => {
      b.onclick = () => setView(b.dataset.go);
    });

    $('refreshBtn').onclick = () => loadSection(activeView());
    $('adminBackBtn')?.addEventListener('click', () => goBackAdminView());
    updateAdminBackButton();
    const topbar = document.querySelector('.topbar');
    if (topbar && !$('azOpenSiteBtn')) {
      const siteBtn = document.createElement('button');
      siteBtn.id = 'azOpenSiteBtn';
      siteBtn.className = 'btn secondary';
      siteBtn.type = 'button';
      siteBtn.textContent = '__AZICON_GLOBE__ مشاهده سایت';
      siteBtn.onclick = () => window.open(new URL('/', window.location.origin).href, '_blank', 'noopener');
      topbar.appendChild(siteBtn);
    }
    if (topbar && !document.querySelector('.az-topbar-search')) {
      const tools = document.createElement('div');
      tools.className = 'az-topbar-search';
      const b = document.createElement('button');
      b.className = 'btn secondary';
      b.type = 'button';
      b.innerHTML = '⌘ <span>جستجوی سریع</span>';
      b.onclick = () => window.__openAzCommandPalette?.();
      tools.appendChild(b);
      topbar.appendChild(tools);
    }
    $('logoutBtn').onclick = async () => {
      await state.db.auth.signOut();
      location.reload();
    };
    $('azMenuLogout')?.addEventListener('click', async () => {
      await state.db.auth.signOut();
      location.reload();
    });

    const productTools = document.querySelector('#view-products .tools');
    if (productTools && !$('productCategoryFilter')) {
      const sel = document.createElement('select');
      sel.id = 'productCategoryFilter';
      sel.className = 'select';
      sel.innerHTML = '<option value="">همه دسته‌ها</option>';
      productTools.insertBefore(sel, $('newProductBtn'));
      sel.onchange = () => loadProducts();
    }

    $('newProductBtn').onclick = () => newProduct();
    $('newCategoryBtn').onclick = () => newCategory();
    $('newBrandBtn').onclick = () => newBrand();
    $('newContentBtn').onclick = () => newContent();
    document.querySelectorAll('[data-open-payment-admin]').forEach((b) => b.onclick = () => setView('payment'));
    $('uploadMediaBtn').onclick = () => uploadMedia();
    $('homeCopyBtn')?.addEventListener('click', () => openFocusedSiteEditor('home'));
    $('contactCopyBtn')?.addEventListener('click', () => openFocusedSiteEditor('contact'));
    $('footerCopyBtn')?.addEventListener('click', () => openSharedFooterEditor());
    $('homeCopyCard')?.addEventListener('click', () => openFocusedSiteEditor('home'));
    $('contactCopyCard')?.addEventListener('click', () => openFocusedSiteEditor('contact'));
    $('footerCopyCard')?.addEventListener('click', () => openSharedFooterEditor());
    $('unifiedSiteBtn')?.addEventListener('click', () => openUnifiedSiteEditor());
    $('changePasswordBtn')?.addEventListener('click', () => openPasswordChange(false));
    $('newOrderBtn').onclick = () => newOrder();
    $('newCustomerBtn').onclick = () => newCustomer();
    $('productSearch').oninput = () => { clearTimeout(productSearchTimer); productSearchTimer = setTimeout(() => loadProducts(), 240); };
    $('productStatus').onchange = () => loadProducts();
    $('productCategoryFilter').onchange = () => loadProducts();
    $('productVariantFilter').onchange = () => loadProducts();
    $('dashboardOpenSite')?.addEventListener('click', () => window.open(new URL('/', window.location.origin).href, '_blank', 'noopener'));
    $('inquiryFilter').onchange = () => loadInquiries();
    $('reportPeriod')?.addEventListener('change', () => loadReports());
    $('reportRefresh')?.addEventListener('click', () => loadReports());
    $('ordersSearch')?.addEventListener('input', () => {
      clearTimeout(ordersSearchTimer);
      ordersPage = 1;
      ordersSearchTimer = setTimeout(() => loadOrders(), 220);
    });
    $('clearOrdersSearch')?.addEventListener('click', () => {
      if($('ordersSearch')) $('ordersSearch').value='';
      ['ordersStatusFilter','ordersPaymentFilter','ordersShippingFilter','ordersPeriodFilter'].forEach((id) => { if ($(id)) $(id).value = id === 'ordersPeriodFilter' ? '0' : ''; });
      ordersPage = 1;
      loadOrders();
    });
    $('ordersPageSize')?.addEventListener('change', () => {
      ordersPageSize = Math.max(1, Number($('ordersPageSize').value || 25));
      ordersPage = 1;
      loadOrders();
    });
    ['ordersStatusFilter','ordersPaymentFilter','ordersShippingFilter','ordersPeriodFilter'].forEach((id) => {
      $(id)?.addEventListener('change', () => { ordersPage = 1; loadOrders(); });
    });
    $('refreshServiceRequestsBtn')?.addEventListener('click', () => loadServiceRequests());
    $('serviceRequestsLauncher')?.addEventListener('click', () => {
      const panel = $('adminServiceRequestsPanel');
      if (!panel) return;
      panel.hidden = false;
      panel.setAttribute('aria-hidden', 'false');
      $('serviceRequestsLauncher')?.setAttribute('aria-expanded','true');
      document.body.classList.add('az-service-open');
    });
    $('closeServiceRequestsBtn')?.addEventListener('click', () => {
      const panel = $('adminServiceRequestsPanel');
      if (!panel) return;
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      $('serviceRequestsLauncher')?.setAttribute('aria-expanded','false');
      document.body.classList.remove('az-service-open');
    });
    $('refreshReviewsBtn')?.addEventListener('click', () => loadReviews());
  }

  function applyRoleUI() {
    // One canonical role map drives navigation visibility and setView() access.
    // Duplicated maps previously caused restricted links to remain visible and
    // valid links (reports/reviews) to disappear from the side menu.
    document.querySelectorAll('.nav button[data-view]').forEach((b) => {
      const allowed = canView(b.dataset.view);
      b.style.display = allowed ? '' : 'none';
    });
    if ($('newProductBtn')) $('newProductBtn').style.display = can.edit() ? '' : 'none';
    if ($('newCategoryBtn')) $('newCategoryBtn').style.display = can.edit() ? '' : 'none';
    if ($('newBrandBtn')) $('newBrandBtn').style.display = can.edit() ? '' : 'none';
    if ($('newContentBtn')) $('newContentBtn').style.display = can.edit() ? '' : 'none';
    if ($('uploadMediaBtn')) $('uploadMediaBtn').style.display = can.edit() ? '' : 'none';
    if ($('newOrderBtn')) $('newOrderBtn').style.display = can.sales() ? '' : 'none';
    if ($('newCustomerBtn')) $('newCustomerBtn').style.display = can.sales() ? '' : 'none';
    if ($('newDiscountBtn')) $('newDiscountBtn').style.display = can.all() ? '' : 'none';
    if ($('newDiscountCodeBtn')) $('newDiscountCodeBtn').style.display = can.all() ? '' : 'none';
  }

  function activeView() {
    return document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';
  }

  function updateAdminBackButton() {
    const btn = $('adminBackBtn');
    if (!btn) return;
    const available = state.viewHistory.length > 0;
    btn.disabled = !available;
    btn.setAttribute('aria-disabled', available ? 'false' : 'true');
    btn.classList.toggle('disabled', !available);
  }

  async function setView(name, options = {}) {
    if (!canView(name)) return toast('__AZICON_BLOCK__ دسترسی این بخش برای نقش فعلی وجود ندارد.');
    const current = activeView();
    if (current !== name && !options.fromBack) {
      state.viewHistory.push(current);
      if (state.viewHistory.length > 40) state.viewHistory.shift();
    }
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = $('view-' + name);
    if (!target) return;
    target.classList.add('active');
    document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    const activeNav = document.querySelector('.nav button[data-view="' + name + '"]');
    if (activeNav && window.matchMedia && window.matchMedia('(max-width:720px)').matches) {
      activeNav.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
    if (viewInfo[name]) {
      $('pageTitle').textContent = viewInfo[name][0];
      $('pageSub').textContent = viewInfo[name][1];
    }
    markAdminMenu();
    updateAdminBackButton();
    await loadSection(name);
  }

  async function goBackAdminView() {
    const previous = state.viewHistory.pop();
    updateAdminBackButton();
    if (!previous || previous === activeView()) return;
    await setView(previous, { fromBack: true });
  }

  function showSkeleton(id, rows = 5) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = '<div style="display:grid;gap:8px">' + Array.from({length: rows}, () => '<div class="az-skeleton"></div>').join('') + '</div>';
  }

  async function loadSection(name) {
    try {
      if (name === 'discounts') return await loadDiscounts();
      if (name === 'discount-codes') return await loadDiscountCodes();
      if (name === 'ai-products') return await loadAIProducts();
      if (name === 'reports') return await loadReports();
      if (name === 'reviews') return await loadReviews();
    if (name === 'payment') return await loadPaymentAdmin();

      const skeletons = {
        products: 'productsTable', reviews: 'reviewsTable', categories: 'categoriesTable', brands: 'brandsTable',
        inquiries: 'inquiriesTable', orders: 'ordersTable', customers: 'customersTable',
        media: 'mediaTable', content: 'contentTable', admins: 'adminsTable', audit: 'auditTable',
        security: 'securityPanel', payment: 'paymentAdminPanel', reports: 'salesReport'
      };
      if (skeletons[name]) showSkeleton(skeletons[name]);

      if (name === 'dashboard') await loadDashboard();
      else if (name === 'products') await loadProducts();
      else if (name === 'reviews') await loadReviews();
      else if (name === 'categories') await loadCategories();
      else if (name === 'brands') await loadBrands();
      else if (name === 'inquiries') await loadInquiries();
      else if (name === 'orders') await Promise.all([loadOrders(), loadServiceRequests()]);
      else if (name === 'customers') await loadCustomers();
      else if (name === 'media') await loadMedia();
      else if (name === 'content') await loadContent();
      else if (name === 'ai') await loadAI();
      else if (name === 'admins') await loadAdmins();
      else if (name === 'audit') await loadAudit();
      else if (name === 'security') await loadSecurity();
    } catch (e) {
      console.error('Azim Abzar admin section load failed:', e);
      const message = errorText(e);
      const targets = {
        products: 'productsTable', categories: 'categoriesTable', brands: 'brandsTable',
        inquiries: 'inquiriesTable', orders: 'ordersTable', customers: 'customersTable',
        media: 'mediaTable', content: 'contentTable', admins: 'adminsTable', audit: 'auditTable', security: 'securityPanel'
      };
      if (targets[name]) showSectionError(targets[name], e);
      toast('__AZICON_ERROR__ ' + message);
    }
  }


  async function countTable(table, filter) {
    let q = state.db.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const r = await q;
    return r.error ? 0 : (r.count || 0);
  }

  async function loadDashboard() {
    const [all, active, inq, orders, customers, media] = await Promise.all([
      countTable('products'),
      countTable('products', q => q.eq('is_active', true)),
      countTable('inquiries', q => q.eq('status', 'new')),
      countTable('orders'),
      countTable('customers'),
      countTable('media_assets')
    ]);
    $('statProducts').textContent = all.toLocaleString('fa-IR');
    $('statActive').textContent = active.toLocaleString('fa-IR');
    $('statInquiries').textContent = inq.toLocaleString('fa-IR');
    $('statOrders').textContent = orders.toLocaleString('fa-IR');
    const ring = $('dashboardProductRing');
    if (ring) ring.textContent = all.toLocaleString('fa-IR');
    const systemStatus = $('dashboardSystemStatus');
    const systemSub = $('dashboardSystemSub');
    if (systemStatus) {
      systemStatus.textContent = all > 0 ? 'سیستم فعال است' : 'بررسی کاتالوگ';
    }
    if (systemSub) {
      systemSub.textContent = all > 0
        ? active.toLocaleString('fa-IR') + ' محصول فعال · داده‌ها متصل'
        : 'محصولی برای نمایش پیدا نشد';
    }
    const salesSince = new Date(Date.now() - 29 * 86400000).toISOString();
    const salesResult = await state.db.from('orders')
      .select('total,created_at,status')
      .gte('created_at', salesSince)
      .order('created_at', { ascending: true })
      .limit(5000);
    renderDashboardSalesChart(salesResult.data || [], salesResult.error);

    const a = await state.db.from('inquiries')
      .select('id,full_name,mobile,subject,status,created_at')
      .order('created_at', { ascending: false })
      .limit(6);

    if (a.error) showSectionError('dashboardInquiries', a.error);
    else $('dashboardInquiries').innerHTML = renderInquiryTable(a.data || [], true);

    const health = $('dashboardHealth');
    if (health) {
      const catCount = await countTable('categories');
      const brandCount = await countTable('brands');
      const siteCount = await countTable('site_content');
      health.innerHTML =
        '<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>مرکز سلامت و کنترل</h2><span class="az-publish-dot"><i></i> سیستم فعال</span></div>' +
        '<div class="az-health-grid">' +
        healthItemModern('احراز هویت', true, 'حساب مدیر فعال است') +
        healthItemModern('کاتالوگ', all > 0, all.toLocaleString('fa-IR') + ' محصول') +
        healthItemModern('دسته‌بندی', catCount > 0, catCount.toLocaleString('fa-IR') + ' دسته') +
        healthItemModern('برند', brandCount > 0, brandCount.toLocaleString('fa-IR') + ' برند') +
        healthItemModern('محتوا', siteCount > 0, siteCount.toLocaleString('fa-IR') + ' بخش قابل مدیریت') +
        healthItemModern('رسانه', true, media.toLocaleString('fa-IR') + ' فایل') +
        '</div>' +
        '<div class="az-stat-strip">' +
        miniStat('مشتریان', customers) + miniStat('درخواست جدید', inq) + miniStat('سفارش‌ها', orders) +
        '</div></div>';
    }
  }

  function renderDashboardSalesChart(rows, error) {
    let panel = $('dashboardSalesChart');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'dashboardSalesChart';
      panel.className = 'panel az-dashboard-chart';
      const anchor = $('dashboardInquiries')?.closest('.panel');
      if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor);
      else $('view-dashboard')?.appendChild(panel);
    }
    if (error) {
      panel.innerHTML = '<div class="panel-head"><div><h2>روند فروش</h2><div class="muted">۳۰ روز اخیر</div></div></div><div class="empty">__AZICON_ERROR__ دریافت داده‌های نمودار فروش ناموفق بود.</div>';
      return;
    }
    const valid = (rows || []).filter(x => String(x.status || '').toLowerCase() !== 'cancelled');
    const byDay = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0,10);
      byDay.set(key, 0);
    }
    valid.forEach(x => {
      const key = new Date(x.created_at).toISOString().slice(0,10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + Number(x.total || 0));
    });
    const pointsData = [...byDay.entries()].map(([key,value]) => ({ key, value }));
    const values = pointsData.map(x => x.value);
    const total = values.reduce((s,v) => s + v, 0);
    const peak = Math.max(...values, 0);
    const peakIndex = values.indexOf(peak);
    const max = Math.max(1, peak);
    const W = 1000, H = 330, left = 54, right = 18, top = 28, bottom = 42;
    const plotW = W - left - right, plotH = H - top - bottom;
    const pts = pointsData.map((x,i) => ({
      x: left + (plotW * i / Math.max(1, pointsData.length - 1)),
      y: top + plotH - (x.value / max) * plotH,
      ...x
    }));
    const line = pts.map((p,i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' ');
    const area = 'M ' + left + ' ' + (top + plotH) + ' ' + pts.map(p => 'L ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' ') + ' L ' + (left + plotW) + ' ' + (top + plotH) + ' Z';
    const grid = [0,1,2,3,4].map(i => {
      const y = top + plotH * i / 4;
      const value = max * (1 - i / 4);
      return '<g><line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(left+plotW)+'" y2="'+y.toFixed(1)+'" class="az-chart-gridline"/><text x="'+(left-10)+'" y="'+(y+4).toFixed(1)+'" class="az-chart-y">'+Math.round(value).toLocaleString('fa-IR')+'</text></g>';
    }).join('');
    const dots = pts.map(p => '<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="3.2" class="az-chart-point"><title>'+new Date(p.key+'T12:00:00').toLocaleDateString('fa-IR',{month:'short',day:'numeric'})+' · '+Math.round(p.value).toLocaleString('fa-IR')+' تومان</title></circle>').join('');
    const labels = [0, Math.floor((pointsData.length-1)/2), pointsData.length-1].map(i => {
      const p = pts[i];
      return '<text x="'+p.x.toFixed(2)+'" y="'+(H-12)+'" text-anchor="middle" class="az-chart-x">'+new Date(p.key+'T12:00:00').toLocaleDateString('fa-IR',{month:'short',day:'numeric'})+'</text>';
    }).join('');
    const peakText = peakIndex >= 0 ? new Date(pointsData[peakIndex].key+'T12:00:00').toLocaleDateString('fa-IR',{month:'short',day:'numeric'}) : '—';
    panel.innerHTML = '<div class="panel-head"><div><h2>روند فروش</h2><div class="muted">۳۰ روز اخیر · سفارش‌های لغوشده از نمودار حذف شده‌اند</div></div><span class="az-chart-live"><i></i> LIVE DATA</span></div>' +
      '<div class="az-dashboard-chart-grid"><div class="az-sales-chart"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="نمودار فروش سی روز اخیر"><defs><linearGradient id="azSaleFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f5b900" stop-opacity=".22"/><stop offset="100%" stop-color="#f5b900" stop-opacity="0"/></linearGradient></defs>'+grid+'<path d="'+area+'" fill="url(#azSaleFill)"/><path d="'+line+'" class="az-chart-line"/>'+dots+labels+'</svg></div>' +
      '<aside class="az-chart-summary"><div class="az-chart-summary-main"><span>فروش ۳۰ روزه</span><strong>'+money(Math.round(total))+'</strong></div><div class="az-chart-stat"><span>بیشترین روز</span><b>'+money(Math.round(peak))+'</b><small>'+esc(peakText)+'</small></div><div class="az-chart-stat"><span>تعداد سفارش‌های شامل‌شده</span><b>'+valid.length.toLocaleString('fa-IR')+'</b><small>لغوشده‌ها محاسبه نشده‌اند</small></div></aside></div>';
  }

  function healthItemModern(label, ok, value) {
    return '<div class="az-health-card"><div class="az-health-title">' + esc(label) + '</div><div class="az-health-value">' +
      (ok ? '__AZICON_SUCCESS__ آماده' : '__AZICON_WARNING__ بررسی') + '</div><div class="az-health-sub">' + esc(value) + '</div></div>';
  }
  function miniStat(label, value) {
    return '<div class="az-mini-stat"><b>' + esc(label) + '</b><strong>' + Number(value || 0).toLocaleString('fa-IR') + '</strong></div>';
  }

  function paymentStatusLabel(status) {
    const map = {
      initiated:'ایجاد تراکنش',
      pending:'در انتظار',
      paid:'پرداخت شده',
      failed:'ناموفق',
      cancelled:'لغو شده',
      refunded:'عودت کامل',
      partially_refunded:'عودت بخشی',
      review_required:'نیازمند بررسی'
    };
    return map[String(status || '')] || String(status || 'نامشخص');
  }

  function refundStatusLabel(status) {
    const map = {
      requested:'درخواست شده',
      pending:'در انتظار',
      processing:'در حال پردازش',
      refunded:'عودت شده',
      failed:'ناموفق',
      cancelled:'لغو شده',
      review_required:'نیازمند بررسی'
    };
    return map[String(status || '')] || String(status || 'نامشخص');
  }

  function paymentBadge(status, refund = false) {
    const s = String(status || '');
    const cls = ['paid','refunded'].includes(s) ? 'ok'
      : ['failed','cancelled'].includes(s) ? 'red'
      : ['review_required','pending','initiated','processing','requested'].includes(s) ? 'warn' : '';
    return '<span class="badge ' + cls + '">' + esc(refund ? refundStatusLabel(s) : paymentStatusLabel(s)) + '</span>';
  }

  function paymentMoney(amount, unit) {
    const n = Number(amount || 0);
    if (!Number.isFinite(n)) return '—';
    const u = String(unit || 'toman').toLowerCase();
    const label = u === 'toman' ? 'تومان' : esc(u);
    return new Intl.NumberFormat('fa-IR').format(n) + ' ' + label;
  }

  function paymentCard(label, value, sub, tone = '') {
    return '<div class="az-payment-card ' + esc(tone) + '"><div class="k">' + esc(label) + '</div><div class="v">' + esc(String(value)) + '</div><div class="s">' + esc(sub || '') + '</div></div>';
  }

  async function ensurePaymentMFA() {
    try {
      const r = await state.db.auth.mfa.getAuthenticatorAssuranceLevel();
      if (r.error || r.data?.currentLevel !== 'aal2') {
        toast('__AZICON_LOCK__ برای عملیات پرداخت باید کد امنیتی دومرحله‌ای تأیید شده باشد.');
        return false;
      }
      return true;
    } catch (_) {
      toast('__AZICON_LOCK__ بررسی امنیت نشست پرداخت ممکن نشد.');
      return false;
    }
  }

  async function paymentEdgeAction(action, payload) {
    const sessionResult = await state.db.auth.getSession();
    const token = sessionResult?.data?.session?.access_token || '';
    if (!token) throw new Error('نشست مدیر منقضی شده است؛ دوباره وارد شوید.');
    const url = (window.AZIM_SUPABASE_URL || '') + '/functions/v1/azim-payment-gateway';
    const r = await fetch(url, {
      method: 'POST',
      headers: { apikey: window.AZIM_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(payload || {}) })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body?.ok === false) throw new Error(body?.error || body?.message || 'عملیات درگاه ناموفق بود.');
    return body;
  }

  async function runPaymentHealthcheck() {
    if (!(await ensurePaymentMFA())) return false;
    try {
      const result = await paymentEdgeAction('healthcheck', {});
      toast(result.ok
        ? '__AZICON_SUCCESS__ اتصال درگاه تأیید شد.' + (result.refund_api_configured ? ' Refund آماده است.' : ' تنظیمات امن Refund هنوز کامل نیست.')
        : '__AZICON_ERROR__ اتصال درگاه تأیید نشد.');
      await loadPaymentAdmin();
      return !!result.ok;
    } catch (error) {
      toast('__AZICON_ERROR__ ' + errorText(error));
      await loadPaymentAdmin();
      return false;
    }
  }

  function paymentAdminHtml(data) {
    const settings = data?.settings || {};
    const txs = Array.isArray(data?.recent_transactions) ? data.recent_transactions : [];
    const refunds = Array.isArray(data?.recent_refunds) ? data.recent_refunds : [];
    const reviews = Array.isArray(data?.recent_reviews) ? data.recent_reviews : [];
    const ts = data?.transaction_stats || {};
    const activeFilter = state.paymentStatusFilter || 'all';
    const visibleTxs = activeFilter === 'all' ? txs : txs.filter(tx => String(tx.status || '') === activeFilter);
    const rs = data?.refund_stats || {};
    const ready = !!settings.gateway_ready && !!settings.provider;
    const enabled = !!settings.online_enabled;
    const onlineState = enabled ? 'فعال' : 'خاموش';
    const readiness = settings.gateway_ready ? 'آماده' : 'آماده نیست';
    const provider = settings.provider || 'هنوز انتخاب نشده';
    const callback = settings.callback_path || 'payment-callback.html';

    const txRows = visibleTxs.length ? visibleTxs.map((tx) => {
      const refundBtn = ready && ['paid','partially_refunded'].includes(tx.status) && Number(tx.remaining_refundable || 0) > 0
        ? '<button class="btn ghost" data-payment-refund="' + esc(tx.id) + '">درخواست عودت</button>'
        : '';
      return '<tr>' +
        '<td><strong>' + esc(tx.order_code || '—') + '</strong><div class="muted">' + esc(tx.provider || '—') + '</div></td>' +
        '<td>' + paymentMoney(tx.amount, tx.amount_unit) + '</td>' +
        '<td>' + paymentBadge(tx.status) + (tx.provider_status ? '<div class="muted">' + esc(tx.provider_status) + '</div>' : '') + '</td>' +
        '<td>' + esc(tx.gateway_reference_masked || '—') + '</td>' +
        '<td>' + esc(dateFa(tx.created_at)) + '</td>' +
        '<td>' + refundBtn + '</td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="6"><div class="empty">' + (activeFilter === 'all' ? 'هنوز تراکنشی ثبت نشده است.' : 'برای این وضعیت تراکنشی در فهرست اخیر پیدا نشد.') + '</div></td></tr>';

    const reviewRows = reviews.length ? reviews.map((rv) =>
      '<tr>' +
      '<td><strong>' + esc(rv.order_code || '—') + '</strong><div class="muted">' + esc(rv.review_type === 'refund' ? 'عودت وجه' : 'پرداخت') + '</div></td>' +
      '<td>' + paymentMoney(rv.amount, rv.amount_unit) + '</td>' +
      '<td><span class="badge red">نیازمند بررسی</span></td>' +
      '<td>' + esc(rv.error_code || '—') + '</td>' +
      '<td>' + esc(rv.error_message || '—') + '</td>' +
      '<td>' + esc(dateFa(rv.created_at)) + '</td>' +
      '</tr>'
    ).join('') : '<tr><td colspan="6"><div class="empty">مغایرت باز یا مورد نیازمند بررسی ثبت نشده است.</div></td></tr>';

    const refundRows = refunds.length ? refunds.map((rf) =>
      '<tr>' +
      '<td><strong>' + esc(rf.order_code || '—') + '</strong><div class="muted">' + esc(rf.id || '') + '</div></td>' +
      '<td>' + paymentMoney(rf.amount, rf.amount_unit) + '</td>' +
      '<td>' + paymentBadge(rf.status, true) + '</td>' +
      '<td>' + esc(rf.reason || '—') + '</td>' +
      '<td>' + esc(dateFa(rf.created_at)) + '</td>' +
      '</tr>'
    ).join('') : '<tr><td colspan="5"><div class="empty">درخواست عودت وجهی ثبت نشده است.</div></td></tr>';

    return '<div class="az-payment-shell">' +
      '<div class="az-payment-hero">' +
        '<div><span class="az-section-kicker">PAYMENT CONTROL CENTER</span><h2>مدیریت امن درگاه پرداخت</h2><p>این بخش فقط برای مالک/مدیر ارشد و پس از MFA در دسترس است. از اینجا پرداختی دستی «موفق» یا «مرجوع» نمی‌شود؛ تأیید نهایی همیشه باید از خود درگاه انجام شود.</p></div>' +
        '<div class="az-payment-hero-status ' + (enabled && ready ? 'ok' : 'warn') + '"><span>وضعیت پرداخت آنلاین</span><strong>' + esc(onlineState) + '</strong><small>' + esc(readiness + ' · ' + provider) + '</small></div>' +
      '</div>' +
      '<div class="az-payment-cards">' +
        paymentCard('تراکنش‌های کل', Number(ts.paid||0)+Number(ts.pending||0)+Number(ts.failed||0)+Number(ts.cancelled||0)+Number(ts.initiated||0)+Number(ts.review_required||0)+Number(ts.refunded||0)+Number(ts.partially_refunded||0), 'ثبت‌شده در سامانه') +
        paymentCard('در انتظار تعیین تکلیف', Number(data?.pending_count||0), 'پرداخت‌های initiated / pending', Number(data?.pending_count||0) ? 'warn' : 'ok') +
        paymentCard('نیازمند بررسی', Number(data?.review_required_count||0), 'هیچ موردی نباید نادیده بماند', Number(data?.review_required_count||0) ? 'red' : 'ok') +
        paymentCard('درخواست‌های عودت', Object.values(rs).reduce((a,v)=>a+Number(v||0),0), 'ثبت‌شده در سیستم') +
      '</div>' +
      '<div class="az-payment-grid">' +
        '<div class="az-payment-panel">' +
          '<div class="az-payment-panel-head"><div><h3>کنترل پرداخت آنلاین</h3><p>فعال‌سازی فقط وقتی مجاز است که provider واقعی و gateway_ready هر دو تأیید شده باشند.</p></div>' +
          '<span class="badge ' + (enabled ? 'ok' : 'warn') + '">' + esc(onlineState) + '</span></div>' +
          '<div class="az-payment-settings-grid">' +
            '<div><span>درگاه</span><strong>' + esc(provider || 'هنوز انتخاب نشده') + '</strong></div>' +
            '<div><span>آمادگی اتصال</span><strong>' + esc(readiness) + '</strong></div>' +
            '<div><span>واحد فروشگاه</span><strong>' + esc(settings.provider_amount_unit || 'IRR') + '</strong></div>' +
            '<div><span>مسیر Callback</span><strong dir="ltr">' + esc(callback) + '</strong></div>' +
          '</div>' +
          '<div class="az-payment-config-form">' +
            '<div class="field"><label>شناسه درگاه (provider)</label><input class="input" data-payment-provider dir="ltr" autocomplete="off" value="' + esc(settings.provider || '') + '" placeholder="مثلاً zarinpal"></div>' +
            '<div class="field"><label>شناسه پذیرنده / Merchant ID</label><input class="input" data-payment-merchant-id dir="ltr" autocomplete="off" value="' + esc(settings.merchant_id || '') + '" placeholder="شناسه‌ای که خود درگاه اعلام می‌کند"></div>' +
            '<div class="field"><label>محیط</label><select class="input" data-payment-sandbox><option value="false"' + (!settings.sandbox ? ' selected' : '') + '>اصلی (Live)</option><option value="true"' + (settings.sandbox ? ' selected' : '') + '>آزمایشی (Sandbox)</option></select></div>' +
            '<div class="field full"><div class="az-payment-actions">' +
              '<button class="btn" type="button" data-payment-configure>💾 ذخیره تنظیمات درگاه</button>' +
              '<button class="btn ghost" type="button" data-payment-healthcheck>🩺 تست اتصال درگاه</button>' +
            '</div></div>' +
            '<div class="field full"><div class="mfa-status"><span>آخرین تست:</span> ' +
              esc(settings.gateway_last_healthcheck_at ? dateFa(settings.gateway_last_healthcheck_at) : 'تست نشده') +
              (settings.gateway_last_error ? ' <span class="error">• ' + esc(settings.gateway_last_error) + '</span>' : '') +
            '</div></div>' +
          '</div>' +
          '<div class="az-payment-danger-note"><strong>🔐 قانون طلایی</strong><span>شناسه پذیرنده فقط شناسه درگاه است؛ کلید API/Refund هرگز در مرورگر یا GitHub قرار نمی‌گیرد. هر تغییر تنظیمات، درگاه را تا تست موفق اتصال خاموش نگه می‌دارد.</span></div>' +
          '<div class="az-payment-actions">' +
            '<button class="btn ' + (enabled ? 'secondary' : '') + '" data-payment-toggle="' + (enabled ? '0' : '1') + '"' + ((!enabled && !ready) ? ' disabled title="تا اتصال درگاه واقعی، فعال‌سازی مجاز نیست."' : '') + '>' + (enabled ? '⛔ خاموش کردن پرداخت آنلاین' : '✅ فعال کردن پرداخت آنلاین') + '</button>' +
            '<button class="btn ghost" type="button" data-payment-refresh>↻ بروزرسانی وضعیت</button>' +
          '</div>' +
        '</div>' +
        '<div class="az-payment-panel">' +
          '<div class="az-payment-panel-head"><div><h3>نقشه امنیتی پرداخت</h3><p>محل ذخیره و رفتار هر جزء حساس.</p></div></div>' +
          '<div class="az-payment-security-list">' +
            '<div><b>Secretها</b><span>فقط Supabase Secrets</span><i>🔒</i></div>' +
            '<div><b>تأیید مبلغ</b><span>سمت سرور و تراکنش</span><i>✓</i></div>' +
            '<div><b>تأیید موفقیت</b><span>فقط verify درگاه</span><i>✓</i></div>' +
            '<div><b>Refund</b><span>درخواست → تأیید provider</span><i>✓</i></div>' +
            '<div><b>مغایرت</b><span>review_required و اعلان مدیر</span><i>⚠</i></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="az-payment-panel">' +
        '<div class="az-payment-panel-head"><div><h3>آخرین تراکنش‌ها</h3><p>فقط اطلاعات لازم برای پیگیری نمایش داده می‌شود؛ reference کامل ماسک شده است.</p></div>' +
        '<div><select class="input" data-payment-status-filter><option value="all"' + (activeFilter === 'all' ? ' selected' : '') + '>همه وضعیت‌ها</option><option value="initiated"' + (activeFilter === 'initiated' ? ' selected' : '') + '>ایجاد تراکنش</option><option value="pending"' + (activeFilter === 'pending' ? ' selected' : '') + '>در انتظار</option><option value="paid"' + (activeFilter === 'paid' ? ' selected' : '') + '>پرداخت شده</option><option value="failed"' + (activeFilter === 'failed' ? ' selected' : '') + '>ناموفق</option><option value="cancelled"' + (activeFilter === 'cancelled' ? ' selected' : '') + '>لغو شده</option><option value="review_required"' + (activeFilter === 'review_required' ? ' selected' : '') + '>نیازمند بررسی</option><option value="partially_refunded"' + (activeFilter === 'partially_refunded' ? ' selected' : '') + '>عودت بخشی</option><option value="refunded"' + (activeFilter === 'refunded' ? ' selected' : '') + '>عودت کامل</option></select></div></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>سفارش</th><th>مبلغ</th><th>وضعیت</th><th>Reference</th><th>زمان</th><th>عملیات</th></tr></thead><tbody>' + txRows + '</tbody></table></div>' +
      '</div>' +
      '<div class="az-payment-panel">' +
        '<div class="az-payment-panel-head"><div><h3>درخواست‌های بازگشت وجه</h3><p>ثبت درخواست به معنی انتقال پول نیست؛ اجرای نهایی فقط بعد از تأیید provider انجام می‌شود.</p></div></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>سفارش</th><th>مبلغ</th><th>وضعیت</th><th>دلیل</th><th>زمان</th></tr></thead><tbody>' + refundRows + '</tbody></table></div>' +
      '</div>' +
      '<div class="az-payment-panel">' +
        '<div class="az-payment-panel-head"><div><h3>لاگ مغایرت‌ها و بررسی‌های مالی</h3><p>این موارد خودکار paid/refunded نمی‌شوند و باید نتیجه درگاه تعیین تکلیف شود.</p></div></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>سفارش</th><th>مبلغ</th><th>وضعیت</th><th>کد خطا</th><th>توضیح</th><th>زمان</th></tr></thead><tbody>' + reviewRows + '</tbody></table></div>' +
      '</div>' +
    '</div>';
  }

  async function loadPaymentAdmin() {
    const el = $('paymentAdminPanel');
    if (!el) return;
    if (!canView('payment')) {
      el.innerHTML = '<div class="empty">این بخش فقط برای مالک و مدیر ارشد قابل دسترسی است.</div>';
      return;
    }
    if (!(await ensurePaymentMFA())) {
      el.innerHTML = '<div class="az-payment-lock"><strong>🔐 دسترسی پرداخت قفل است</strong><span>برای مشاهده/مدیریت اطلاعات درگاه، نشست باید با MFA به سطح AAL2 رسیده باشد.</span></div>';
      return;
    }
    el.innerHTML = '<div class="az-skeleton"></div>';
    const r = await state.db.rpc('azim_admin_payment_dashboard');
    if (r.error) {
      el.innerHTML = '<div class="az-payment-lock"><strong>خطا در بارگذاری مرکز پرداخت</strong><span>' + esc(errorText(r.error)) + '</span></div>';
      return;
    }
    state.paymentAdmin = r.data || {};
    el.innerHTML = paymentAdminHtml(state.paymentAdmin);
    el.querySelector('[data-payment-refresh]')?.addEventListener('click', () => loadPaymentAdmin());

    el.querySelector('[data-payment-configure]')?.addEventListener('click', async () => {
      if (!(await ensurePaymentMFA())) return;
      const provider = String(el.querySelector('[data-payment-provider]')?.value || '').trim().toLowerCase();
      const merchantId = String(el.querySelector('[data-payment-merchant-id]')?.value || '').trim();
      const sandbox = String(el.querySelector('[data-payment-sandbox]')?.value || 'false') === 'true';
      if (!provider) return toast('__AZICON_ERROR__ شناسه provider را وارد کنید.');
      if (!merchantId) return toast('__AZICON_ERROR__ شناسه پذیرنده/ترمینال را وارد کنید.');
      const reason = window.prompt('دلیل تغییر تنظیمات درگاه را وارد کنید:', 'تنظیم/به‌روزرسانی اتصال درگاه');
      if (reason === null) return;
      const r = await state.db.rpc('azim_admin_configure_payment_gateway', {
        p_provider: provider, p_merchant_id: merchantId, p_sandbox: sandbox, p_reason: String(reason).trim()
      });
      if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
      toast('__AZICON_SUCCESS__ تنظیمات ذخیره شد؛ اکنون اتصال را تست کنید.');
      await loadPaymentAdmin();
    });

    el.querySelector('[data-payment-healthcheck]')?.addEventListener('click', () => runPaymentHealthcheck());
    el.querySelector('[data-payment-status-filter]')?.addEventListener('change', (e) => {
      state.paymentStatusFilter = String(e.target.value || 'all');
      el.innerHTML = paymentAdminHtml(state.paymentAdmin);
      loadPaymentAdmin();
    });

    el.querySelector('[data-payment-toggle]')?.addEventListener('click', () => {
      const next = el.querySelector('[data-payment-toggle]').dataset.paymentToggle === '1';
      openPaymentToggleConfirm(next);
    });
    el.querySelectorAll('[data-payment-refund]').forEach((btn) => {
      const tx = (state.paymentAdmin.recent_transactions || []).find(x => x.id === btn.dataset.paymentRefund);
      if (tx) btn.addEventListener('click', () => openPaymentRefundForm(tx));
    });
  }

  function openPaymentToggleConfirm(next) {
    const action = next ? 'فعال‌سازی' : 'خاموش کردن';
    const warning = next
      ? 'فعال‌سازی پرداخت آنلاین یعنی مشتریان می‌توانند وارد جریان پرداخت شوند. فقط وقتی ادامه بده که provider و readiness را قبلاً بررسی کرده‌ای.'
      : 'خاموش کردن پرداخت آنلاین، شروع پرداخت‌های جدید را متوقف می‌کند؛ تراکنش‌های قبلی حذف یا تغییر نمی‌کنند.';
    openModal('تأیید ' + action + ' پرداخت آنلاین',
      '<form id="paymentToggleForm" class="az-payment-confirm-form">' +
      '<div class="az-payment-confirm-danger"><strong>⚠️ عملیات حساس مالی</strong><span>' + esc(warning) + '</span></div>' +
      '<div class="field"><label>دلیل ثبت عملیات *</label><textarea class="textarea" name="reason" minlength="3" maxlength="500" required placeholder="مثلاً: فعال‌سازی پس از تأیید موفق اتصال درگاه"></textarea></div>' +
      '<label class="check"><input type="checkbox" name="confirm" required> این تغییر را آگاهانه و با اطلاع از اثر آن تأیید می‌کنم.</label>' +
      '<div class="mfa-status" id="paymentToggleStatus"></div>' +
      '<div class="mfa-actions"><button class="btn" type="submit">' + esc(action) + '</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div>' +
      '</form>'
    );
    $('paymentToggleForm').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const status = $('paymentToggleStatus');
      if (!(await ensurePaymentMFA())) { status.textContent='__AZICON_LOCK__ تأیید MFA لازم است.'; return; }
      status.textContent='در حال ثبت امن تغییر…';
      const r = await state.db.rpc('azim_admin_set_online_payment_enabled', {
        p_enabled: !!next,
        p_reason: form.elements.reason.value.trim()
      });
      if (r.error) {
        status.className='mfa-status error';
        status.textContent='__AZICON_ERROR__ ' + errorText(r.error);
        return;
      }
      closeModal();
      toast(next ? '__AZICON_SUCCESS__ پرداخت آنلاین فعال شد.' : '__AZICON_SUCCESS__ پرداخت آنلاین خاموش شد.');
      await loadPaymentAdmin();
    };
  }

  function openPaymentRefundForm(tx) {
    if (!(state.paymentAdmin?.settings?.gateway_ready && state.paymentAdmin?.settings?.provider)) {
      return toast('__AZICON_BLOCK__ بازگشت وجه تا اتصال درگاه واقعی در دسترس نیست.');
    }
    const max = Number(tx.remaining_refundable || 0);
    openModal('درخواست بازگشت وجه امن',
      '<form id="paymentRefundForm" class="grid2">' +
      '<div class="az-payment-confirm-danger field full"><strong>⚠️ این مرحله پول را منتقل نمی‌کند</strong><span>فقط یک درخواست عودت ثبت می‌شود؛ اجرای واقعی باید با تأیید provider انجام شود.</span></div>' +
      '<div class="field"><label>سفارش</label><input class="input" value="' + esc(tx.order_code || '—') + '" disabled></div>' +
      '<div class="field"><label>مانده قابل عودت</label><input class="input" value="' + esc(paymentMoney(max, tx.amount_unit)) + '" disabled></div>' +
      '<div class="field"><label>مبلغ عودت *</label><input class="input" name="amount" type="number" min="1" max="' + esc(max) + '" step="1" value="' + esc(max) + '" required></div>' +
      '<div class="field full"><label>دلیل *</label><textarea class="textarea" name="reason" minlength="3" maxlength="500" required></textarea></div>' +
      '<label class="check field full"><input type="checkbox" name="confirm" required> مبلغ و سفارش را دوباره بررسی کردم و ثبت درخواست را تأیید می‌کنم.</label>' +
      '<div class="mfa-status field full" id="paymentRefundStatus"></div>' +
      '<div class="field full"><div class="mfa-actions"><button class="btn" type="submit">ثبت درخواست عودت</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div></div>' +
      '</form>'
    );
    $('paymentRefundForm').onsubmit = async (e) => {
      e.preventDefault();
      const form=e.target, status=$('paymentRefundStatus');
      if (!(await ensurePaymentMFA())) { status.textContent='__AZICON_LOCK__ تأیید MFA لازم است.'; return; }
      const amount=Math.floor(Number(form.elements.amount.value));
      if (!Number.isSafeInteger(amount) || amount<=0 || amount>max) {
        status.className='mfa-status error'; status.textContent='__AZICON_ERROR__ مبلغ عودت نامعتبر است.'; return;
      }
      status.className='mfa-status'; status.textContent='در حال ثبت درخواست…';
      const r=await state.db.rpc('azim_admin_request_online_refund',{
        p_transaction_id:tx.id,p_amount:amount,p_reason:form.elements.reason.value.trim()
      });
      if(r.error){status.className='mfa-status error';status.textContent='__AZICON_ERROR__ '+errorText(r.error);return;}
      closeModal();
      try {
        const executed = await paymentEdgeAction('refund', { refund_id: r.data?.refund_id });
        if (executed?.status === 'refunded') {
          toast('__AZICON_SUCCESS__ بازگشت وجه توسط درگاه تأیید شد.');
        } else {
          toast('__AZICON_WARNING__ درخواست عودت ثبت شد؛ وضعیت نهایی درگاه هنوز قطعی نیست.');
        }
      } catch (executeError) {
        toast('__AZICON_WARNING__ درخواست عودت ثبت شد، اما اجرای خودکار درگاه انجام نشد: ' + errorText(executeError));
      }
      await loadPaymentAdmin();
    };
  }

  function renderProductTable(rows, compact) {
    if (!rows.length) return '<div class="empty">محصولی پیدا نشد.</div>';
    const body = rows.map((p) => {
      const siteButton = !compact && p.code
        ? '<button class="btn ghost" data-open-product-site="' + esc(p.code) + '">مشاهده سایت</button>'
        : '';
      const couponButton = (!compact && can.all())
        ? '<button class="btn ghost" data-new-discount-product="' + p.id + '">🏷️ کد تخفیف</button> '
        : '';
      const actions = compact ? '' :
        '<td>' + (can.edit() ? '<button class="btn secondary" data-edit-product="' + p.id + '">ویرایش</button> ' +
        '<button class="btn ghost" data-toggle-product="' + p.id + '">' + (p.is_active ? 'غیرفعال' : 'فعال') + '</button> ' : 'فقط مشاهده') +
        couponButton + siteButton + '</td>';
      return '<tr><td>' + (p.img ? '<img class="thumb" src="' + esc(p.img) + '" alt="">' : '—') + '</td>' +
        '<td>' + esc(p.name) + '</td><td>' + esc(p.code || '—') + '</td><td>' + esc(p.brand || '—') + '</td>' +
        '<td>' + (isDirectProductDiscountLive(p) && Number(p.price) > 0
        ? '<del style="opacity:.5;margin-left:5px;">' + money(p.price) + '</del> ' + money(directProductDiscountPrice(p.price, p)) + ' <small style="color:#e7d78d;">تخفیف مستقیم</small>'
        : money(p.price)) + '</td>' +
        '<td>' + (p.stock_tracking_enabled ? '<span class="badge ok">' + Number(p.stock_quantity || 0).toLocaleString('fa-IR') + ' عدد</span>' : '<span class="muted">پیش‌فرض ۱</span>') + '</td>' +
        '<td><span class="badge ' + (p.is_active ? 'ok' : 'red') + '">' +
        (p.is_active ? 'فعال' : 'غیرفعال') + '</span></td>' + actions + '</tr>';
    }).join('');
    return '<table class="table"><thead><tr><th>تصویر</th><th>محصول</th><th>کد</th><th>برند</th><th>قیمت</th><th>موجودی</th><th>وضعیت</th>' +
      (compact ? '' : '<th>عملیات</th>') + '</tr></thead><tbody>' + body.replace(/<tr>/g, '<tr>') + '</tbody></table>';
  }

  function renderInquiryTable(rows, compact) {
    if (!rows.length) return '<div class="empty">درخواستی ثبت نشده است.</div>';
    if (compact) {
      return '<div class="az-dashboard-inquiry-list">' + rows.map((x) =>
        '<article class="az-dashboard-inquiry-card">' +
          '<div class="az-dashboard-inquiry-head">' +
            '<div><strong>' + esc(x.full_name || 'بدون نام') + '</strong><small>' + dateFa(x.created_at) + '</small></div>' +
            '<span class="badge warn">' + esc(labels[x.status] || x.status || '—') + '</span>' +
          '</div>' +
          '<div class="az-dashboard-inquiry-grid">' +
            '<div><span>موبایل</span><b dir="ltr">' + esc(x.mobile || '—') + '</b></div>' +
            '<div><span>موضوع</span><b>' + esc(x.subject || '—') + '</b></div>' +
          '</div>' +
        '</article>'
      ).join('') + '</div>';
    }
    const body = rows.map((x) =>
      '<tr><td>' + esc(x.full_name) + '</td><td dir="ltr">' + esc(x.mobile) + '</td><td>' +
      esc(x.subject || '—') + '</td><td><span class="badge warn">' + esc(labels[x.status] || x.status) +
      '</span></td><td>' + dateFa(x.created_at) + '</td>' +
      '<td><button class="btn secondary" data-edit-inquiry="' + x.id + '">مدیریت</button></td>' +
      '</tr>'
    ).join('');
    return '<table class="table"><thead><tr><th>نام</th><th>موبایل</th><th>موضوع</th><th>وضعیت</th><th>زمان</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  let productSearchTimer = null;

  function ensureReviewsStyles() {
    if ($('az-reviews-admin-style')) return;
    const style = document.createElement('style');
    style.id = 'az-reviews-admin-style';
    style.textContent = '.az-reviews-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}.az-reviews-summary>div{padding:11px 12px;border:1px solid rgba(245,185,0,.12);border-radius:11px;background:rgba(255,255,255,.025);display:flex;justify-content:space-between;gap:8px}.az-reviews-summary span{color:#8b958e;font-size:10px}.az-reviews-summary b{color:#ffd84f;font-size:15px}.az-review-pending{border-color:rgba(245,185,0,.25)!important}.az-review-actions{display:flex;gap:5px;flex-wrap:wrap}@media(max-width:700px){.az-reviews-summary{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  async function loadReviews() {
    ensureReviewsStyles();
    const box = $('reviewsTable');
    if (!box) return;
    const r = await state.db.from('product_reviews')
      .select('id,product_id,author_name,rating,comment,approved,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (r.error) return showSectionError('reviewsTable', r.error);

    const rows = r.data || [];
    const productIds = [...new Set(rows.map(x => x.product_id).filter(Boolean))];
    let products = [];
    if (productIds.length) {
      const p = await state.db.from('products').select('id,code,name,img').in('id', productIds);
      if (!p.error) products = p.data || [];
    }
    const productMap = new Map(products.map(p => [String(p.id), p]));
    const pending = rows.filter(x => !x.approved).length;
    const approved = rows.filter(x => x.approved).length;

    if (!rows.length) {
      box.innerHTML = '<div class="empty">هنوز نظری ثبت نشده است.</div>';
      return;
    }

    box.innerHTML =
      '<div class="az-reviews-summary">' +
        '<div class="az-review-pending"><span>در انتظار تأیید</span><b>' + pending.toLocaleString('fa-IR') + '</b></div>' +
        '<div><span>تأییدشده</span><b>' + approved.toLocaleString('fa-IR') + '</b></div>' +
        '<div><span>کل نظرات</span><b>' + rows.length.toLocaleString('fa-IR') + '</b></div>' +
      '</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>محصول</th><th>نام</th><th>امتیاز</th><th>نظر</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' +
      rows.map(rv => {
        const p = productMap.get(String(rv.product_id));
        const status = rv.approved ? '<span class="badge ok">تأییدشده</span>' : '<span class="badge warn">در انتظار</span>';
        const action = rv.approved
          ? '<button class="btn ghost" data-review-unapprove="' + esc(rv.id) + '">برگرداندن</button>'
          : '<button class="btn" data-review-approve="' + esc(rv.id) + '">تأیید</button>';
        return '<tr>' +
          '<td><strong>' + esc(p?.name || 'محصول') + '</strong><div class="muted">' + esc(p?.code || '') + '</div></td>' +
          '<td><strong>' + esc(rv.author_name || 'مشتری') + '</strong><div class="muted">' + dateFa(rv.created_at,false) + '</div></td>' +
          '<td style="white-space:nowrap;color:#f5c24b">' + '★'.repeat(Math.max(1,Math.min(5,Number(rv.rating)||1))) + '</td>' +
          '<td style="min-width:240px;max-width:420px;white-space:pre-wrap;line-height:1.9">' + esc(rv.comment || '') + '</td>' +
          '<td>' + status + '</td>' +
          '<td><div class="az-review-actions">' + action + '<button class="btn ghost" data-review-delete="' + esc(rv.id) + '">حذف</button></div></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  async function moderateReview(id, approved) {
    if (!can.all()) return toast('__AZICON_BLOCK__ فقط مالک یا مدیر می‌تواند نظر را تأیید یا برگرداند.');
    const r = await state.db.from('product_reviews')
      .update({ approved: Boolean(approved), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit(approved ? 'approve' : 'unapprove', 'product_reviews', id, { approved: Boolean(approved) });
    await loadReviews();
    toast(approved ? '__AZICON_SUCCESS__ نظر تأیید شد و روی همان محصول نمایش داده می‌شود.' : 'نظر دوباره در انتظار تأیید قرار گرفت.');
  }

  async function deleteReview(id) {
    if (!can.all()) return toast('__AZICON_BLOCK__ فقط مالک یا مدیر می‌تواند نظر را حذف کند.');
    if (!confirm('این نظر حذف شود؟')) return;
    const r = await state.db.from('product_reviews').delete().eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('delete', 'product_reviews', id);
    await loadReviews();
    toast('__AZICON_SUCCESS__ نظر حذف شد');
  }

  async function loadProducts() {
    await ensureCaches();
    let q = state.db.from('products')
      .select('id,name,brand,cat,code,badge,description,img,original_price,price,page,category_name,is_active,stock_quantity,stock_tracking_enabled,variants,discount_type,discount_value,discount_is_active,discount_starts_at,discount_ends_at,updated_at,created_at')
      .order('code', { ascending: true }).order('updated_at', { ascending: false }).limit(1000);
    const search = $('productSearch').value.trim();
    const status = $('productStatus').value;
    const category = $('productCategoryFilter')?.value || '';
    if (status) q = q.eq('is_active', status === 'true');
    if (category) q = q.eq('category_name', category);
    if (search) {
      const s = search.replace(/[%(),]/g, ' ');
      q = q.or('name.ilike.%' + s + '%,brand.ilike.%' + s + '%,code.ilike.%' + s + '%,category_name.ilike.%' + s + '%');
    }
    const r = await q;
    if (r.error) return showSectionError('productsTable', r.error);
    let rows = r.data || [];
    const variantFilter = $('productVariantFilter')?.value || '';
    if (variantFilter === 'with') rows = rows.filter(p => Array.isArray(p.variants) && p.variants.length > 0);
    if (variantFilter === 'without') rows = rows.filter(p => !Array.isArray(p.variants) || !p.variants.length);
    state.products = rows;
    // The catalog view may be filtered; never let an order form reuse a stale product cache.
    state.productCacheLoaded = false;

    const variantCount = rows.filter(p => Array.isArray(p.variants) && p.variants.length > 0).length;
    if ($('productMetaCount')) $('productMetaCount').textContent = rows.length.toLocaleString('fa-IR') + ' محصول در نتیجه';
    if ($('productMetaVariant')) $('productMetaVariant').textContent = variantCount.toLocaleString('fa-IR') + ' محصول سایزبندی‌دار';

    $('productsTable').innerHTML =
      (can.edit() ? '<div class="az-product-tools"><div class="az-tool-badge"><span class="az-dot"></span> مدیریت زنده</div><button class="btn secondary" id="quickEditProducts">__AZICON_EDIT__ ویرایش سریع</button><button class="btn ghost" id="openSiteFromProducts">__AZICON_GLOBE__ مشاهده سایت</button><button class="btn ghost" id="exportStoreBackup">__AZICON_SAVE__ بکاپ</button></div>' : '') +
      renderProductTable(state.products, false);
    wireProductBulk();
  }

  async function ensureCaches() {
    if (!state.categories.length) await fetchCategoriesCache();
    if (!state.brands.length) await fetchBrandsCache();
    const categoryFilter = $('productCategoryFilter');
    if (categoryFilter) {
      const current = categoryFilter.value;
      categoryFilter.innerHTML = '<option value="">همه دسته‌ها</option>' + state.categories.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('');
      categoryFilter.value = current;
    }
  }

  async function fetchCategoriesCache() {
    const r = await state.db.from('categories').select('*').order('sort_order').order('name');
    if (!r.error) state.categories = r.data || [];
    return r;
  }

  async function fetchBrandsCache() {
    const r = await state.db.from('brands').select('*').order('sort_order').order('name');
    if (!r.error) state.brands = r.data || [];
    return r;
  }

  function variantRows(variants) {
    const rows = Array.isArray(variants) ? variants : [];
    if (!rows.length) return '<div class="az-variant-empty">این محصول فعلاً سایزبندی ندارد. برای افزودن، «＋ افزودن سایز» را بزن.</div>';
    return rows.map((v, i) => {
      const size = v && (v.size ?? v.label ?? v.name ?? '') || '';
      const price = v && v.price != null ? v.price : '';
      return '<div class="az-variant-row" data-variant-row>' +
        '<input class="input" data-variant-size placeholder="سایز / مشخصه" value="' + esc(size) + '">' +
        '<input class="input" data-variant-price inputmode="numeric" placeholder="قیمت این سایز" value="' + esc(price) + '">' +
        '<button type="button" class="btn ghost" data-remove-variant>حذف</button>' +
        '</div>';
    }).join('');
  }

  function productVariantsEditor(variants) {
    return '<div class="az-simple-section az-simple-variants">' +
      '<div class="az-simple-section-head"><strong>سایزها و مشخصات</strong><button type="button" class="btn secondary" id="addVariantBtn">＋ افزودن</button></div>' +
      '<div class="az-simple-variants-list" id="variantRows">' + variantRows(variants) + '</div>' +
      '<textarea name="variantsAdvanced" hidden>' + esc(variants ? JSON.stringify(variants, null, 2) : '') + '</textarea>' +
      '<textarea name="variants" hidden></textarea>' +
    '</div>';
  }

  function syncVariantPayload(form) {
    if (!form) return [];
    const rows = Array.from(form.querySelectorAll('[data-variant-row]'));
    const variants = rows.map((row) => {
      const size = String(row.querySelector('[data-variant-size]')?.value || '').trim();
      const rawPrice = String(row.querySelector('[data-variant-price]')?.value || '').trim();
      if (!size) return null;
      const price = rawPrice === '' ? null : Number(rawPrice);
      const invalid = rawPrice !== '' && (!Number.isFinite(price) || price < 0);
      row.dataset.invalidVariantPrice = invalid ? '1' : '';
      return { size, price: invalid || rawPrice === '' ? null : Math.floor(price) };
    }).filter(Boolean);
    const json = JSON.stringify(variants);
    if (form.elements.variants) form.elements.variants.value = json;
    if (form.elements.variantsAdvanced) form.elements.variantsAdvanced.value = JSON.stringify(variants, null, 2);
    return variants;
  }

  function validateVariantInputs(form) {
    const rows = Array.from(form?.querySelectorAll('[data-variant-row]') || []);
    for (const row of rows) {
      const size = String(row.querySelector('[data-variant-size]')?.value || '').trim();
      const rawPrice = String(row.querySelector('[data-variant-price]')?.value || '').trim();
      if (!size) continue;
      const numeric = Number(rawPrice);
      if (rawPrice !== '' && (!Number.isFinite(numeric) || numeric < 0)) {
        row.dataset.invalidVariantPrice = '1';
        throw new Error('قیمت یکی از سایزها نامعتبر است.');
      }
      row.dataset.invalidVariantPrice = '';
    }
  }

  function initVariantEditor(form) {
    if (!form) return;
    const list = form.querySelector('#variantRows');
    const add = form.querySelector('#addVariantBtn');
    if (!list || !add) return;

    const renderEmpty = () => {
      list.innerHTML = '<div class="az-variant-empty">این محصول فعلاً سایزبندی ندارد. برای افزودن، «＋ افزودن سایز» را بزن.</div>';
    };

    const bind = () => {
      list.querySelectorAll('[data-variant-row]').forEach((row) => {
        row.querySelectorAll('[data-variant-size],[data-variant-price]').forEach((input) => {
          input.oninput = () => syncVariantPayload(form);
        });
      });
    };

    add.onclick = () => {
      const empty = list.querySelector('.az-variant-empty');
      if (empty) list.innerHTML = '';
      list.insertAdjacentHTML('beforeend',
        '<div class="az-variant-row" data-variant-row>' +
          '<input class="input" data-variant-size placeholder="سایز / مشخصه">' +
          '<input class="input" data-variant-price inputmode="numeric" placeholder="قیمت این سایز">' +
          '<button type="button" class="btn ghost" data-remove-variant>حذف</button>' +
        '</div>'
      );
      bind();
      syncVariantPayload(form);
      list.querySelector('[data-variant-row]:last-of-type [data-variant-size]')?.focus();
    };

    list.onclick = (e) => {
      const remove = e.target.closest('[data-remove-variant]');
      if (!remove) return;
      remove.closest('[data-variant-row]')?.remove();
      if (!list.querySelector('[data-variant-row]')) renderEmpty();
      bind();
      syncVariantPayload(form);
    };

    bind();
    syncVariantPayload(form);
    form.addEventListener('submit', () => syncVariantPayload(form), true);
  }

  function initProductImageEditor(form) {
    if (!form) return;
    const input = form.elements.file;
    const clear = form.elements.clearImage;
    const imageBox = form.querySelector('.az-simple-image');
    if (!input || !imageBox) return;

    const setPreview = (src, alt) => {
      let img = imageBox.querySelector('#productImagePreview');
      if (!img) {
        imageBox.innerHTML = '<img id="productImagePreview" alt="">';
        img = imageBox.querySelector('#productImagePreview');
      }
      img.src = src;
      img.alt = alt || form.elements.name?.value || 'محصول';
      img.style.display = 'block';
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) {
        input.value = '';
        toast('__AZICON_ERROR__ فایل انتخاب‌شده تصویر نیست.');
        return;
      }
      const oldUrl = form.dataset.azPreviewUrl;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const url = URL.createObjectURL(file);
      form.dataset.azPreviewUrl = url;
      setPreview(url, form.elements.name?.value || 'محصول');
      if (clear) clear.checked = false;
    };

    clear?.addEventListener('change', () => {
      const img = imageBox.querySelector('#productImagePreview');
      if (!img) return;
      img.style.opacity = clear.checked ? '0.28' : '1';
    });

    form.elements.name?.addEventListener('input', () => {
      const img = imageBox.querySelector('#productImagePreview');
      if (img) img.alt = form.elements.name.value || 'محصول';
    });
  }

  function productForm(p) {
    const isEdit = !!p;
    const categoryOptions = state.categories.map((cat) =>
      '<option value="' + esc(cat.name) + '" ' + (cat.name === (p?.category_name || p?.cat || '') ? 'selected' : '') + '>' + esc(cat.name) + '</option>'
    ).join('');
    const currentBrand = p?.brand || '';
    const image = p?.img || '';
    return '<form id="productForm" class="az-simple-editor">' +
      '<div class="az-simple-editor-top">' +
        '<div><span>' + (isEdit ? 'ویرایش محصول' : 'محصول جدید') + '</span><h2>' + esc(p?.name || (isEdit ? 'محصول' : 'افزودن محصول')) + '</h2></div>' +
        '<label class="az-simple-active"><input name="is_active" type="checkbox" ' + (p?.is_active === false ? '' : 'checked') + '><span>فعال در سایت</span></label>' +
      '</div>' +
      '<div class="az-simple-editor-body">' +
        '<div class="az-simple-image-row">' +
          '<div class="az-simple-image">' +
            (image ? '<img id="productImagePreview" src="' + esc(image) + '" alt="' + esc(p?.name || 'محصول') + '">' : '<div class="az-simple-image-empty">بدون تصویر</div>') +
          '</div>' +
          '<div class="az-simple-image-info"><strong>تصویر محصول</strong><small>برای عوض کردن عکس، فایل جدید را انتخاب کن.</small>' +
            '<label class="az-simple-file">انتخاب تصویر<input name="file" type="file" accept="image/*"></label>' +
            (image ? '<label class="az-simple-clear"><input name="clearImage" type="checkbox"> حذف تصویر</label>' : '') +
          '</div>' +
        '</div>' +
        '<div class="az-simple-section">' +
          '<div class="az-simple-section-head"><strong>اطلاعات محصول</strong></div>' +
          '<div class="az-simple-fields">' +
            '<label class="az-simple-field az-simple-wide"><span>نام محصول *</span><input class="input" name="name" required value="' + esc(p?.name) + '" placeholder="نام محصول"></label>' +
            '<label class="az-simple-field"><span>برند</span><input class="input" name="brand" list="productBrandSuggestions" value="' + esc(currentBrand) + '" placeholder="برند"><datalist id="productBrandSuggestions">' + state.brands.map((brand) => '<option value="' + esc(brand.name) + '"></option>').join('') + '</datalist></label>' +
            '<label class="az-simple-field"><span>دسته‌بندی</span><select class="select" name="category_name"><option value="">بدون دسته</option>' + categoryOptions + '</select></label>' +
            '<label class="az-simple-field"><span>کد / SKU</span><input class="input" name="code" value="' + esc(p?.code) + '" placeholder="کد محصول" dir="ltr" ' + (isEdit ? 'readonly title="شناسه محصول برای حفظ اتصال تصویر و کاتالوگ در محصول موجود قابل تغییر نیست."' : '') + '></label>' +
            '<label class="az-simple-field"><span>برچسب</span><input class="input" name="badge" value="' + esc(p?.badge) + '" placeholder="مثلاً جدید"></label>' +
          '</div>' +
        '</div>' +
        '<div class="az-simple-section">' +
          '<div class="az-simple-section-head"><strong>قیمت</strong></div>' +
          '<div class="az-simple-price-row">' +
            '<label class="az-simple-field"><span>قیمت اصلی</span><div class="az-simple-price"><input class="input" name="original_price" inputmode="numeric" value="' + esc(p?.original_price ?? '') + '" placeholder="0"><b>تومان</b></div></label>' +
            '<label class="az-simple-field"><span>قیمت فعلی</span><div class="az-simple-price primary"><input class="input" name="price" inputmode="numeric" value="' + esc(p?.price ?? '') + '" placeholder="0"><b>تومان</b></div></label>' +
          '</div>' +
          '<div class="az-simple-fields" style="margin-top:10px">' +
            '<label class="az-simple-field"><span>موجودی</span><input class="input" name="stock_quantity" type="number" min="0" step="1" value="' + esc(p?.stock_quantity ?? (p ? 0 : 1)) + '" placeholder="0"></label>' +
            '<label class="az-simple-active" style="align-self:end"><input name="stock_tracking_enabled" type="checkbox" ' + (p ? (p.stock_tracking_enabled ? 'checked' : '') : 'checked') + '><span>کنترل موجودی فعال باشد</span></label>' +
          '</div>' +
        '</div>' +
        '<div class="az-simple-section az-product-direct-discount">' +
          '<div class="az-simple-section-head"><strong>تخفیف مستقیم این محصول</strong><label class="az-discount-toggle"><input name="discount_is_active" type="checkbox" ' + (p?.discount_is_active ? 'checked' : '') + '><span>فعال</span></label></div>' +
          '<div class="az-simple-fields az-discount-fields">' +
            '<label class="az-simple-field"><span>نوع تخفیف</span><select class="select" name="discount_type"><option value="percentage" ' + (p?.discount_type !== 'fixed' ? 'selected' : '') + '>درصدی</option><option value="fixed" ' + (p?.discount_type === 'fixed' ? 'selected' : '') + '>مبلغ ثابت</option></select></label>' +
            '<label class="az-simple-field"><span>مقدار تخفیف</span><input class="input" name="discount_value" type="number" min="1" step="1" value="' + esc(p?.discount_value ?? '') + '" placeholder="مثلاً 15"></label>' +
            '<label class="az-simple-field"><span>شروع</span><input class="input" name="discount_starts_at" type="datetime-local" value="' + esc(localDateTimeValue(p?.discount_starts_at)) + '"></label>' +
            '<label class="az-simple-field"><span>پایان</span><input class="input" name="discount_ends_at" type="datetime-local" value="' + esc(localDateTimeValue(p?.discount_ends_at)) + '"></label>' +
          '</div>' +
          '<div id="productDiscountPreview" class="az-product-discount-preview"></div>' +
          (isEdit && can.all() ? '<div class="az-product-coupon-cta"><div><strong>کد تخفیف این محصول</strong><small>این کد به‌عنوان کوپن سفارش استفاده می‌شود؛ تخفیف مستقیم قیمت محصول از آن جداست.</small></div><button type="button" class="btn secondary" id="openProductCouponBtn">🏷️ ساخت کد برای این محصول</button></div>' : '') +
        '</div>' +
        productVariantsEditor(p?.variants) +
        '<div class="az-simple-section">' +
          '<div class="az-simple-section-head"><strong>توضیحات</strong></div>' +
          '<textarea class="textarea az-simple-description" name="description" placeholder="توضیحات محصول">' + esc(p?.description || '') + '</textarea>' +
        '</div>' +
      '</div>' +
      '<div class="az-simple-editor-footer">' +
        '<span id="productStatus" class="status">تغییرات با ذخیره ثبت می‌شوند.</span>' +
        '<div>' +
          (isEdit && can.edit() ? '<button type="button" class="btn az-simple-delete" id="deleteProductBtn">حذف</button>' : '') +
          '<button type="button" class="btn secondary" onclick="closeModal()">لغو</button>' +
          '<button class="btn" type="submit">ذخیره تغییرات</button>' +
        '</div>' +
      '</div>' +
    '</form>';
  }

  function updateProductDiscountPreview(form) {
    const out = $('productDiscountPreview');
    if (!out || !form) return;
    const base = Number(form.elements.price?.value || form.elements.original_price?.value || 0);
    const active = !!form.elements.discount_is_active?.checked;
    const type = form.elements.discount_type?.value || 'percentage';
    const value = Number(form.elements.discount_value?.value || 0);
    if (!active || !base || !value) {
      out.textContent = 'تخفیف مستقیم خاموش است؛ قیمت فعلی بدون تغییر نمایش داده می‌شود.';
      out.className = 'az-product-discount-preview muted';
      return;
    }
    const safe = type === 'percentage' ? Math.min(100, Math.max(1, value)) : Math.max(0, value);
    const discounted = type === 'percentage' ? Math.floor(base * (100 - safe) / 100) : Math.max(0, base - safe);
    out.innerHTML = 'نمونه: <b>' + money(base) + '</b> ← <strong>' + money(discounted) + '</strong>';
    out.className = 'az-product-discount-preview active';
  }

  async function editProduct(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه ویرایش محصول ندارد.');
    await ensureCaches();
    const p = state.products.find((x) => x.id === id);
    if (!p) return toast('محصول پیدا نشد.');
    openModal('ویرایش محصول', productForm(p));
    $('productForm').onsubmit = (e) => saveProduct(e, id);
    initVariantEditor($('productForm'), p.variants);
    initProductImageEditor($('productForm'));
    const discountForm = $('productForm');
    ['price','original_price','discount_value','discount_type','discount_is_active'].forEach(name => discountForm?.elements?.[name]?.addEventListener('input', () => updateProductDiscountPreview(discountForm)));
    ['discount_type','discount_is_active'].forEach(name => discountForm?.elements?.[name]?.addEventListener('change', () => updateProductDiscountPreview(discountForm)));
    updateProductDiscountPreview(discountForm);
    $('openProductCouponBtn')?.addEventListener('click', () => openDiscountEditor(null, null, true, id));
    const del = $('deleteProductBtn');
    if (del) del.onclick = () => deleteProduct(id);
  }

  async function newProduct() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه افزودن محصول ندارد.');
    await ensureCaches();
    openModal('افزودن محصول', productForm(null));
    $('productForm').onsubmit = (e) => saveProduct(e, null);
    initVariantEditor($('productForm'), null);
    initProductImageEditor($('productForm'));
    const discountForm = $('productForm');
    ['price','original_price','discount_value','discount_type','discount_is_active'].forEach(name => discountForm?.elements?.[name]?.addEventListener('input', () => updateProductDiscountPreview(discountForm)));
    ['discount_type','discount_is_active'].forEach(name => discountForm?.elements?.[name]?.addEventListener('change', () => updateProductDiscountPreview(discountForm)));
    updateProductDiscountPreview(discountForm);
  }

  async function saveProduct(e, id) {
    e.preventDefault();
    if (!can.edit()) return;
    const s = e.target.elements;
    try {
      validateVariantInputs(e.target);
      let img = id ? (state.products.find((x) => x.id === id)?.img || null) : null;
      let uploadedPath = null;
      if (s.clearImage?.checked) img = null;
      const file = s.file?.files?.[0];
      if (file && !String(file.type || '').startsWith('image/')) throw new Error('فایل محصول باید تصویر باشد.');
      if (file && file.size > 10 * 1024 * 1024) throw new Error('حجم تصویر محصول نباید بیشتر از ۱۰ مگابایت باشد.');
      if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = 'products/' + crypto.randomUUID() + '.' + ext;
        uploadedPath = path;
        const up = await state.db.storage.from('product-images').upload(path, file, {
          upsert: false, contentType: file.type || 'image/jpeg'
        });
        if (up.error) throw up.error;
        img = state.db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      }
      let variants = null;
      const variantText = s.variants?.value?.trim() || '';
      const advancedVariantText = s.variantsAdvanced?.value?.trim() || '';
      if (variantText) variants = JSON.parse(variantText);
      else if (advancedVariantText) variants = JSON.parse(advancedVariantText);
      const category = s.category_name.value || '';
      const existingProduct = id ? state.products.find((x) => x.id === id) : null;
      const nextCode = s.code.value.trim() || null;
      if (existingProduct?.code && nextCode !== existingProduct.code) {
        throw new Error('شناسه / کد محصول موجود برای حفظ اتصال تصویر و کاتالوگ قابل تغییر نیست.');
      }
      const discountActive = !!s.discount_is_active?.checked;
      const discountType = s.discount_type?.value || null;
      const discountValue = s.discount_value?.value === '' ? null : Number(s.discount_value.value);
      const discountStarts = s.discount_starts_at?.value ? new Date(s.discount_starts_at.value).toISOString() : null;
      const discountEnds = s.discount_ends_at?.value ? new Date(s.discount_ends_at.value).toISOString() : null;
      if (discountActive && (!discountValue || !Number.isFinite(discountValue) || discountValue < 1)) throw new Error('مقدار تخفیف الزامی است.');
      if (discountActive && discountType === 'percentage' && discountValue > 100) throw new Error('درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.');
      if (discountStarts && discountEnds && new Date(discountEnds) <= new Date(discountStarts)) throw new Error('پایان تخفیف باید بعد از شروع باشد.');
      const originalPrice = s.original_price.value === '' ? null : Number(s.original_price.value);
      const currentPrice = s.price.value === '' ? null : Number(s.price.value);
      const stockQuantity = s.stock_quantity?.value === '' ? 0 : Number(s.stock_quantity?.value);
      if (originalPrice != null && (!Number.isFinite(originalPrice) || originalPrice < 0)) throw new Error('قیمت اصلی نامعتبر است.');
      if (currentPrice != null && (!Number.isFinite(currentPrice) || currentPrice < 0)) throw new Error('قیمت فعلی نامعتبر است.');
      if (!Number.isInteger(stockQuantity) || stockQuantity < 0) throw new Error('موجودی باید یک عدد صحیح صفر یا بیشتر باشد.');

      const p = {
        name: s.name.value.trim(),
        brand: s.brand.value.trim() || 'بدون برند',
        category_name: category || null,
        cat: category,
        code: nextCode,
        badge: s.badge.value.trim() || null,
        description: s.description.value.trim() || s.name.value.trim(),
        original_price: originalPrice,
        price: currentPrice,
        img,
        is_active: s.is_active.checked,
        stock_quantity: stockQuantity,
        stock_tracking_enabled: !!s.stock_tracking_enabled?.checked,
        discount_type: discountType,
        discount_value: Number.isFinite(discountValue) ? discountValue : null,
        discount_is_active: discountActive,
        discount_starts_at: discountStarts,
        discount_ends_at: discountEnds,
        variants
      };
      if (!p.name) throw new Error('نام محصول الزامی است.');
      const r = id ? await state.db.from('products').update(p).eq('id', id) : await state.db.from('products').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'products', id || 'new', { name: p.name, code: p.code });
      closeModal();
      toast('__AZICON_SUCCESS__ محصول ذخیره شد');
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (err) {
      if (uploadedPath) {
        try { await state.db.storage.from('product-images').remove([uploadedPath]); } catch (_) {}
      }
      $('productStatus').textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  async function deleteProduct(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه حذف محصول ندارد.');
    if (!confirm('این محصول حذف شود؟')) return;
    const r = await state.db.from('products').delete().eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('delete', 'products', id);
    closeModal();
    toast('__AZICON_SUCCESS__ محصول حذف شد');
    await Promise.all([loadProducts(), loadDashboard()]);
  }

  async function exportStoreBackup() {
    if (!state.user) return;
    try {
      const [content, categories, brands] = await Promise.all([
        state.db.from('site_content').select('section_key,title,payload,is_active,updated_at'),
        state.db.from('categories').select('*').order('sort_order').order('name'),
        state.db.from('brands').select('*').order('sort_order').order('name')
      ]);
      if (content.error) throw content.error;
      if (categories.error) throw categories.error;
      if (brands.error) throw brands.error;
      const allProducts = await state.db.from('products')
        .select('id,name,brand,cat,code,badge,description,img,original_price,price,page,category_name,is_active,stock_quantity,stock_tracking_enabled,variants,discount_type,discount_value,discount_is_active,discount_starts_at,discount_ends_at,updated_at,created_at')
        .order('code', { ascending: true })
        .limit(2000);
      if (allProducts.error) throw allProducts.error;
      const backup = {
        exported_at: new Date().toISOString(),
        version: 'azim-abzar-admin-backup-v2',
        products: allProducts.data || [],
        categories: categories.data || [],
        brands: brands.data || [],
        site_content: content.data || []
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = 'azim-abzar-backup-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await audit('export', 'store_backup', stamp, { products: backup.products.length, site_content: backup.site_content.length });
      toast('__AZICON_SUCCESS__ فایل پشتیبان آماده شد');
    } catch (err) {
      toast('__AZICON_ERROR__ ' + errorText(err));
    }
  }

  function wireProductBulk() {
    $('quickEditProducts')?.addEventListener('click', () => openQuickProductEditor());
    $('openSiteFromProducts')?.addEventListener('click', () => window.open(new URL('./products-v4.html', window.location.href).href, '_blank', 'noopener'));
    $('exportStoreBackup')?.addEventListener('click', () => exportStoreBackup());
    document.querySelectorAll('[data-open-product-site]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-open-product-site') || '';
        const url = new URL('./products-v4.html', window.location.href);
        if (code) url.searchParams.set('q', code);
        window.open(url.href, '_blank', 'noopener');
      });
    });
  }

  function openQuickProductEditor() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه ویرایش محصول ندارد.');
    const rows = state.products || [];
    if (!rows.length) return toast('محصولی برای ویرایش وجود ندارد.');

    const items = rows.map((p) =>
      '<div class="az-quick-product" data-quick-product="' + esc(p.id) + '">' +
        '<div class="az-quick-product-info"><strong>' + esc(p.name) + '</strong><small>' + esc(p.code || 'بدون کد') + '</small></div>' +
        '<input class="input" data-q-name value="' + esc(p.name) + '" aria-label="نام محصول">' +
        '<input class="input" data-q-brand value="' + esc(p.brand || '') + '" placeholder="برند را خودت بنویس" aria-label="برند">' +
        '<input class="input" data-q-price inputmode="numeric" value="' + esc(p.price ?? '') + '" placeholder="قیمت" aria-label="قیمت">' +
        '<label class="az-quick-active"><input data-q-active type="checkbox" ' + (p.is_active ? 'checked' : '') + '> فعال</label>' +
      '</div>'
    ).join('');

    openModal('ویرایش سریع محصولات (' + rows.length.toLocaleString('fa-IR') + ' مورد)', 
      '<div class="az-quick-editor">' +
        '<div class="az-quick-head"><span>فیلدها را تغییر بده و در پایان همه را یکجا ذخیره کن.</span><button type="button" class="btn ghost" id="quickSiteBtn">__AZICON_GLOBE__ سایت</button></div>' +
        '<div class="az-quick-list">' + items + '</div>' +
        '<div class="az-quick-actions"><button type="button" class="btn" id="saveQuickProducts">ذخیره تغییرات همه</button><span id="quickProductStatus" class="status"></span></div>' +
      '</div>'
    );

    $('quickSiteBtn')?.addEventListener('click', () => window.open(new URL('./products-v4.html', window.location.href).href, '_blank', 'noopener'));
    $('saveQuickProducts')?.addEventListener('click', saveQuickProducts);
  }

  async function saveQuickProducts() {
    if (!can.edit()) return;
    const rows = Array.from(document.querySelectorAll('[data-quick-product]'));
    const status = $('quickProductStatus');
    const button = $('saveQuickProducts');
    if (!rows.length) return;

    button.disabled = true;
    status.textContent = 'در حال ذخیره…';
    try {
      for (const row of rows) {
        const id = row.dataset.quickProduct;
        const original = state.products.find((p) => String(p.id) === String(id));
        if (!original) continue;
        const name = row.querySelector('[data-q-name]').value.trim();
        const brand = row.querySelector('[data-q-brand]').value.trim() || 'بدون برند';
        const priceValue = row.querySelector('[data-q-price]').value.trim();
        const active = row.querySelector('[data-q-active]').checked;
        if (!name) throw new Error('نام محصول نمی‌تواند خالی باشد.');
        const price = priceValue === '' ? null : Number(priceValue);
        if (priceValue !== '' && !Number.isFinite(price)) throw new Error('قیمت نامعتبر برای «' + name + '».');

        const patch = {
          name,
          brand,
          price,
          is_active: active
        };
        const r = await state.db.from('products').update(patch).eq('id', id);
        if (r.error) throw r.error;
        await audit('quick_update', 'products', id, patch);
      }
      closeModal();
      toast('__AZICON_SUCCESS__ ' + rows.length.toLocaleString('fa-IR') + ' محصول بروزرسانی شد');
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (err) {
      status.textContent = '__AZICON_ERROR__ ' + errorText(err);
      button.disabled = false;
    }
  }

  async function toggleProduct(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه تغییر وضعیت محصول ندارد.');
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    const r = await state.db.from('products').update({ is_active: !p.is_active }).eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('toggle', 'products', id, { is_active: !p.is_active });
    await Promise.all([loadProducts(), loadDashboard()]);
  }

  async function loadCategories() {
    const r = await fetchCategoriesCache();
    if (r.error) return showSectionError('categoriesTable', r.error);
    const rows = await Promise.all(state.categories.map(async (cat) => {
      const n = await countTable('products', (q) => q.eq('category_name', cat.name));
      const active = await countTable('products', (q) => q.eq('category_name', cat.name).eq('is_active', true));
      return { ...cat, productCount: n, activeCount: active };
    }));
    const total = rows.reduce((s, x) => s + x.productCount, 0);
    const activeTotal = rows.reduce((s, x) => s + x.activeCount, 0);
    const body = rows.map((c) =>
      '<article class="az-category-card">' +
        '<div class="az-cat-top"><div><span class="az-cat-index">CAT · ' + String(c.sort_order + 1).padStart(2,'0') + '</span><h3>' + esc(c.name) + '</h3><div class="az-cat-meta">' + esc(c.slug) + '</div></div>' +
        '<div class="az-cat-count">' + c.productCount.toLocaleString('fa-IR') + '</div></div>' +
        '<div class="az-cat-stats"><span>فعال <b>' + c.activeCount.toLocaleString('fa-IR') + '</b></span><span>کل <b>' + c.productCount.toLocaleString('fa-IR') + '</b></span></div>' +
        '<div class="az-category-progress"><i style="width:' + (c.productCount ? Math.min(100, (c.activeCount / c.productCount) * 100) : 0) + '%"></i></div>' +
        '<div class="az-cat-actions">' +
          (can.edit() ? '<button class="btn secondary" data-edit-category="' + c.id + '">ویرایش</button><button class="btn ghost" data-toggle-category="' + c.id + '">' + (c.is_active ? 'غیرفعال کردن' : 'فعال کردن') + '</button>' : '<span class="badge">فقط مشاهده</span>') +
          '<button class="btn ghost" data-filter-category="' + esc(c.name) + '">مشاهده محصولات ←</button>' +
        '</div>' +
      '</article>'
    ).join('');
    const summary = '<div class="az-category-overview">' +
      '<div><span>دسته‌های واقعی کاتالوگ</span><strong>' + rows.length.toLocaleString('fa-IR') + '</strong></div>' +
      '<div><span>محصولات دسته‌بندی‌شده</span><strong>' + total.toLocaleString('fa-IR') + '</strong></div>' +
      '<div><span>محصولات فعال</span><strong>' + activeTotal.toLocaleString('fa-IR') + '</strong></div>' +
      '<button class="btn secondary" data-filter-category="">همه ۹۰۸ محصول ←</button>' +
    '</div>';
    $('categoriesTable').innerHTML = rows.length ? summary + '<div class="az-category-grid">' + body + '</div>' : '<div class="empty">دسته‌ای ثبت نشده.</div>';
  }


  function categoryForm(c) {
    return '<form id="categoryForm" class="grid2">' +
      '<div class="field"><label>نام *</label><input class="input" name="name" required value="' + esc(c?.name) + '"></div>' +
      '<div class="field"><label>Slug *</label><input class="input" name="slug" required value="' + esc(c?.slug) + '"></div>' +
      '<div class="field"><label>ترتیب</label><input class="input" name="sort_order" type="number" value="' + esc(c?.sort_order ?? 0) + '"></div>' +
      '<label class="check field"><input name="is_active" type="checkbox" ' + (c?.is_active === false ? '' : 'checked') + '> فعال</label>' +
      '<div class="field full"><label>تصویر دسته</label><input class="input" name="image_file" type="file" accept="image/*"></div>' +
      '<div class="field full"><label>توضیحات</label><textarea class="textarea" name="description">' + esc(c?.description) + '</textarea></div>' +
      '<div class="field full"><button class="btn">ذخیره دسته</button></div><div id="categoryStatus" class="status field full"></div></form>';
  }

  async function toggleCategory(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی تغییر وضعیت دسته وجود ندارد.');
    const c = state.categories.find((x) => x.id === id);
    if (!c) return;
    const r = await state.db.from('categories').update({ is_active: !c.is_active }).eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('toggle', 'categories', id, { is_active: !c.is_active });
    await loadCategories();
  }

  function editCategory(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی ویرایش دسته وجود ندارد.');
    const c = state.categories.find((x) => x.id === id);
    openModal('ویرایش دسته', categoryForm(c));
    $('categoryForm').onsubmit = (e) => saveCategory(e, id);
  }

  function newCategory() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی افزودن دسته وجود ندارد.');
    openModal('دسته جدید', categoryForm(null));
    $('categoryForm').onsubmit = (e) => saveCategory(e, null);
  }

  async function saveCategory(e, id) {
    e.preventDefault();
    try {
      const s = e.target.elements;
      let image = id ? (state.categories.find((x) => x.id === id)?.image || null) : null;
      let uploadedPath = null;
      const file = s.image_file?.files?.[0];
      if (file && !String(file.type || '').startsWith('image/')) throw new Error('فایل تصویر دسته معتبر نیست.');
      if (file && file.size > 10 * 1024 * 1024) throw new Error('حجم تصویر دسته نباید بیشتر از ۱۰ مگابایت باشد.');
      if (file) {
        const path = 'categories/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        uploadedPath = path;
        const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
        if (up.error) throw up.error;
        image = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
      }
      const p = {
        name: s.name.value.trim(), slug: s.slug.value.trim(), sort_order: Number(s.sort_order.value || 0),
        description: s.description.value.trim() || null, image, is_active: s.is_active.checked
      };
      const r = await state.db.rpc('azim_save_category', {
        p_id: id || null,
        p_name: p.name,
        p_slug: p.slug,
        p_description: p.description,
        p_image: p.image,
        p_sort_order: p.sort_order,
        p_is_active: p.is_active
      });
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'categories', r.data?.id || id || 'new', {
        name: p.name,
        updated_products: Number(r.data?.updated_products || 0)
      });
      closeModal();
      toast('__AZICON_SUCCESS__ دسته ذخیره شد');
      await loadCategories();
    } catch (err) {
      if (uploadedPath) { try { await state.db.storage.from('admin-media').remove([uploadedPath]); } catch (_) {} }
      $('categoryStatus').textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  async function loadBrands() {
    const r = await fetchBrandsCache();
    if (r.error) return showSectionError('brandsTable', r.error);
    const rows = await Promise.all(state.brands.map(async (b) => {
      const n = await countTable('products', (q) => q.eq('brand', b.name));
      return { ...b, productCount: n };
    }));
    const body = rows.map((b) =>
      '<tr><td>' + esc(b.name) + '</td><td>' + esc(b.slug) + '</td><td>' + b.productCount.toLocaleString('fa-IR') +
      '</td><td>' + b.sort_order + '</td><td><span class="badge ' + (b.is_active ? 'ok' : 'red') + '">' +
      (b.is_active ? 'فعال' : 'غیرفعال') + '</span></td><td>' +
      (can.edit() ? '<button class="btn secondary" data-edit-brand="' + b.id + '">ویرایش</button> <button class="btn ghost" data-toggle-brand="' + b.id + '">' + (b.is_active ? 'غیرفعال' : 'فعال') + '</button>' : '') +
      '</td></tr>'
    ).join('');
    $('brandsTable').innerHTML = rows.length ?
      '<table class="table"><thead><tr><th>نام</th><th>Slug</th><th>محصول</th><th>ترتیب</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table>' :
      '<div class="empty">برندی ثبت نشده.</div>';
  }

  function brandForm(b) {
    return '<form id="brandForm" class="grid2">' +
      '<div class="field"><label>نام *</label><input class="input" name="name" required value="' + esc(b?.name) + '"></div>' +
      '<div class="field"><label>Slug *</label><input class="input" name="slug" required value="' + esc(b?.slug) + '"></div>' +
      '<div class="field"><label>ترتیب</label><input class="input" name="sort_order" type="number" value="' + esc(b?.sort_order ?? 0) + '"></div>' +
      '<label class="check field"><input name="is_active" type="checkbox" ' + (b?.is_active === false ? '' : 'checked') + '> فعال</label>' +
      '<div class="field full"><label>لوگو</label><input class="input" name="logo_file" type="file" accept="image/*"></div>' +
      '<div class="field full"><label>توضیحات</label><textarea class="textarea" name="description">' + esc(b?.description) + '</textarea></div>' +
      '<div class="field full"><button class="btn">ذخیره برند</button></div><div id="brandStatus" class="status field full"></div></form>';
  }

  async function toggleBrand(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی تغییر وضعیت برند وجود ندارد.');
    const b = state.brands.find((x) => x.id === id);
    if (!b) return;
    const r = await state.db.from('brands').update({ is_active: !b.is_active }).eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('toggle', 'brands', id, { is_active: !b.is_active });
    await loadBrands();
  }

  function editBrand(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی ویرایش برند وجود ندارد.');
    const b = state.brands.find((x) => x.id === id);
    openModal('ویرایش برند', brandForm(b));
    $('brandForm').onsubmit = (e) => saveBrand(e, id);
  }

  function newBrand() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی افزودن برند وجود ندارد.');
    openModal('برند جدید', brandForm(null));
    $('brandForm').onsubmit = (e) => saveBrand(e, null);
  }

  async function saveBrand(e, id) {
    e.preventDefault();
    try {
      const s = e.target.elements;
      let logo = id ? (state.brands.find((x) => x.id === id)?.logo || null) : null;
      let uploadedPath = null;
      const file = s.logo_file?.files?.[0];
      if (file && !String(file.type || '').startsWith('image/')) throw new Error('فایل لوگوی برند معتبر نیست.');
      if (file && file.size > 10 * 1024 * 1024) throw new Error('حجم لوگوی برند نباید بیشتر از ۱۰ مگابایت باشد.');
      if (file) {
        const path = 'brands/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        uploadedPath = path;
        const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
        if (up.error) throw up.error;
        logo = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
      }
      const p = {
        name: s.name.value.trim(), slug: s.slug.value.trim(), sort_order: Number(s.sort_order.value || 0),
        description: s.description.value.trim() || null, logo, is_active: s.is_active.checked
      };
      const r = await state.db.rpc('azim_save_brand', {
        p_id: id || null,
        p_name: p.name,
        p_slug: p.slug,
        p_description: p.description,
        p_logo: p.logo,
        p_sort_order: p.sort_order,
        p_is_active: p.is_active
      });
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'brands', r.data?.id || id || 'new', {
        name: p.name,
        updated_products: Number(r.data?.updated_products || 0)
      });
      closeModal();
      toast('__AZICON_SUCCESS__ برند ذخیره شد');
      await loadBrands();
    } catch (err) {
      if (uploadedPath) { try { await state.db.storage.from('admin-media').remove([uploadedPath]); } catch (_) {} }
      $('brandStatus').textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  async function loadInquiries() {
    const f = $('inquiryFilter').value;
    let q = state.db.from('inquiries').select('*').order('created_at', { ascending: false }).limit(200);
    if (f) q = q.eq('status', f);
    const r = await q;
    if (r.error) return showSectionError('inquiriesTable', r.error);
    $('inquiriesTable').innerHTML = renderInquiryTable(r.data || [], false);
  }

  async function editInquiry(id) {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی به درخواست‌ها ندارد.');
    const r = await state.db.from('inquiries').select('*').eq('id', id).single();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    const x = r.data;
    const options = ['new','in_progress','quoted','answered','closed','spam'].map((v) =>
      '<option value="' + v + '" ' + (x.status === v ? 'selected' : '') + '>' + labels[v] + '</option>'
    ).join('');
    const priorities = ['low','normal','high','urgent'].map((v) =>
      '<option value="' + v + '" ' + (x.priority === v ? 'selected' : '') + '>' + v + '</option>'
    ).join('');
    openModal('مدیریت درخواست',
      '<div class="grid2">' +
      '<div><b>نام:</b> ' + esc(x.full_name) + '</div><div><b>موبایل:</b> <span dir="ltr">' + esc(x.mobile) + '</span></div>' +
      '<div><b>موضوع:</b> ' + esc(x.subject || '—') + '</div><div><b>کسب‌وکار:</b> ' + esc(x.business || '—') + '</div>' +
      '<div class="field full"><label>شرح درخواست</label><textarea class="textarea" readonly>' + esc(x.details) + '</textarea></div>' +
      '<div class="field"><label>وضعیت</label><select id="inqStatus" class="select">' + options + '</select></div>' +
      '<div class="field"><label>اولویت</label><select id="inqPriority" class="select">' + priorities + '</select></div>' +
      '<div class="field full"><label>یادداشت داخلی</label><textarea id="inqNotes" class="textarea">' + esc(x.admin_notes || '') + '</textarea></div>' +
      '<div class="field full"><button id="saveInquiryBtn" class="btn">ذخیره تغییرات</button></div></div>'
    );
    $('saveInquiryBtn').onclick = () => saveInquiry(x.id);
  }

  async function saveInquiry(id) {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما اجازه مدیریت درخواست‌های مشتری را ندارد.');
    const p = {
      status: $('inqStatus').value,
      priority: $('inqPriority').value,
      admin_notes: $('inqNotes').value.trim() || null,
      handled_by: state.user.id
    };
    const r = await state.db.from('inquiries').update(p).eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('update', 'inquiries', id, p);
    closeModal();
    toast('__AZICON_SUCCESS__ درخواست بروزرسانی شد');
    await Promise.all([loadInquiries(), loadDashboard()]);
  }

  async function loadCustomers() {
    const r = await state.db.from('customers').select('*').order('created_at', { ascending: false }).limit(200);
    if (r.error) return showSectionError('customersTable', r.error);
    if (!r.data?.length) {
      $('customersTable').innerHTML = '<div class="empty">هنوز مشتری‌ای ثبت نشده.</div>';
      return;
    }
    const body = r.data.map((x) =>
      '<tr><td>' + esc(x.full_name) + '</td><td dir="ltr">' + esc(x.mobile) + '</td><td>' + esc(x.email || '—') +
      '</td><td>' + esc(x.company || '—') + '</td><td>' + esc(x.city || '—') + '</td><td>' + dateFa(x.created_at, false) + '</td><td>' +
      (can.sales() ? '<button class="btn secondary" data-edit-customer="' + x.id + '">ویرایش</button>' : '') +
      (can.all() ? '<button class="btn ghost" data-new-discount-customer="' + x.id + '">🎁 تخفیف اختصاصی</button>' : '') +
      '</td></tr>'
    ).join('');
    $('customersTable').innerHTML =
      '<table class="table"><thead><tr><th>نام</th><th>موبایل</th><th>ایمیل</th><th>شرکت</th><th>شهر</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>' +
      body + '</tbody></table>';
  }

  function customerForm(x) {
    return '<form id="customerForm" class="grid2">' +
      '<div class="field"><label>نام *</label><input class="input" name="full_name" required value="' + esc(x?.full_name) + '"></div>' +
      '<div class="field"><label>موبایل *</label><input class="input" name="mobile" required value="' + esc(x?.mobile) + '"></div>' +
      '<div class="field"><label>ایمیل</label><input class="input" type="email" name="email" value="' + esc(x?.email) + '"></div>' +
      '<div class="field"><label>شرکت</label><input class="input" name="company" value="' + esc(x?.company) + '"></div>' +
      '<div class="field"><label>شهر</label><input class="input" name="city" value="' + esc(x?.city) + '"></div>' +
      '<div class="field full"><label>آدرس</label><textarea class="textarea" name="address">' + esc(x?.address) + '</textarea></div>' +
      '<div class="field full"><label>یادداشت</label><textarea class="textarea" name="notes">' + esc(x?.notes) + '</textarea></div>' +
      '<div class="field full"><button class="btn">ذخیره مشتری</button></div><div id="customerStatus" class="status field full"></div></form>';
  }

  async function editCustomer(id) {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی مشتریان ندارد.');
    const r = await state.db.from('customers').select('*').eq('id', id).single();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal('ویرایش مشتری', customerForm(r.data));
    $('customerForm').onsubmit = (e) => saveCustomer(e, id);
  }

  function newCustomer() {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما اجازه افزودن مشتری ندارد.');
    openModal('مشتری جدید', customerForm(null));
    $('customerForm').onsubmit = (e) => saveCustomer(e, null);
  }

  async function saveCustomer(e, id) {
    e.preventDefault();
    const s = e.target.elements;
    const p = {
      full_name: s.full_name.value.trim(), mobile: s.mobile.value.trim(),
      email: s.email.value.trim() || null, company: s.company.value.trim() || null,
      address: s.address.value.trim() || null, city: s.city.value.trim() || null, notes: s.notes.value.trim() || null
    };
    const r = id ? await state.db.from('customers').update(p).eq('id', id) : await state.db.from('customers').insert(p);
    if (r.error) { $('customerStatus').textContent = '__AZICON_ERROR__ ' + errorText(r.error); return; }
    await audit(id ? 'update' : 'create', 'customers', id || p.mobile, { full_name: p.full_name });
    closeModal();
    toast('__AZICON_SUCCESS__ مشتری ذخیره شد');
    await loadCustomers();
  }

  let ordersSearchTimer = null;
  let ordersPage = 1;
  let ordersPageSize = 25;
  let ordersLoadSeq = 0;

  function renderOrdersPagination(totalCount, page, pageCount, start, end) {
    if (!totalCount) return '';
    const pageItems = [];
    if (pageCount <= 7) {
      for (let i = 1; i <= pageCount; i++) pageItems.push(i);
    } else if (page <= 4) {
      pageItems.push(1, 2, 3, 4, 5, '…', pageCount);
    } else if (page >= pageCount - 3) {
      pageItems.push(1, '…', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount);
    } else {
      pageItems.push(1, '…', page - 1, page, page + 1, '…', pageCount);
    }
    const buttons = pageItems.map((item) => item === '…'
      ? '<span class="az-orders-page-ellipsis" aria-hidden="true">…</span>'
      : '<button type="button" class="az-orders-page-btn ' + (item === page ? 'active' : '') + '" data-order-page="' + item + '" aria-current="' + (item === page ? 'page' : 'false') + '">' + item.toLocaleString('fa-IR') + '</button>'
    ).join('');
    return '<div class="az-orders-pagination">' +
      '<div class="az-orders-page-summary">نمایش <b>' + start.toLocaleString('fa-IR') + '–' + end.toLocaleString('fa-IR') + '</b> از <b>' + totalCount.toLocaleString('fa-IR') + '</b> سفارش</div>' +
      '<div class="az-orders-page-buttons">' +
        '<button type="button" class="az-orders-page-btn az-orders-page-nav" data-order-page="' + (page > 1 ? page - 1 : page) + '" ' + (page > 1 ? '' : 'disabled') + '>‹ قبلی</button>' +
        buttons +
        '<button type="button" class="az-orders-page-btn az-orders-page-nav" data-order-page="' + (page < pageCount ? page + 1 : page) + '" ' + (page < pageCount ? '' : 'disabled') + '>بعدی ›</button>' +
      '</div>' +
    '</div>';
  }

  async function loadOrders() {
    const search = String($('ordersSearch')?.value || '').trim();
    const statusFilter = String($('ordersStatusFilter')?.value || '');
    const paymentFilter = String($('ordersPaymentFilter')?.value || '');
    const shippingFilter = String($('ordersShippingFilter')?.value || '');
    const periodFilter = Number($('ordersPeriodFilter')?.value || 0);
    const loadSeq = ++ordersLoadSeq;
    let q = state.db.from('orders')
      .select('id,order_code,customer_id,customer_name,customer_mobile,customer_email,status,payment_status,payment_method,payment_reference,paid_at,shipping_status,subtotal,discount,discount_id,discount_code,shipping_cost,total,tracking_code,tracking_url,shipping_carrier,notes,created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (search) {
      const s = search.replace(/[%(),]/g, ' ');
      q = q.or('order_code.ilike.%' + s + '%,customer_name.ilike.%' + s + '%,customer_mobile.ilike.%' + s + '%');
    }
    if (statusFilter) q = q.eq('status', statusFilter);
    if (paymentFilter) q = q.eq('payment_status', paymentFilter);
    if (shippingFilter) q = q.eq('shipping_status', shippingFilter);
    if (periodFilter) q = q.gte('created_at', new Date(Date.now() - periodFilter * 86400000).toISOString());
    const r = await q.range((ordersPage - 1) * ordersPageSize, (ordersPage * ordersPageSize) - 1);
    if (loadSeq !== ordersLoadSeq) return;
    if (r.error) return showSectionError('ordersTable', r.error);
    const rows = r.data || [];
    const totalCount = Number(r.count || 0);
    const pageCount = Math.max(1, Math.ceil(totalCount / ordersPageSize));
    if (ordersPage > pageCount) {
      ordersPage = pageCount;
      return loadOrders();
    }
    if (!rows.length) {
      $('ordersTable').innerHTML = '<div class="empty">هنوز سفارشی ثبت نشده؛ از «＋ سفارش جدید» استفاده کن.</div>';
      return;
    }

    // Fetch the saved order lines as the source of truth for what was actually ordered.
    const orderIds = rows.map(x => x.id).filter(Boolean);
    const itemsRes = orderIds.length
      ? await state.db.from('order_items')
          .select('id,order_id,product_id,product_name,sku,quantity,unit_price,line_total,variant')
          .in('order_id', orderIds)
          .order('id')
      : { data: [], error: null };

    if (loadSeq !== ordersLoadSeq) return;
    if (itemsRes.error) return showSectionError('ordersTable', itemsRes.error);

    const refundRes = orderIds.length
      ? await state.db.rpc('azim_admin_order_refund_summaries',{p_order_ids:orderIds})
      : {data:{},error:null};
    if (loadSeq !== ordersLoadSeq) return;
    if (refundRes.error) return showSectionError('ordersTable', refundRes.error);
    const refundByOrder = new Map(Object.entries(refundRes.data || {}));

    const itemsByOrder = new Map();
    (itemsRes.data || []).forEach((item) => {
      const key = String(item.order_id);
      const list = itemsByOrder.get(key) || [];
      list.push(item);
      itemsByOrder.set(key, list);
    });

    const totalValue = rows.reduce((sum, x) => sum + Number(x.total || 0), 0);
    const unpaidCount = rows.filter(x => x.payment_status !== 'paid').length;
    const pendingCount = rows.filter(x => ['pending','confirmed','processing'].includes(x.status)).length;

    const stat = (label, value, sub) =>
      '<div class="az-order-stat"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(sub) + '</small></div>';

    const statusTone = (value) => {
      if (value === 'paid' || value === 'delivered') return 'ok';
      if (value === 'cancelled' || value === 'refunded') return 'red';
      return 'warn';
    };

    const nextAction = (x, refundSummary) => {
      const plan = orderActionPlan(x, refundSummary);
      return [plan.label, plan.tone, plan.key];
    };
    const requestByOrder = new Map();
    if (can.all() && orderIds.length) {
      const [cancelReq, returnReq] = await Promise.all([
        state.db.from('order_action_requests')
          .select('id,order_id,status')
          .eq('request_type','cancel')
          .in('status',['pending','approved'])
          .in('order_id', orderIds)
          .limit(200),
        state.db.from('order_return_requests')
          .select('id,order_id,status')
          .in('status',['pending','approved','received'])
          .in('order_id', orderIds)
          .limit(200)
      ]);
      if (!cancelReq.error) (cancelReq.data || []).forEach(r => {
        const key = String(r.order_id);
        const entry = requestByOrder.get(key) || { cancel: 0, return: 0 };
        entry.cancel += 1;
        requestByOrder.set(key, entry);
      });
      if (!returnReq.error) (returnReq.data || []).forEach(r => {
        const key = String(r.order_id);
        const entry = requestByOrder.get(key) || { cancel: 0, return: 0 };
        entry.return += 1;
        requestByOrder.set(key, entry);
      });
    }

    const body = rows.map((x) => {
      const status = labels[x.status] || x.status || '—';
      const payment = labels[x.payment_status] || x.payment_status || '—';
      const shipping = labels[x.shipping_status] || x.shipping_status || '—';
      const refundSummary = refundByOrder.get(String(x.id)) || {status:'none',label:'عودت وجه ندارد'};
      const [actionText, actionTone, actionKey] = nextAction(x, refundSummary);
      const actionPlan = orderActionPlan(x, refundSummary);
      const discount = Number(x.discount || 0);
      const orderItems = itemsByOrder.get(String(x.id)) || [];
      const requestSummary = requestByOrder.get(String(x.id));
      const requestHtml = requestSummary
        ? '<div class="az-order-request-flags">' +
            (requestSummary.cancel ? '<span class="az-order-request cancel">لغو در انتظار بررسی · ' + requestSummary.cancel.toLocaleString('fa-IR') + '</span>' : '') +
            (requestSummary.return ? '<span class="az-order-request return">مرجوعی در انتظار بررسی · ' + requestSummary.return.toLocaleString('fa-IR') + '</span>' : '') +
          '</div>'
        : '';
      const customerName = x.customer_name || 'مشتری ثبت‌نشده';
      const customerMobile = x.customer_mobile || '—';
      const customerEmail = x.customer_email || '—';
      const productsHtml = orderItems.length
        ? '<div class="az-order-products"><span class="az-order-products-title">محصولات سفارش</span>' +
            orderItems.slice(0, 3).map((it) => {
              const variant = it?.variant && typeof it.variant === 'object'
                ? (it.variant.label || it.variant.size || it.variant.name || '')
                : String(it?.variant || '');
              return '<div class="az-order-product-row">' +
                '<div><b>' + esc(it.product_name || 'محصول') + '</b>' +
                '<small>' + esc(it.sku || '—') + (variant ? ' · ' + esc(variant) : '') + '</small></div>' +
                '<strong>×' + esc(Number(it.quantity || 0).toLocaleString('fa-IR')) + '</strong>' +
                '</div>';
            }).join('') +
            (orderItems.length > 3 ? '<small class="az-order-products-more">+' + Number(orderItems.length - 3).toLocaleString('fa-IR') + ' قلم دیگر در کنترل سفارش</small>' : '') +
          '</div>'
        : '<div class="az-order-products az-order-products-empty">محصولات این سفارش در دسترس نیست.</div>';

      return '<article class="az-order-card az-order-card-clickable" data-order-card="' + esc(x.id) + '" tabindex="0" aria-label="مشاهده سفارش ' + esc(x.order_code || '') + '">' +
        '<div class="az-order-card-head">' +
          '<div class="az-order-code"><span>سفارش</span><strong dir="ltr">' + esc(x.order_code || '—') + '</strong><small>' + dateFa(x.created_at) + '</small></div>' +
          '<div class="az-order-statuses">' +
            '<span class="az-order-pill ' + statusTone(x.status) + '">' + esc(status) + '</span>' +
            '<span class="az-order-pill ' + statusTone(x.payment_status) + '">' + esc(payment) + '</span>' +
            '<span class="az-order-pill ' + statusTone(x.shipping_status) + '">' + esc(shipping) + '</span>' +
            (refundSummary.status !== 'none' ? '<span class="az-order-pill ' + (['refunded','partially_refunded'].includes(refundSummary.status) ? 'ok' : (['failed','review_required'].includes(refundSummary.status) ? 'red' : 'warn')) + '">💰 ' + esc(refundSummary.label || refundSummary.status) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="az-order-card-body">' +
          '<div class="az-order-customer">' +
            '<div><span>مشتری</span><b>' + esc(customerName) + '</b></div>' +
            '<div><span>موبایل</span><b dir="ltr">' + esc(customerMobile) + '</b></div>' +
          '</div>' +
          requestHtml +
          '<div class="az-order-card-flow">' + orderTimeline(x.status, x.shipping_status) + '</div>' +
          '<div class="az-order-total"><span>مبلغ نهایی</span><strong>' + money(x.total) + '</strong>' + (discount ? '<small>پس از ' + money(discount) + ' تخفیف</small>' : '<small>بدون تخفیف</small>') + '</div>' +
          '<div class="az-order-next-action"><span>اقدام بعدی</span><b class="' + actionTone + '">' + esc(actionText) + '</b></div>' +
          productsHtml +
          '<div class="az-order-meta">' +
            '<div><span>قبل تخفیف</span><b>' + money(x.subtotal) + '</b></div>' +
            '<div><span>هزینه ارسال</span><b>' + (Number(x.shipping_cost || 0) ? money(x.shipping_cost) : 'هماهنگی با واحد فروش') + '</b></div>' +
            '<div><span>کد تخفیف</span><b dir="ltr">' + esc(x.discount_code || '—') + '</b></div>' +
            '<div><span>رهگیری</span><b dir="ltr">' + esc(x.tracking_code || '—') + '</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="az-order-card-foot">' +
          '<span class="az-order-foot-note">' + (x.customer_id ? 'پرونده مشتری متصل است' : 'بدون پرونده مشتری') + '</span>' +
          '<div class="tools" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' +
          (can.sales() && !['done','open'].includes(actionPlan.kind) && (actionPlan.kind !== 'restore' || can.all()) ? '<button class="btn ' + (actionTone === 'red' ? 'ghost' : (actionTone === 'ok' ? 'secondary' : '')) + ' az-order-quick-action" data-order-control-action="' + esc(actionKey) + '" data-order-id="' + esc(x.id) + '" data-order-code="' + esc(x.order_code || '') + '" title="' + esc(actionText) + '">' + esc(actionText) + ' <span>←</span></button>' : '') +
          '<span class="az-order-card-open-hint">برای کنترل سفارش و جزئیات ← کلیک کنید</span>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    const rangeStart = ((ordersPage - 1) * ordersPageSize) + 1;
    const rangeEnd = Math.min(ordersPage * ordersPageSize, totalCount);
    const paginationHtml = renderOrdersPagination(totalCount, ordersPage, pageCount, rangeStart, rangeEnd);

    $('ordersTable').innerHTML =
      '<div class="az-order-overview">' +
        stat('کل سفارش‌ها', totalCount.toLocaleString('fa-IR'), 'مطابق فیلترهای فعلی') +
        stat('در حال پیگیری', pendingCount.toLocaleString('fa-IR'), 'در همین صفحه') +
        stat('نیازمند پرداخت', unpaidCount.toLocaleString('fa-IR'), 'در همین صفحه') +
        stat('ارزش سفارش‌ها', money(totalValue), 'مجموع همین صفحه') +
      '</div>' +
      paginationHtml +
      '<div class="az-orders-list">' + body + '</div>' +
      paginationHtml;
  }


  function serviceRequestActionLabel(kind, action) {
    const labels = {
      cancel: { approve: '✅ تأیید لغو', reject: '❌ رد درخواست' },
      return: { approve: '✅ تأیید مرجوعی', reject: '❌ رد', received: '📦 کالا دریافت شد', refund: '💰 ثبت عودت وجه' }
    };
    return labels[kind]?.[action] || action;
  }

  function serviceRequestButtons(kind, row) {
    if (kind === 'cancel' && row.status === 'pending') {
      return '<button class="btn" type="button" data-service-action data-kind="cancel" data-action="approve" data-id="' + esc(row.id) + '">✅ تأیید لغو</button>' +
        '<button class="btn secondary" type="button" data-service-action data-kind="cancel" data-action="reject" data-id="' + esc(row.id) + '">❌ رد درخواست</button>';
    }
    if (kind === 'cancel' && row.status === 'approved' && row.refund_status === 'pending' && row.payment_method !== 'online') {
      return '<button class="btn" type="button" data-service-action data-kind="cancel" data-action="refund" data-id="' + esc(row.id) + '">💰 ثبت عودت وجه دستی</button>';
    }
    if (kind === 'return' && row.status === 'pending') {
      return '<button class="btn" type="button" data-service-action data-kind="return" data-action="approve" data-id="' + esc(row.id) + '">✅ تأیید مرجوعی</button>' +
        '<button class="btn secondary" type="button" data-service-action data-kind="return" data-action="reject" data-id="' + esc(row.id) + '">❌ رد</button>';
    }
    if (kind === 'return' && row.status === 'approved') {
      return '<button class="btn" type="button" data-service-action data-kind="return" data-action="received" data-id="' + esc(row.id) + '">📦 کالا دریافت شد</button>';
    }
    if (kind === 'return' && row.status === 'received' && row.refund_status === 'pending') {
      return '<button class="btn" type="button" data-service-action data-kind="return" data-action="refund" data-id="' + esc(row.id) + '">' + (row.payment_method === 'online' ? '💳 درخواست عودت از درگاه' : '💰 ثبت عودت وجه دستی') + '</button>';
    }
    return '';
  }

  async function loadServiceRequests() {
    const panel = $('adminServiceRequestsPanel');
    const box = $('serviceRequestsTable');
    if (!panel || !box) return;
    const wasOpen = !panel.hidden;
    if (!can.all()) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      const launcher = $('serviceRequestsLauncher');
      if (launcher) launcher.hidden = true;
      return;
    }
    // The request center is an on-demand overlay; never push it below a long order list.
    if (!wasOpen) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    }
    const launcher = $('serviceRequestsLauncher');
    if (launcher) launcher.hidden = false;
    const launcherCount = $('serviceRequestsCount');
    const launcherText = $('serviceRequestsLauncherText');
    if (launcherCount) launcherCount.textContent = '…';
    if (launcherText) launcherText.textContent = 'در حال بررسی درخواست‌های باز…';
    box.innerHTML = '<div class="empty">در حال دریافت درخواست‌ها…</div>';

    try {
      const [cancelRes, returnRes] = await Promise.all([
        state.db.from('order_action_requests')
          .select('id,order_id,reason,status,refund_status,customer_mobile,created_at,updated_at')
          .eq('request_type','cancel')
          .in('status',['pending','approved'])
          .order('created_at',{ascending:false})
          .limit(100),
        state.db.from('order_return_requests')
          .select('id,order_id,order_item_id,quantity,reason,details,status,refund_status,refund_amount,customer_mobile,created_at,updated_at')
          .in('status',['pending','approved','received'])
          .order('created_at',{ascending:false})
          .limit(100)
      ]);
      if (cancelRes.error) throw cancelRes.error;
      if (returnRes.error) throw returnRes.error;

      const cancels = cancelRes.data || [];
      const returns = returnRes.data || [];
      const orderIds = [...new Set([...cancels.map(x=>x.order_id), ...returns.map(x=>x.order_id)].filter(Boolean))];
      const itemIds = [...new Set(returns.map(x=>x.order_item_id).filter(Boolean))];

      const [ordersRes, itemsRes] = await Promise.all([
        orderIds.length
          ? state.db.from('orders').select('id,order_code,status,payment_status,payment_method,shipping_status,total,customer_name,customer_mobile').in('id',orderIds)
          : Promise.resolve({data:[],error:null}),
        itemIds.length
          ? state.db.from('order_items').select('id,order_id,product_name,sku,quantity,unit_price,line_total,variant').in('id',itemIds)
          : Promise.resolve({data:[],error:null})
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const orderMap = new Map((ordersRes.data || []).map(x=>[String(x.id),x]));
      const itemMap = new Map((itemsRes.data || []).map(x=>[String(x.id),x]));
      const countOpen = cancels.length + returns.length;

      const statusText = (s) => ({
        pending:'در حال بررسی', approved:'تأیید شد', rejected:'رد شد',
        received:'کالا دریافت شد', closed:'بسته شد'
      }[s] || s || '—');
      const refundText = (s) => ({
        not_required:'نیاز نیست', pending:'در انتظار عودت', refunded:'عودت شد'
      }[s] || s || '—');

      const launcher = $('serviceRequestsLauncher');
      const launcherCount = $('serviceRequestsCount');
      const launcherText = $('serviceRequestsLauncherText');
      if (launcher) launcher.hidden = false;
      if (launcherCount) launcherCount.textContent = countOpen.toLocaleString('fa-IR');
      if (launcherText) launcherText.textContent = countOpen
        ? (cancels.length ? cancels.length.toLocaleString('fa-IR') + ' لغو' + (returns.length ? ' · ' : '') : '') + (returns.length ? returns.length.toLocaleString('fa-IR') + ' مرجوعی' : '') + ' نیازمند بررسی'
        : 'درخواستی برای بررسی نیست';
      if (launcher) {
        launcher.classList.toggle('has-open', countOpen > 0);
        launcher.setAttribute('aria-label', countOpen ? ('مشاهده ' + countOpen.toLocaleString('fa-IR') + ' درخواست باز') : 'درخواست باز وجود ندارد');
      }

      if (!countOpen) {
        box.innerHTML = '<div class="empty">درخواست باز لغو یا مرجوعی وجود ندارد.</div>';
        return;
      }

      const stats =
        '<div class="az-service-stats">' +
          '<div><span>لغوهای باز</span><b>' + cancels.length.toLocaleString('fa-IR') + '</b></div>' +
          '<div><span>مرجوعی‌های باز</span><b>' + returns.length.toLocaleString('fa-IR') + '</b></div>' +
          '<div><span>مجموع</span><b>' + countOpen.toLocaleString('fa-IR') + '</b></div>' +
        '</div>';

      const cancelHtml = cancels.map(row => {
        const o = orderMap.get(String(row.order_id)) || {};
        return '<article class="card" style="margin-bottom:10px">' +
          '<div class="panel-head"><div><strong>❌ درخواست لغو</strong><div class="muted">' + esc(o.order_code || 'سفارش نامشخص') + '</div></div><span class="badge warn">' + esc(statusText(row.status)) + '</span></div>' +
          '<div class="muted" style="line-height:1.9">مشتری: ' + esc(o.customer_name || '—') + ' · پرداخت: ' + esc(labels[o.payment_status] || o.payment_status || '—') + ' · روش پرداخت: ' + esc(o.payment_method || '—') + ' · ارسال: ' + esc(labels[o.shipping_status] || o.shipping_status || '—') + '<br>دلیل: ' + esc(row.reason || '—') + '<br>وضعیت عودت: ' + esc(refundText(row.refund_status)) + '</div>' +
          '<div class="tools" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' + serviceRequestButtons('cancel',{...row,payment_method:o.payment_method}) + '</div>' +
        '</article>';
      }).join('');

      const returnHtml = returns.map(row => {
        const o = orderMap.get(String(row.order_id)) || {};
        const item = itemMap.get(String(row.order_item_id)) || {};
        const variant = item?.variant && typeof item.variant === 'object' ? (item.variant.label || item.variant.size || item.variant.name || '') : String(item?.variant || '');
        return '<article class="card" style="margin-bottom:10px">' +
          '<div class="panel-head"><div><strong>↩️ درخواست مرجوعی</strong><div class="muted">' + esc(o.order_code || 'سفارش نامشخص') + '</div></div><span class="badge warn">' + esc(statusText(row.status)) + '</span></div>' +
          '<div class="muted" style="line-height:1.9">کالا: ' + esc(item.product_name || '—') + (variant ? ' · ' + esc(variant) : '') + '<br>تعداد: ' + esc(Number(row.quantity || 0).toLocaleString('fa-IR')) + ' · مبلغ قابل عودت: ' + money(row.refund_amount || 0) + '<br>دلیل: ' + esc(row.reason || '—') + (row.details ? '<br>توضیحات: ' + esc(row.details) : '') + '<br>وضعیت عودت: ' + esc(refundText(row.refund_status)) + '</div>' +
          '<div class="tools" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' + serviceRequestButtons('return',{...row,payment_method:o.payment_method}) + '</div>' +
        '</article>';
      }).join('');

      box.innerHTML = stats +
        '<div style="display:grid;gap:10px">' +
        (cancelHtml || '') +
        (returnHtml || '') +
        '</div>';
    } catch (err) {
      box.innerHTML = '<div class="empty" style="color:#ff9b9b">بارگذاری درخواست‌های مشتری ناموفق بود: ' + esc(errorText(err)) + '</div>';
    }
  }

  async function handleAdminServiceRequest(id, kind, action, button) {
    if (!can.all()) return toast('__AZICON_BLOCK__ این عملیات فقط برای مالک یا مدیر اصلی مجاز است.');
    if (!(await requireAdminMFA())) return;
    if (!id || !kind || !action) return;
    const confirmText =
      action === 'reject' ? 'از رد این درخواست مطمئنی؟' :
      action === 'refund' ? 'ثبت عودت وجه این مرجوعی انجام شود؟' :
      action === 'received' ? 'دریافت کالا را تأیید می‌کنی؟' :
      'این عملیات روی وضعیت واقعی سفارش اعمال می‌شود. ادامه می‌دهی؟';
    if (!window.confirm(confirmText)) return;

    const oldText = button?.textContent || '';
    if (button) {
      button.disabled = true;
      button.textContent = 'در حال انجام…';
    }
    try {
      const rpcName = kind === 'return' ? 'azim_admin_handle_return_request' : 'azim_admin_handle_cancel_request';
      const { data, error } = await state.db.rpc(rpcName, {
        p_request_id: id,
        p_action: action
      });
      if (error) throw error;
      const result = data || {};
      if (result.ok === false) throw new Error(result.message || 'عملیات انجام نشد.');
      toast('__AZICON_SUCCESS__ ' + (kind === 'return' ? 'درخواست مرجوعی' : 'درخواست لغو') + ' به‌روزرسانی شد.');
      await Promise.all([loadServiceRequests(), loadOrders(), loadDashboard()]);
    } catch (err) {
      toast('__AZICON_ERROR__ ' + errorText(err));
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  async function loadCustomersForOrder() {
    const r = await state.db.from('customers').select('id,full_name,mobile').order('full_name').limit(2000);
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function loadProductsForOrder() {
    if (state.productCacheLoaded) return state.orderProducts;
    const r = await state.db.from('products')
      .select('id,name,code,price,is_active,discount_type,discount_value,discount_is_active,discount_starts_at,discount_ends_at,variants')
      .order('name').limit(2000);
    if (r.error) throw r.error;
    state.orderProducts = r.data || [];
    state.productCacheLoaded = true;
    return state.orderProducts;
  }

  function orderTimeline(status, shippingStatus) {
    const steps = ['pending','confirmed','processing','packed','shipped','delivered'];
    let currentKey = status || 'pending';
    if (shippingStatus === 'packed') currentKey = 'packed';
    if (status === 'shipped' || shippingStatus === 'shipped') currentKey = 'shipped';
    if (status === 'delivered' || shippingStatus === 'delivered') currentKey = 'delivered';

    if (status === 'cancelled') {
      return '<div class="az-order-timeline az-order-timeline-cancelled">' +
        '<span class="az-order-step cancelled current"><i></i>لغو شده</span>' +
        '<span class="az-order-flow-note">این سفارش از چرخه فعال خارج شده است.</span>' +
      '</div>';
    }

    const current = Math.max(0, steps.indexOf(currentKey));
    return '<div class="az-order-timeline">' + steps.map((v,i) =>
      '<span class="az-order-step ' + (i < current ? 'done' : (i === current ? 'current' : '')) + '">' +
      '<i></i>' + esc(v === 'packed' ? 'بسته‌بندی شده' : (labels[v] || v)) + '</span>'
    ).join('') + '</div>';
  }

  function orderForm(x, customers, items) {
    const trackingReadonly = !!x && (['shipped','delivered'].includes(x.status) || ['shipped','delivered'].includes(x.shipping_status));
    const trackingReadonlyAttr = trackingReadonly ? ' readonly aria-readonly="true"' : '';
    const customerOptions = customers.map((c) =>
      '<option value="' + esc(c.id) + '" ' + (x?.customer_id === c.id ? 'selected' : '') + '>' +
      esc(c.full_name) + ' · ' + esc(c.mobile) + '</option>'
    ).join('');
    const itemRows = (items || []).map((it, idx) => orderItemRow(it, idx)).join('');
    const customerHtml = x ? (
      '<div class="az-order-context full">' +
        '<div class="az-order-context-main">' +
          '<span>مشتری سفارش</span><strong>' + esc(x.customer_name || 'بدون نام') + '</strong>' +
          '<small dir="ltr">' + esc(x.customer_mobile || '—') + (x.customer_email ? ' · ' + esc(x.customer_email) : '') + '</small>' +
        '</div>' +
        '<div class="az-order-context-side"><span>مرحله فعلی</span><b>' + esc(labels[x.status] || x.status || '—') + '</b><small>مراحل سفارش از عملیات مرحله‌ای تغییر می‌کنند.</small></div>' +
      '</div>'
    ) : '';

    const statusField = x
      ? '<div class="field"><label>وضعیت سفارش</label><div class="az-readonly-field"><b>' + esc(labels[x.status] || x.status || '—') + '</b><small>برای تغییر مرحله از «اقدام بعدی» استفاده کنید.</small></div><input type="hidden" name="status" value="' + esc(x.status || 'pending') + '"></div>'
      : '<div class="field"><label>وضعیت سفارش</label><div class="az-readonly-field"><b>در انتظار تأیید</b><small>سفارش جدید همیشه از مرحله «در انتظار» شروع می‌شود.</small></div><input type="hidden" name="status" value="pending"></div>';

    const shippingField = x
      ? '<div class="field"><label>وضعیت ارسال</label><div class="az-readonly-field"><b>' + esc(labels[x.shipping_status] || x.shipping_status || '—') + '</b><small>ثبت بسته‌بندی و ارسال از عملیات مرحله‌ای انجام می‌شود.</small></div><input type="hidden" name="shipping_status" value="' + esc(x.shipping_status || 'pending') + '"></div>'
      : '<div class="field"><label>وضعیت ارسال</label><div class="az-readonly-field"><b>در انتظار ارسال</b><small>بسته‌بندی، ارسال و تحویل فقط از عملیات مرحله‌ای ثبت می‌شوند.</small></div><input type="hidden" name="shipping_status" value="pending"></div>';

    return '<div class="az-order-editor">' +
      '<div class="az-order-modal-head">' + customerHtml + '</div>' +
      '<div class="az-order-timeline-wrap">' + orderTimeline(x?.status || 'pending', x?.shipping_status || 'pending') + '</div>' +
      '<form id="orderForm" class="az-order-edit-form">' +

        '<details class="az-order-edit-section" open>' +
          '<summary><span><b>اطلاعات سفارش</b><small>کد و مشتری</small></span><i>⌄</i></summary>' +
          '<div class="az-order-edit-body grid2">' +
            '<div class="field"><label>کد سفارش *</label><input class="input" name="order_code" readonly required title="کد سفارش پس از ثبت غیرقابل تغییر است." value="' + esc(x?.order_code || newOrderCode()) + '"></div>' +
            '<div class="field"><label>مشتری</label><select class="select" name="customer_id"><option value="">بدون مشتری</option>' + customerOptions + '</select></div>' +
            statusField +
            (x
              ? '<div class="field"><label>وضعیت پرداخت</label><div class="az-readonly-field"><b>' + esc(labels[x.payment_status] || x.payment_status || '—') + '</b><small>وضعیت مالی سفارش موجود از مسیر پرداخت/عودت تغییر می‌کند.</small></div><input type="hidden" name="payment_status" value="' + esc(x.payment_status || 'unpaid') + '"></div>'
              : '<div class="field"><label>وضعیت پرداخت</label><div class="az-readonly-field"><b>پرداخت نشده</b><small>سفارش جدید بدون ثبت پرداخت ایجاد می‌شود؛ سپس پرداخت دستی از عملیات امن ثبت می‌شود.</small></div><input type="hidden" name="payment_status" value="unpaid"></div>') +
          '</div>' +
        '</details>' +

        '<details class="az-order-edit-section" open>' +
          '<summary><span><b>ارسال و رهگیری</b><small>مرسوله و شرکت ارسال</small></span><i>⌄</i></summary>' +
          '<div class="az-order-edit-body grid2">' +
            shippingField +
            (trackingReadonly ? '<div class="field full"><small class="muted">اطلاعات مرسوله پس از ثبت ارسال قفل است. برای اصلاح، از «اصلاح اطلاعات رهگیری» در جزئیات سفارش و همراه با دلیل استفاده کنید.</small></div>' : '') +
            '<div class="field"><label>شرکت ارسال</label><input class="input" name="shipping_carrier" maxlength="120"'+trackingReadonlyAttr+' value="' + esc(x?.shipping_carrier || '') + '" placeholder="نام شرکت ارسال"></div>' +
            '<div class="field"><label>کد رهگیری</label><input class="input" name="tracking_code"'+trackingReadonlyAttr+' value="' + esc(x?.tracking_code || '') + '" inputmode="text"></div>' +
            '<div class="field"><label>لینک کامل پیگیری مرسوله</label><input class="input" name="tracking_url" type="url" inputmode="url" dir="ltr"'+trackingReadonlyAttr+' value="' + esc(x?.tracking_url || '') + '" placeholder="https://..."></div>' +
          '</div>' +
        '</details>' +

        '<details class="az-order-edit-section">' +
          '<summary><span><b>مالی و تخفیف</b><small>مبالغ محاسبه‌شده</small></span><i>⌄</i></summary>' +
          '<div class="az-order-edit-body grid2">' +
            '<div class="field"><label>مبلغ نهایی محاسبه‌شده</label><input class="input" name="total" type="number" min="0" value="' + esc(x?.total ?? 0) + '" readonly aria-readonly="true"><div id="orderTotalPreview" class="muted" style="margin-top:4px">با اقلام، ارسال و تخفیف محاسبه می‌شود.</div></div>' +
            '<div class="field"><label>هزینه ارسال</label><input class="input" name="shipping_cost" type="number" min="0" value="' + esc(x?.shipping_cost ?? 0) + '"></div>' +
            '<div class="field full"><label>کد تخفیف</label><div class="tools" style="width:100%"><input class="input" name="discount_code" dir="ltr" value="' + esc(x?.discount_code || '') + '" placeholder="مثلاً AZIM20"><button type="button" id="applyOrderDiscountBtn" class="btn secondary">اعمال تخفیف</button></div><div id="orderDiscountStatus" class="status"></div><input type="hidden" name="discount" value="' + esc(x?.discount ?? 0) + '"></div>' +
          '</div>' +
        '</details>' +

        '<details class="az-order-edit-section" open>' +
          '<summary><span><b>اقلام سفارش</b><small>' + esc((items || []).length.toLocaleString('fa-IR')) + ' قلم</small></span><i>⌄</i></summary>' +
          '<div class="az-order-edit-body">' +
            '<div class="az-order-items-toolbar"><span>ویرایش اقلام با شناسه اصلی آن‌ها ذخیره می‌شود.</span><button type="button" id="addOrderItemBtn" class="btn secondary">＋ قلم</button></div>' +
            '<div id="orderItemsBox">' + (itemRows || '<div class="empty">قلمی اضافه نشده.</div>') + '</div>' +
          '</div>' +
        '</details>' +

        '<details class="az-order-edit-section">' +
          '<summary><span><b>یادداشت داخلی</b><small>فقط برای تیم فروش</small></span><i>⌄</i></summary>' +
          '<div class="az-order-edit-body">' +
            '<div class="field"><label>یادداشت</label><textarea class="textarea" name="notes">' + esc(x?.notes || '') + '</textarea></div>' +
          '</div>' +
        '</details>' +

        '<div class="az-order-editor-actions"><button class="btn" type="submit">ذخیره تغییرات</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div>' +
        '<div id="orderStatus" class="status"></div>' +
      '</form>' +
    '</div>';
  }

  function newOrderCode() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return 'AZ-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function selectOptions(values, selected, map) {
    return values.map((v) => '<option value="' + v + '" ' + (v === selected ? 'selected' : '') + '>' + esc(map[v] || v) + '</option>').join('');
  }

  function orderItemRow(it, idx) {
    const orderProducts = state.orderProducts.length ? state.orderProducts : state.products;
    const productOptions = orderProducts.map((p) =>
      '<option value="' + esc(p.id) + '" ' + (it?.product_id === p.id ? 'selected' : '') + '>' +
      esc(p.code || '—') + ' · ' + esc(p.name) + '</option>'
    ).join('');
    const existingVariant = typeof it?.variant === 'string'
      ? it.variant
      : (it?.variant?.label || it?.variant?.size || it?.variant?.name || '');
    return '<div class="grid2 order-item-row" data-idx="' + idx + '" data-item-id="' + esc(it?.id || '') + '" style="padding:10px 0;border-bottom:1px solid #202722">' +
      '<div class="field"><label>محصول</label><select class="select item-product"><option value="">انتخاب محصول</option>' + productOptions + '</select></div>' +
      '<div class="field"><label>تعداد</label><input class="input item-qty" type="number" min="1" value="' + esc(it?.quantity || 1) + '"></div>' +
      '<div class="field"><label>قیمت واحد</label><input class="input item-price" type="number" min="0" value="' + esc(it?.unit_price ?? 0) + '"></div>' +
      '<div class="field"><label>مدل / سایز</label><input class="input item-variant" maxlength="160" value="' + esc(existingVariant) + '"></div>' +
      '<div class="field"><label>جمع</label><input class="input item-total" type="number" min="0" value="' + esc(it?.line_total ?? 0) + '" readonly></div>' +
      '<div class="field full"><button type="button" class="btn ghost remove-item">حذف قلم</button></div></div>';
  }

  function orderActionPlan(x, refundSummary = null) {
    if (!x) return { key:'none', label:'مدیریت سفارش', tone:'warn', kind:'open' };
    const refundStatus = String(refundSummary?.status || 'none');
    if (['requested','pending','processing','review_required'].includes(refundStatus)) {
      return { key:'review_refund', label:'مشاهده وضعیت عودت', tone:'warn', kind:'refund' };
    }
    if (x.status === 'cancelled') {
      if (refundStatus === 'failed') return { key:'review_refund', label:'بررسی عودت ناموفق', tone:'warn', kind:'refund' };
      return { key:'restore', label:'بازگردانی سفارش', tone:'red', kind:'restore' };
    }
    if (x.status === 'delivered' || x.shipping_status === 'delivered') return { key:'done', label:'سفارش تکمیل شده', tone:'ok', kind:'none' };
    if (x.payment_status !== 'paid') {
      if (['unpaid','pending'].includes(x.payment_status) && ['phone','message'].includes(x.payment_method)) {
        return { key:'record_manual_payment', label:'ثبت پرداخت دستی', tone:'warn', kind:'manual_payment' };
      }
      return { key:'review_payment', label:'بررسی وضعیت پرداخت', tone:'warn', kind:'review' };
    }
    if (x.status === 'pending' && x.shipping_status === 'pending') return { key:'confirm_order', label:'تأیید سفارش', tone:'warn', kind:'transition' };
    if (x.status === 'confirmed' && x.shipping_status === 'pending') return { key:'start_processing', label:'شروع پردازش', tone:'warn', kind:'transition' };
    if (x.status === 'processing' && x.shipping_status === 'pending') return { key:'mark_packed', label:'ثبت بسته‌بندی', tone:'warn', kind:'transition' };
    if (x.status === 'processing' && x.shipping_status === 'packed') return { key:'mark_shipped', label:'ثبت ارسال و رهگیری', tone:'warn', kind:'shipping' };
    if (x.status === 'shipped' && x.shipping_status === 'shipped') return { key:'mark_delivered', label:'ثبت تحویل', tone:'ok', kind:'transition' };
    return { key:'open', label:'بررسی سفارش', tone:'warn', kind:'open' };
  }

  function orderMethodText(method) {
    return ({ online:'پرداخت آنلاین', phone:'تلفنی', message:'پیام' }[method] || method || '—');
  }

  function orderStageCorrectionTargets(x) {
    if (!x || x.status === 'cancelled' || x.status === 'delivered' || x.shipping_status === 'delivered') return [];
    if (x.status === 'confirmed' && x.shipping_status === 'pending') {
      return [{ value:'pending', label:'در انتظار تأیید' }];
    }
    if (x.status === 'processing' && x.shipping_status === 'pending') {
      return [{ value:'confirmed', label:'تأیید شده' }];
    }
    if (x.status === 'processing' && x.shipping_status === 'packed') {
      return [{ value:'processing', label:'در حال پردازش' }];
    }
    if (x.status === 'shipped' && x.shipping_status === 'shipped') {
      return [
        { value:'packed', label:'بسته‌بندی شده' },
        { value:'processing', label:'در حال پردازش' }
      ];
    }
    return [];
  }

  async function openOrderStageCorrection(id) {
    if (!can.all()) return toast('__AZICON_BLOCK__ اصلاح مرحله فقط برای مالک یا مدیر اصلی مجاز است.');
    if (!id) return toast('__AZICON_ERROR__ شناسه سفارش وجود ندارد.');
    try {
      const { data, error } = await state.db.from('orders')
        .select('id,order_code,status,shipping_status,payment_status,tracking_code,tracking_url,shipping_carrier')
        .eq('id',id).single();
      if (error) throw error;
      const targets = orderStageCorrectionTargets(data);
      if (!targets.length) return toast('__AZICON_BLOCK__ برای این وضعیت مسیر اصلاح مرحله تعریف نشده است.');

      openModal('اصلاح مرحله سفارش',
        '<form id="orderStageCorrectionForm" class="az-shipping-action-form">' +
          '<div class="az-shipping-action-intro"><span>STAGE CORRECTION</span><strong dir="ltr">' + esc(data.order_code || '—') + '</strong><small>این عملیات وضعیت واقعی سفارش را اصلاح می‌کند؛ تاریخچه تغییر در Audit Log ثبت می‌شود.</small></div>' +
          '<div class="grid2">' +
            '<div class="field"><label>وضعیت فعلی</label><input class="input" value="' + esc(labels[data.status] || data.status || '—') + '" readonly></div>' +
            '<div class="field"><label>مرحله مقصد *</label><select class="input" name="target_stage" required>' + targets.map(t => '<option value="' + esc(t.value) + '">' + esc(t.label) + '</option>').join('') + '</select></div>' +
            '<div class="field full"><label>دلیل اصلاح *</label><textarea class="input" name="reason" minlength="5" maxlength="1000" rows="4" required placeholder="مثلاً: اشتباهاً ارسال ثبت شد؛ بسته هنوز تحویل شرکت ارسال نشده است."></textarea></div>' +
          '</div>' +
          '<div class="status" id="orderStageCorrectionStatus"></div>' +
          '<div class="mfa-actions"><button class="btn" type="submit">ثبت اصلاح مرحله</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div>' +
        '</form>'
      );
      $('modal')?.classList.add('az-order-workspace');
      $('orderStageCorrectionForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const st = $('orderStageCorrectionStatus');
        const fd = new FormData(e.target);
        const targetStage = String(fd.get('target_stage') || '').trim();
        const reason = String(fd.get('reason') || '').trim();
        if (reason.length < 5) { if (st) st.textContent='__AZICON_ERROR__ دلیل اصلاح باید حداقل ۵ کاراکتر باشد.'; return; }
        if (!(await requireAdminMFA())) {
          if (st) st.textContent='__AZICON_LOCK__ برای اصلاح مرحله، نشست MFA باید تأیید شده باشد.';
          return;
        }
        if (btn) btn.disabled = true;
        try {
          const r = await state.db.rpc('azim_admin_correct_order_stage',{p_order_id:id,p_target_stage:targetStage,p_reason:reason});
          if (r.error) throw r.error;
          closeModal();
          toast('__AZICON_SUCCESS__ مرحله سفارش اصلاح شد.');
          await Promise.all([loadOrders(),loadDashboard()]);
        } catch (err) {
          if (st) st.textContent='__AZICON_ERROR__ '+errorText(err);
          if (btn) btn.disabled = false;
        }
      };
    } catch (err) {
      toast('__AZICON_ERROR__ بارگذاری اصلاح مرحله ناموفق بود: '+errorText(err));
    }
  }

  async function openAdminCancelOrder(id) {
    if (!can.all()) return toast('__AZICON_BLOCK__ لغو مستقیم سفارش فقط برای مالک یا مدیر اصلی مجاز است.');
    if (!id) return toast('__AZICON_ERROR__ شناسه سفارش وجود ندارد.');
    try {
      const { data, error } = await state.db.from('orders')
        .select('id,order_code,status,shipping_status,payment_status,payment_method,total')
        .eq('id',id).single();
      if (error) throw error;
      if (!['pending','confirmed','processing'].includes(data.status) || data.shipping_status !== 'pending') {
        return toast('__AZICON_BLOCK__ این سفارش دیگر قبل از ارسال قابل لغو از پنل نیست.');
      }

      openModal('لغو سفارش از پنل',
        '<form id="adminCancelOrderForm" class="az-shipping-action-form">' +
          '<div class="az-shipping-action-intro"><span>ORDER CANCELLATION</span><strong dir="ltr">' + esc(data.order_code || '—') + '</strong><small>مبلغ سفارش: ' + money(data.total) + ' · روش پرداخت: ' + esc(orderMethodText(data.payment_method)) + '</small></div>' +
          '<div class="az-payment-confirm-danger"><strong>⚠️ لغو قطعی سفارش</strong><span>این کار سفارش را لغوشده می‌کند و اگر پرداخت قطعی باشد، مسیر عودت وجه مرتبط نیز فعال می‌شود.</span></div>' +
          '<div class="field full"><label>دلیل لغو *</label><textarea class="input" name="reason" minlength="5" maxlength="1000" rows="4" required placeholder="مثلاً: درخواست مشتری قبل از ارسال"></textarea></div>' +
          '<div class="status" id="adminCancelOrderStatus"></div>' +
          '<div class="mfa-actions"><button class="btn danger" type="submit">لغو قطعی سفارش</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div>' +
        '</form>'
      );
      $('modal')?.classList.add('az-order-workspace');
      $('adminCancelOrderForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const st = $('adminCancelOrderStatus');
        const reason = String(new FormData(e.target).get('reason') || '').trim();
        if (reason.length < 5) { if (st) st.textContent='__AZICON_ERROR__ دلیل لغو باید حداقل ۵ کاراکتر باشد.'; return; }
        if (!(await requireAdminMFA())) {
          if (st) st.textContent='__AZICON_LOCK__ برای لغو سفارش، نشست MFA باید تأیید شده باشد.';
          return;
        }
        if (!window.confirm('این سفارش واقعاً لغو شود؟')) return;
        if (btn) btn.disabled = true;
        try {
          const r = await state.db.rpc('azim_admin_cancel_order',{p_order_id:id,p_reason:reason});
          if (r.error) throw r.error;
          closeModal();
          toast('__AZICON_SUCCESS__ سفارش لغو شد و وضعیت عودت وجه طبق روش پرداخت ثبت شد.');
          await Promise.all([loadOrders(),loadDashboard()]);
        } catch (err) {
          if (st) st.textContent='__AZICON_ERROR__ '+errorText(err);
          if (btn) btn.disabled = false;
        }
      };
    } catch (err) {
      toast('__AZICON_ERROR__ بارگذاری لغو سفارش ناموفق بود: '+errorText(err));
    }
  }

  function orderControlView(x, items, focusSection = '', refundSummary = null) {
    const plan = orderActionPlan(x, refundSummary);
    const status = labels[x.status] || x.status || '—';
    const payment = labels[x.payment_status] || x.payment_status || '—';
    const shipping = labels[x.shipping_status] || x.shipping_status || '—';
    const legacyPaidReferenceMissing = x.payment_status === 'paid' &&
      ['phone','message'].includes(x.payment_method) && !String(x.payment_reference || '').trim();
    const canAttachLegacyPaymentReference = legacyPaidReferenceMissing && !!x.paid_at && can.all();
    const itemRows = (items || []).map((it) => {
      const variant = it?.variant && typeof it.variant === 'object'
        ? (it.variant.label || it.variant.size || it.variant.name || '')
        : String(it?.variant || '');
      return '<div class="az-control-item">' +
        '<div><b>' + esc(it.product_name || 'محصول') + '</b><small>' + esc(it.sku || '—') + (variant ? ' · ' + esc(variant) : '') + '</small></div>' +
        '<span>×' + esc(Number(it.quantity || 0).toLocaleString('fa-IR')) + '</span>' +
        '<strong>' + money(it.line_total) + '</strong>' +
      '</div>';
    }).join('');

    const sectionOpen = (name, defaultOpen=false) => (focusSection === name || defaultOpen) ? ' open' : '';
    const actionHtml = plan.kind === 'restore' && can.all()
      ? '<button class="btn ghost az-order-control-primary danger" type="button" data-order-control-action="restore" data-order-id="' + esc(x.id) + '" data-order-code="' + esc(x.order_code || '') + '">🔄 بازگردانی سفارش</button>'
      : plan.kind === 'restore'
        ? '<span class="muted">بازگردانی فقط برای مالک/مدیر مجاز است.</span>'
      : plan.kind === 'transition'
        ? '<button class="btn az-order-control-primary" type="button" data-order-control-action="' + esc(plan.key) + '" data-order-id="' + esc(x.id) + '">' + esc(plan.label) + ' <span>←</span></button>'
        : plan.kind === 'shipping'
          ? '<button class="btn az-order-control-primary" type="button" data-order-control-action="mark_shipped" data-order-id="' + esc(x.id) + '">ثبت ارسال و رهگیری <span>←</span></button>'
          : plan.kind === 'review'
            ? '<button class="btn secondary az-order-control-primary" type="button" data-order-control-action="review_payment" data-order-id="' + esc(x.id) + '">بررسی وضعیت پرداخت <span>←</span></button>'
          : plan.kind === 'refund'
            ? '<button class="btn secondary az-order-control-primary" type="button" data-order-control-action="review_refund" data-order-id="' + esc(x.id) + '">مشاهده وضعیت عودت <span>←</span></button>'
          : plan.kind === 'manual_payment'
            ? '<button class="btn az-order-control-primary" type="button" data-order-control-action="record_manual_payment" data-order-id="' + esc(x.id) + '">ثبت پرداخت دستی <span>←</span></button>'
            : '';
    const stageCorrectionTargets = orderStageCorrectionTargets(x);
    const shipmentCorrectionHtml = can.all() &&
      (['shipped','delivered'].includes(x.status) || ['shipped','delivered'].includes(x.shipping_status))
      ? '<button class="btn ghost" type="button" data-order-control-action="correct_shipment" data-order-id="' + esc(x.id) + '">🧾 اصلاح اطلاعات رهگیری</button>'
      : '';
    const correctionHtml = can.all() && stageCorrectionTargets.length
      ? '<button class="btn ghost" type="button" data-order-control-action="correct_stage" data-order-id="' + esc(x.id) + '">🛠️ اصلاح مرحله</button>'
      : '';
    const directCancelHtml = can.all() && ['pending','confirmed','processing'].includes(x.status) && x.shipping_status === 'pending'
      ? '<button class="btn ghost danger" type="button" data-order-control-action="cancel_order" data-order-id="' + esc(x.id) + '">لغو سفارش</button>'
      : '';

    const actionHint = plan.kind === 'restore'
      ? 'این عملیات حساس با نشست MFA تأییدشده انجام می‌شود.'
      : plan.kind === 'review'
        ? 'پرداخت آنلاین از مسیر درگاه کنترل می‌شود و تأیید دستی برای آن انجام نمی‌شود.'
        : plan.kind === 'manual_payment'
          ? 'برای سفارش تلفنی/پیامی، ثبت پرداخت با نشست MFA انجام می‌شود و در گزارش فعالیت ثبت خواهد شد.'
        : plan.kind === 'open'
          ? 'برای این وضعیت عملیات مرحله‌ای تعریف نشده؛ از بخش‌های پایین برای بررسی سفارش استفاده کنید.'
        : plan.kind === 'none'
          ? 'این سفارش به مرحله نهایی رسیده است.'
          : 'اقدام بعدی بر اساس وضعیت واقعی سفارش و محدودیت‌های Supabase تعیین شده است.';

    return '<div class="az-order-control">' +
      '<div class="az-order-control-hero">' +
        '<div class="az-order-control-code"><span>ORDER CONTROL</span><strong dir="ltr">' + esc(x.order_code || '—') + '</strong><small>' + dateFa(x.created_at) + '</small></div>' +
        '<div class="az-order-control-total"><span>مبلغ نهایی</span><b>' + money(x.total) + '</b></div>' +
      '</div>' +
      '<div class="az-order-control-customer">' +
        '<div><span>مشتری</span><b>' + esc(x.customer_name || 'مشتری ثبت‌نشده') + '</b></div>' +
        '<div><span>موبایل</span><b dir="ltr">' + esc(x.customer_mobile || '—') + '</b></div>' +
        '<div><span>ایمیل</span><b dir="ltr">' + esc(x.customer_email || '—') + '</b></div>' +
      '</div>' +
      '<div class="az-order-control-statuses">' +
        '<span class="az-order-pill ' + (x.status === 'cancelled' ? 'red' : x.status === 'delivered' ? 'ok' : 'warn') + '">سفارش · ' + esc(status) + '</span>' +
        '<span class="az-order-pill ' + (x.payment_status === 'paid' ? 'ok' : ['refunded','partially_refunded'].includes(x.payment_status) ? 'red' : 'warn') + '">پرداخت · ' + esc(payment) + '</span>' +
        '<span class="az-order-pill ' + (x.shipping_status === 'delivered' ? 'ok' : 'warn') + '">ارسال · ' + esc(shipping) + '</span>' +
        (refundSummary?.status && refundSummary.status !== 'none' ? '<span class="az-order-pill ' + (['refunded','partially_refunded'].includes(refundSummary.status) ? 'ok' : (['failed','review_required'].includes(refundSummary.status) ? 'red' : 'warn')) + '">💰 ' + esc(refundSummary.label || refundSummary.status) + '</span>' : '') +
      '</div>' +
      '<div class="az-order-control-action">' +
        '<div><span>اقدام بعدی</span><b class="' + esc(plan.tone) + '">' + esc(plan.label) + '</b><small>' + esc(actionHint) + '</small></div>' +
        actionHtml +
      '</div>' +
      ((correctionHtml || directCancelHtml || shipmentCorrectionHtml) ? '<div class="az-order-control-secondary">' + correctionHtml + directCancelHtml + shipmentCorrectionHtml + '</div>' : '') +
      '<div class="az-order-control-timeline">' + orderTimeline(x.status, x.shipping_status) + '</div>' +

      '<details id="orderSection-items" class="az-order-control-section"' + sectionOpen('items') + '>' +
        '<summary><span><b>اقلام سفارش</b><small>' + esc((items || []).length.toLocaleString('fa-IR')) + ' قلم</small></span><i>⌄</i></summary>' +
        '<div class="az-order-control-body">' + (itemRows || '<div class="empty">قلمی برای این سفارش ثبت نشده.</div>') + '</div>' +
      '</details>' +

      '<details id="orderSection-shipping" class="az-order-control-section"' + sectionOpen('shipping') + '>' +
        '<summary><span><b>ارسال و رهگیری</b><small>' + esc(x.shipping_carrier || 'شرکت ارسال ثبت نشده') + '</small></span><i>⌄</i></summary>' +
        '<div class="az-order-control-body"><div class="az-order-detail-grid">' +
          '<div><span>شرکت ارسال</span><b>' + esc(x.shipping_carrier || '—') + '</b></div>' +
          '<div><span>کد رهگیری</span><b dir="ltr">' + esc(x.tracking_code || '—') + '</b></div>' +
          '<div class="full"><span>لینک پیگیری</span><b dir="ltr" class="break-any">' + esc(x.tracking_url || '—') + '</b></div>' +
        '</div></div>' +
      '</details>' +

      '<details id="orderSection-payment" class="az-order-control-section"' + sectionOpen('payment') + '>' +
        '<summary><span><b>پرداخت و مالی</b><small>' + esc(orderMethodText(x.payment_method)) + '</small></span><i>⌄</i></summary>' +
        '<div class="az-order-control-body"><div class="az-order-detail-grid">' +
          '<div><span>روش پرداخت</span><b>' + esc(orderMethodText(x.payment_method)) + '</b></div>' +
          '<div><span>وضعیت پرداخت</span><b>' + esc(payment) + '</b></div>' +
          '<div><span>قبل تخفیف</span><b>' + money(x.subtotal) + '</b></div>' +
          '<div><span>تخفیف</span><b>' + (Number(x.discount || 0) ? money(x.discount) : 'بدون تخفیف') + '</b></div>' +
          '<div><span>هزینه ارسال</span><b>' + (Number(x.shipping_cost || 0) ? money(x.shipping_cost) : 'هماهنگی با واحد فروش') + '</b></div>' +
          '<div><span>مبلغ نهایی</span><b class="gold">' + money(x.total) + '</b></div>' +
          '<div><span>شناسه پرداخت</span><b dir="ltr">' + esc(x.payment_reference || '—') + '</b></div>' +
          '<div><span>زمان پرداخت</span><b>' + dateFa(x.paid_at) + '</b></div>' +
          '<div><span>وضعیت عودت</span><b>' + esc(refundSummary?.label || 'عودت وجه ندارد') + '</b></div>' +
          '<div><span>مبلغ عودت‌شده</span><b>' + (Number(refundSummary?.amount_refunded || 0) ? money(refundSummary.amount_refunded) : '—') + '</b></div>' +
          '<div><span>مبلغ در انتظار عودت</span><b>' + (Number(refundSummary?.amount_pending || 0) ? money(refundSummary.amount_pending) : '—') + '</b></div>' +
        '</div>' +
        (legacyPaidReferenceMissing
          ? '<div class="az-payment-confirm-danger" role="alert" style="margin-top:12px"><strong>سابقه مالی ناقص</strong><span>پرداخت این سفارش با روش تلفنی/پیامی «پرداخت‌شده» است اما مرجع واقعی پرداخت ثبت نشده. شناسه ساختگی وارد نکنید؛ مرجع را فقط از رسید یا مدرک معتبر وارد کنید.</span>' +
            (canAttachLegacyPaymentReference
              ? '<button class="btn" type="button" data-order-control-action="attach_payment_reference" data-order-id="' + esc(x.id) + '">ثبت مرجع واقعی پرداخت</button>'
              : '<small>برای ثبت مرجع، زمان ثبت پرداخت باید در سابقه معتبر موجود باشد و دسترسی مالک/مدیر لازم است.</small>') +
            '</div>'
          : '') +
        '</div>' +
      '</details>' +

      '<details id="orderSection-notes" class="az-order-control-section"' + sectionOpen('notes') + '>' +
        '<summary><span><b>یادداشت داخلی</b><small>اطلاعات تیم فروش</small></span><i>⌄</i></summary>' +
        '<div class="az-order-control-body"><div class="az-order-note">' + esc(x.notes || 'یادداشتی ثبت نشده.') + '</div></div>' +
      '</details>' +

      '<div class="az-order-control-footer"><button class="btn secondary" type="button" data-order-edit-full="' + esc(x.id) + '">ویرایش کامل اطلاعات</button></div>' +
    '</div>';
  }

  async function openOrder(id, focusSection = '') {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی سفارش‌ها ندارد.');
    try {
      const [o, i, rf] = await Promise.all([
        state.db.from('orders').select('*').eq('id', id).single(),
        state.db.from('order_items').select('*').eq('order_id', id).order('id'),
        state.db.rpc('azim_admin_order_refund_summary',{p_order_id:id})
      ]);
      if (o.error) throw o.error;
      if (i.error) throw i.error;
      if (rf.error) throw rf.error;
      openModal('مدیریت سفارش', orderControlView(o.data, i.data || [], focusSection, rf.data || null));
      $('modal')?.classList.add('az-order-workspace');
    } catch (err) {
      toast('__AZICON_ERROR__ بارگذاری سفارش ناموفق بود: ' + errorText(err));
    }
  }

  async function openOrderEditor(id, focusSection = '') {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی سفارش‌ها ندارد.');
    try {
      const [o, c, i] = await Promise.all([
        state.db.from('orders').select('*').eq('id', id).single(),
        loadCustomersForOrder(),
        state.db.from('order_items').select('*').eq('order_id', id).order('id')
      ]);
      if (o.error) throw o.error;
      if (i.error) throw i.error;
      state.orderItems = i.data || [];
      await loadProductsForOrder();
      openModal('ویرایش سفارش', orderForm(o.data, c, state.orderItems));
      $('modal')?.classList.add('az-order-workspace');
      wireOrderForm(id);
      const section = focusSection === 'payment' ? document.querySelector('#orderForm .az-order-edit-section:nth-of-type(1)')
        : focusSection === 'shipping' ? document.querySelector('#orderForm .az-order-edit-section:nth-of-type(2)') : null;
      if (section && section.tagName === 'DETAILS') section.open = true;
      if (focusSection === 'shipping') $('orderForm')?.elements?.tracking_code?.focus();
      if (focusSection === 'payment') $('orderForm')?.elements?.payment_status?.focus();
    } catch (err) {
      toast('__AZICON_ERROR__ بارگذاری ویرایش سفارش ناموفق بود: ' + errorText(err));
    }
  }

  async function openManualPaymentAction(id) {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی سفارش‌ها ندارد.');
    try {
      const {data,error}=await state.db.from('orders')
        .select('id,order_code,status,payment_status,payment_method,total')
        .eq('id',id).single();
      if(error) throw error;
      if(!['phone','message'].includes(data.payment_method)) return toast('__AZICON_BLOCK__ این سفارش از مسیر پرداخت دستی قابل تأیید نیست.');
      if(data.status==='cancelled') return toast('__AZICON_BLOCK__ سفارش لغوشده قابل ثبت پرداخت دستی نیست.');
      if(!['unpaid','pending'].includes(data.payment_status)) return toast('__AZICON_BLOCK__ این سفارش در وضعیت قابل ثبت پرداخت دستی نیست.');
      openModal('ثبت پرداخت دستی',
        '<form id="manualPaymentForm" class="az-shipping-action-form">' +
          '<div class="az-shipping-action-intro"><span>MANUAL PAYMENT CONTROL</span><strong dir="ltr">' + esc(data.order_code || '—') + '</strong><small>مبلغ سفارش: ' + money(data.total) + ' · روش: ' + esc(orderMethodText(data.payment_method)) + '</small></div>' +
          '<div class="field"><label>شناسه / توضیح تأیید پرداخت *</label><input class="input" name="reference" required minlength="3" maxlength="200" placeholder="مثلاً رسید کارتخوان ۱۲۳۴ یا تأیید تلفنی فروش"></div>' +
          '<div class="status" id="manualPaymentStatus"></div>' +
          '<div class="mfa-actions"><button class="btn" type="submit">ثبت پرداخت قطعی</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div>' +
        '</form>'
      );
      $('modal')?.classList.add('az-order-workspace');
      $('manualPaymentForm').onsubmit=async(e)=>{
        e.preventDefault();
        const btn=e.target.querySelector('button[type="submit"]');
        const st=$('manualPaymentStatus');
        if(btn) btn.disabled=true;
        if(!(await requireAdminMFA())){
          if(st) st.textContent='__AZICON_LOCK__ برای ثبت پرداخت دستی، نشست MFA باید تأیید شده باشد.';
          if(btn) btn.disabled=false;
          return;
        }
        try{
          const reference=String(new FormData(e.target).get('reference')||'').trim();
          const r=await state.db.rpc('azim_admin_record_manual_payment',{p_order_id:id,p_reference:reference});
          if(r.error) throw r.error;
          closeModal();
          toast('__AZICON_SUCCESS__ پرداخت دستی ثبت شد؛ سفارش آماده ادامه چرخه است.');
          await Promise.all([loadOrders(),loadDashboard()]);
        }catch(err){
          if(st) st.textContent='__AZICON_ERROR__ '+errorText(err);
          if(btn) btn.disabled=false;
        }
      };
    }catch(err){toast('__AZICON_ERROR__ بارگذاری ثبت پرداخت دستی ناموفق بود: '+errorText(err));}
  }

  async function openAttachPaymentReferenceAction(id) {
    if (!can.all()) return toast('__AZICON_BLOCK__ ثبت مرجع پرداخت تاریخی فقط برای مالک یا مدیر مجاز است.');
    try {
      const {data,error}=await state.db.from('orders')
        .select('id,order_code,status,payment_status,payment_method,payment_reference,paid_at,total')
        .eq('id',id).single();
      if(error) throw error;
      if (!['phone','message'].includes(data.payment_method) || data.payment_status !== 'paid') {
        return toast('__AZICON_BLOCK__ این عملیات فقط برای پرداخت دستیِ تأییدشده مجاز است.');
      }
      if (String(data.payment_reference || '').trim()) return toast('__AZICON_BLOCK__ مرجع پرداخت از قبل ثبت شده است.');
      if (!data.paid_at) return toast('__AZICON_BLOCK__ زمان ثبت پرداخت سابقه معتبر ندارد؛ ابتدا سابقه را بررسی کنید.');
      openModal('تکمیل سابقه مالی سفارش',
        '<form id="legacyPaymentReferenceForm" class="az-shipping-action-form">' +
          '<div class="az-shipping-action-intro"><span>LEGACY PAYMENT RECONCILIATION</span><strong dir="ltr">' + esc(data.order_code || '—') + '</strong><small>وضعیت پرداخت تغییر نمی‌کند. فقط مرجع واقعیِ موجود در رسید/مدرک ثبت می‌شود و دلیل تغییر در سابقه مدیریتی ذخیره خواهد شد.</small></div>' +
          '<div class="field"><label>مرجع واقعی پرداخت *</label><input class="input" name="reference" minlength="3" maxlength="160" required autocomplete="off" placeholder="شماره پیگیری/رسید واقعی"></div>' +
          '<div class="field"><label>دلیل و مدرک بررسی *</label><textarea class="input" name="reason" minlength="5" maxlength="500" rows="3" required placeholder="مثلاً تطبیق با رسید انتقال بانکی در تاریخ ثبت‌شده"></textarea></div>' +
          '<div id="legacyPaymentReferenceStatus" class="status"></div>' +
          '<div class="mfa-actions"><button class="btn" type="submit">ثبت مرجع تأییدشده</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div>' +
        '</form>'
      );
      $('modal')?.classList.add('az-order-workspace');
      $('legacyPaymentReferenceForm').onsubmit=async(e)=>{
        e.preventDefault();
        const form=e.target;
        const btn=form.querySelector('button[type="submit"]');
        const st=$('legacyPaymentReferenceStatus');
        const fd=new FormData(form);
        const reference=String(fd.get('reference')||'').trim();
        const reason=String(fd.get('reason')||'').trim();
        if (btn) btn.disabled=true;
        if (!(await requireAdminMFA())) {
          if(st) st.textContent='__AZICON_LOCK__ نشست MFA باید تأیید شده باشد.';
          if(btn) btn.disabled=false;
          return;
        }
        try {
          const result=await state.db.rpc('azim_admin_attach_payment_reference',{
            p_order_id:id,p_reference:reference,p_reason:reason
          });
          if(result.error) throw result.error;
          closeModal();
          toast('__AZICON_SUCCESS__ مرجع واقعی ثبت شد؛ وضعیت پرداخت تغییر نکرد.');
          await Promise.all([loadOrders(),loadDashboard()]);
          await openOrder(id,'payment');
        } catch(err) {
          if(st) st.textContent='__AZICON_ERROR__ '+errorText(err);
          if(btn) btn.disabled=false;
        }
      };
    } catch(err) {
      toast('__AZICON_ERROR__ بارگذاری سابقه مالی ناموفق بود: '+errorText(err));
    }
  }

  async function openOrderShippingAction(id) {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی سفارش‌ها ندارد.');
    try {
      const {data,error}=await state.db.from('orders').select('id,order_code,status,payment_status,shipping_status,tracking_code,tracking_url,shipping_carrier').eq('id',id).single();
      if(error) throw error;
      if(data.status!=='processing' || data.shipping_status!=='packed' || data.payment_status!=='paid') {
        return toast('__AZICON_BLOCK__ این سفارش فعلاً شرایط ثبت ارسال را ندارد.');
      }
      openModal('ثبت ارسال سفارش',
        '<form id="shippingActionForm" class="az-shipping-action-form">' +
          '<div class="az-shipping-action-intro"><span>SHIPMENT CONTROL</span><strong dir="ltr">' + esc(data.order_code || '—') + '</strong><small>با ثبت این اطلاعات، سفارش به «ارسال شده» منتقل می‌شود.</small></div>' +
          '<div class="grid2">' +
            '<div class="field"><label>شرکت ارسال *</label><input class="input" name="shipping_carrier" maxlength="120" required value="' + esc(data.shipping_carrier || '') + '" placeholder="نام شرکت ارسال"></div>' +
            '<div class="field"><label>کد رهگیری *</label><input class="input" name="tracking_code" required value="' + esc(data.tracking_code || '') + '"></div>' +
            '<div class="field full"><label>لینک کامل پیگیری *</label><input class="input" name="tracking_url" type="url" inputmode="url" dir="ltr" required value="' + esc(data.tracking_url || '') + '" placeholder="https://..."></div>' +
          '</div>' +
          '<div id="shippingActionStatus" class="status"></div>' +
          '<div class="mfa-actions"><button class="btn" type="submit">ثبت ارسال</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div>' +
        '</form>'
      );
      $('modal')?.classList.add('az-order-workspace');
      $('shippingActionForm').onsubmit=async(e)=>{
        e.preventDefault();
        const btn=e.target.querySelector('button[type="submit"]');
        const st=$('shippingActionStatus');
        if(btn) btn.disabled=true;
        try{
          const fd=new FormData(e.target);
          const r=await state.db.rpc('azim_admin_transition_order',{
            p_order_id:id,p_action:'mark_shipped',
            p_tracking_code:String(fd.get('tracking_code')||'').trim(),
            p_tracking_url:String(fd.get('tracking_url')||'').trim(),
            p_shipping_carrier:String(fd.get('shipping_carrier')||'').trim()
          });
          if(r.error) throw r.error;
          closeModal();
          toast('__AZICON_SUCCESS__ ارسال سفارش ثبت شد.');
          await Promise.all([loadOrders(),loadDashboard()]);
        }catch(err){
          if(st) st.textContent='__AZICON_ERROR__ '+errorText(err);
          if(btn) btn.disabled=false;
        }
      };
    }catch(err){toast('__AZICON_ERROR__ بارگذاری فرم ارسال ناموفق بود: '+errorText(err));}
  }

  async function openOrderShipmentCorrection(id) {
    if (!can.all()) return toast('__AZICON_BLOCK__ اصلاح اطلاعات رهگیری فقط برای مالک یا مدیر مجاز است.');
    if (!id) return toast('__AZICON_ERROR__ شناسه سفارش وجود ندارد.');
    try {
      const {data,error}=await state.db.from('orders')
        .select('id,order_code,status,shipping_status,tracking_code,tracking_url,shipping_carrier')
        .eq('id',id).single();
      if(error) throw error;
      if(!(['shipped','delivered'].includes(data.status) || ['shipped','delivered'].includes(data.shipping_status))) {
        return toast('__AZICON_BLOCK__ اصلاح این اطلاعات فقط پس از ثبت ارسال مجاز است.');
      }
      openModal('اصلاح اطلاعات رهگیری',
        '<form id="shipmentCorrectionForm" class="az-shipping-action-form">' +
          '<div class="az-shipping-action-intro"><span>SHIPMENT CORRECTION</span><strong dir="ltr">' + esc(data.order_code || '—') + '</strong><small>اصلاح با تأیید دومرحله‌ای انجام می‌شود و مقدار قبلی و جدید همراه دلیل در گزارش فعالیت ثبت می‌شود.</small></div>' +
          '<div class="grid2">' +
            '<div class="field"><label>شرکت ارسال *</label><input class="input" name="shipping_carrier" maxlength="120" required value="' + esc(data.shipping_carrier || '') + '"></div>' +
            '<div class="field"><label>کد رهگیری *</label><input class="input" name="tracking_code" maxlength="120" required value="' + esc(data.tracking_code || '') + '"></div>' +
            '<div class="field full"><label>لینک کامل پیگیری *</label><input class="input" name="tracking_url" type="url" inputmode="url" dir="ltr" maxlength="500" required value="' + esc(data.tracking_url || '') + '" placeholder="https://..."></div>' +
            '<div class="field full"><label>دلیل اصلاح *</label><textarea class="input" name="reason" minlength="5" maxlength="1000" rows="3" required placeholder="مثلاً: شماره مرسوله قبلی اشتباه ثبت شده بود."></textarea></div>' +
          '</div>' +
          '<div id="shipmentCorrectionStatus" class="status"></div>' +
          '<div class="mfa-actions"><button class="btn" type="submit">ثبت اصلاح رهگیری</button><button class="btn secondary" type="button" onclick="closeModal()">انصراف</button></div>' +
        '</form>'
      );
      $('modal')?.classList.add('az-order-workspace');
      $('shipmentCorrectionForm').onsubmit=async(e)=>{
        e.preventDefault();
        const btn=e.target.querySelector('button[type="submit"]');
        const st=$('shipmentCorrectionStatus');
        if(btn) btn.disabled=true;
        if(!(await requireAdminMFA())){
          if(st) st.textContent='__AZICON_LOCK__ برای اصلاح رهگیری، نشست MFA باید تأیید شده باشد.';
          if(btn) btn.disabled=false;
          return;
        }
        try{
          const fd=new FormData(e.target);
          const r=await state.db.rpc('azim_admin_correct_order_shipment',{
            p_order_id:id,
            p_tracking_code:String(fd.get('tracking_code')||'').trim(),
            p_tracking_url:String(fd.get('tracking_url')||'').trim(),
            p_shipping_carrier:String(fd.get('shipping_carrier')||'').trim(),
            p_reason:String(fd.get('reason')||'').trim()
          });
          if(r.error) throw r.error;
          closeModal();
          toast('__AZICON_SUCCESS__ اطلاعات رهگیری با دلیل ثبت و در گزارش فعالیت ذخیره شد.');
          await Promise.all([loadOrders(),loadDashboard()]);
        }catch(err){
          if(st) st.textContent='__AZICON_ERROR__ '+errorText(err);
          if(btn) btn.disabled=false;
        }
      };
    }catch(err){toast('__AZICON_ERROR__ بارگذاری اصلاح رهگیری ناموفق بود: '+errorText(err));}
  }

  async function handleOrderControlAction(id, action, button) {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما اجازه عملیات سفارش ندارد.');
    if (!id) return toast('__AZICON_ERROR__ شناسه سفارش وجود ندارد.');
    if (action === 'open') {
      await openOrder(id);
      return;
    }
    if (action === 'restore') {
      if (!can.all()) return toast('__AZICON_BLOCK__ بازگردانی سفارش فقط برای مالک یا مدیر مجاز است.');
      const code = button?.dataset?.orderCode || button?.closest('.az-order-control')?.querySelector('.az-order-control-code strong')?.textContent || '';
      openRestoreCancelledOrderConfirm(code);
      return;
    }
    if (action === 'attach_payment_reference') {
      await openAttachPaymentReferenceAction(id);
      return;
    }
    if (action === 'review_payment') {
      await openOrder(id,'payment');
      return;
    }
    if (action === 'review_refund') {
      await openOrder(id,'payment');
      return;
    }
    if (action === 'record_manual_payment') {
      await openManualPaymentAction(id);
      return;
    }
    if (action === 'correct_stage') {
      await openOrderStageCorrection(id);
      return;
    }
    if (action === 'cancel_order') {
      await openAdminCancelOrder(id);
      return;
    }
    if (action === 'mark_shipped') {
      await openOrderShippingAction(id);
      return;
    }
    if (action === 'correct_shipment') {
      await openOrderShipmentCorrection(id);
      return;
    }

    const labelsByAction = {
      confirm_order:'تأیید سفارش',
      start_processing:'شروع پردازش',
      mark_packed:'ثبت بسته‌بندی',
      mark_delivered:'ثبت تحویل'
    };
    const textAction = labelsByAction[action];
    if (!textAction) return;
    if (!window.confirm('«' + textAction + '» برای این سفارش انجام شود؟')) return;
    const oldText=button?.textContent || '';
    if(button){button.disabled=true;button.textContent='در حال انجام…';}
    try{
      const r=await state.db.rpc('azim_admin_transition_order',{p_order_id:id,p_action:action});
      if(r.error) throw r.error;
      closeModal();
      toast('__AZICON_SUCCESS__ '+textAction+' با موفقیت ثبت شد.');
      await Promise.all([loadOrders(),loadDashboard()]);
    }catch(err){
      toast('__AZICON_ERROR__ '+errorText(err));
      if(button){button.disabled=false;button.textContent=oldText;}
    }
  }

  async function newOrder() {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما اجازه ساخت سفارش ندارد.');
    const c = await loadCustomersForOrder();
    await loadProductsForOrder();
    state.orderItems = [];
    openModal('سفارش جدید', orderForm(null, c, []));
    wireOrderForm(null);
  }

  function openRestoreCancelledOrderConfirm(orderCode) {
    if (!can.all()) return toast('__AZICON_BLOCK__ بازگردانی سفارش فقط برای مالک یا مدیر مجاز است.');
    const code = String(orderCode || '').trim();
    if (!code) return toast('__AZICON_ERROR__ کد سفارش برای بازگردانی موجود نیست.');

    openModal('تأیید بازگردانی سفارش لغوشده',
      '<div class="az-payment-confirm-danger">' +
        '<strong>⚠️ بررسی قبل از بازگردانی</strong>' +
        '<span>سفارش <b dir="ltr">' + esc(code) + '</b> دوباره وارد سفارش‌های جاری می‌شود.</span>' +
        '<span>وضعیت سفارش «در انتظار» و وضعیت ارسال «در انتظار ارسال» خواهد شد.</span>' +
        '<span>اطلاعات مرسوله قبلی (کد، لینک و شرکت ارسال) پاک می‌شود.</span>' +
        '<span>اگر پرداخت آنلاین قبلی عودت کامل شده باشد، سفارش برای پرداخت مجدد آماده می‌شود؛ عودتِ در حال پردازش، بازگردانی را متوقف می‌کند.</span>' +
      '</div>' +
      '<div class="mfa-status" id="restoreOrderStatus"></div>' +
      '<div class="mfa-actions">' +
        '<button class="btn" type="button" id="confirmRestoreOrderBtn">✅ تأیید بازگردانی</button>' +
        '<button class="btn secondary" type="button" onclick="closeModal()">انصراف</button>' +
      '</div>'
    );

    $('confirmRestoreOrderBtn')?.addEventListener('click', async () => {
      const status = $('restoreOrderStatus');
      const btn = $('confirmRestoreOrderBtn');
      if (btn) btn.disabled = true;
      if (!(await requireAdminMFA())) {
        if (status) status.textContent = '__AZICON_LOCK__ نشست مدیریتی باید با MFA سطح AAL2 تأیید شده باشد.';
        if (btn) btn.disabled = false;
        return;
      }
      if (status) status.textContent = 'در حال بازگردانی امن سفارش…';
      try {
        const r = await state.db.rpc('azim_admin_restore_cancelled_order', {
          p_order_code: code,
          p_actor_ref: state.user?.id ? 'admin-panel:' + state.user.id : 'admin-panel'
        });
        if (r.error) throw r.error;
        const data = r.data || {};
        closeModal();
        let message = '__AZICON_SUCCESS__ سفارش ' + esc(data.order_code || code) + ' به سفارش‌های جاری بازگردانده شد.';
        if (data.payment_method === 'online' && data.payment_status === 'cancelled') {
          message += ' پرداخت آنلاین قبلی عودت شده بوده؛ مشتری می‌تواند پرداخت جدید را از صفحه پیگیری سفارش ادامه دهد.';
        } else if (data.payment_method !== 'online' && data.payment_status === 'unpaid') {
          message += ' وضعیت پرداخت روی «پرداخت نشده» قرار گرفت.';
        }
        toast(message);
        await Promise.all([loadOrders(), loadDashboard()]);
      } catch (err) {
        if (status) status.textContent = '__AZICON_ERROR__ ' + errorText(err);
        if (btn) btn.disabled = false;
      }
    });
  }

  function readOrderItems() {
    return Array.from(document.querySelectorAll('#orderItemsBox .order-item-row')).map((row) => {
      const productId = row.querySelector('.item-product')?.value || null;
      const qtyRaw = Number(row.querySelector('.item-qty')?.value || 1);
      const qty = qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
      const price = Number(row.querySelector('.item-price')?.value || 0);
      const variantLabel = String(row.querySelector('.item-variant')?.value || '').trim();
      const orderProducts = state.orderProducts.length ? state.orderProducts : state.products;
      const product = orderProducts.find((p) => p.id === productId);
      const orderItemId = row.dataset.itemId || null;
      return productId ? {
        order_item_id: orderItemId,
        product_id: productId,
        product_name: product?.name || 'محصول',
        sku: product?.code || null,
        quantity: qty,
        unit_price: price >= 0 ? Math.floor(price) : 0,
        line_total: qty * (price >= 0 ? Math.floor(price) : 0),
        variant: variantLabel ? { label: variantLabel } : null
      } : null;
    }).filter(Boolean);
  }

  function updateOrderItemTotals() {
    const form = $('orderForm');
    let subtotal = 0;
    document.querySelectorAll('#orderItemsBox .order-item-row').forEach((row) => {
      const q = Number(row.querySelector('.item-qty')?.value || 1);
      const p = Number(row.querySelector('.item-price')?.value || 0);
      const safeQ = Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;
      const safeP = Number.isFinite(p) && p >= 0 ? Math.floor(p) : 0;
      const line = safeQ * safeP;
      subtotal += line;
      const total = row.querySelector('.item-total');
      if (total) total.value = String(line);
    });
    if (form) {
      const shipping = Number(form.elements.shipping_cost?.value || 0);
      const discount = Number(form.elements.discount?.value || 0);
      const finalTotal = Math.max(0, subtotal + (Number.isFinite(shipping) && shipping >= 0 ? Math.floor(shipping) : 0) - (Number.isFinite(discount) && discount >= 0 ? Math.floor(discount) : 0));
      if (form.elements.total) form.elements.total.value = String(finalTotal);
      if ($('orderTotalPreview')) $('orderTotalPreview').textContent = 'جمع اقلام: ' + money(subtotal) + ' · ارسال: ' + money(shipping) + ' · تخفیف: ' + money(discount) + ' · نهایی: ' + money(finalTotal);
    }
  }

  function addOrderItemRow(it = null) {
    const box = $('orderItemsBox');
    if (!box) return;
    if (box.querySelector('.empty')) box.innerHTML = '';
    const idx = box.querySelectorAll('.order-item-row').length;
    box.insertAdjacentHTML('beforeend', orderItemRow(it, idx));
    updateOrderItemTotals();
  }

  function wireOrderForm(id) {
    $('orderForm').dataset.orderId = id || '';
    $('orderForm').onsubmit = (e) => saveOrder(e, id);
    $('addOrderItemBtn').onclick = () => addOrderItemRow();
    $('orderItemsBox').addEventListener('input', (e) => {
      if (e.target.classList.contains('item-qty') || e.target.classList.contains('item-price')) updateOrderItemTotals();
    });
    $('orderItemsBox').addEventListener('change', (e) => {
      if (e.target.classList.contains('item-product')) {
        const row = e.target.closest('.order-item-row');
        const sourceProducts = state.orderProducts.length ? state.orderProducts : state.products;
        const p = sourceProducts.find((x) => x.id === e.target.value);
        const price = row.querySelector('.item-price');
        if (p && price && !Number(price.value)) price.value = directProductDiscountPrice(p.price || 0, p);
        updateOrderItemTotals();
      }
    });
    $('orderItemsBox').addEventListener('click', (e) => {
      if (e.target.closest('.remove-item')) {
        e.target.closest('.order-item-row')?.remove();
        if (!document.querySelector('#orderItemsBox .order-item-row')) $('orderItemsBox').innerHTML = '<div class="empty">قلمی اضافه نشده.</div>';
        updateOrderItemTotals();
      }
    });
    $('applyOrderDiscountBtn')?.addEventListener('click', () => applyOrderDiscount(true));
    $('orderForm')?.elements?.customer_id?.addEventListener('change', () => {
      if ($('orderForm')?.elements?.discount_code?.value.trim()) applyOrderDiscount(false);
    });
    $('orderForm')?.elements?.discount_code?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyOrderDiscount(true); }
    });
    $('orderForm')?.elements?.shipping_cost?.addEventListener('input', () => updateOrderItemTotals());
    $('orderForm')?.elements?.shipping_cost?.addEventListener('change', () => updateOrderItemTotals());
    updateOrderItemTotals();
  }

  async function saveOrder(e, id) {
    e.preventDefault();
    const s = e.target.elements;
    const status = $('orderStatus');
    try {
      const items = readOrderItems();
      const customerId = s.customer_id.value || null;
      const discountCode = s.discount_code?.value.trim() || '';
      if (!s.order_code.value.trim()) throw new Error('کد سفارش الزامی است.');
      if (!items.length) throw new Error('حداقل یک قلم برای سفارش لازم است.');

      // Client-side preview is only UX; the database function is authoritative.
      const preview = await calculateAdminDiscount(discountCode, customerId, items, items.reduce((sum, it) => sum + it.line_total, 0), id || null);
      if (discountCode && preview.reason !== 'کد تخفیف معتبر است.') throw new Error(preview.reason);

      const rpc = await state.db.rpc('azim_save_order_with_discount', {
        p_order_id: id || null,
        p_order_code: s.order_code.value.trim(),
        p_customer_id: customerId,
        p_status: s.status.value,
        p_payment_status: s.payment_status.value,
        p_shipping_status: s.shipping_status.value,
        p_shipping_cost: Number(s.shipping_cost.value || 0),
        p_tracking_code: s.tracking_code.value.trim() || null,
        p_notes: s.notes.value.trim() || null,
        p_discount_code: discountCode || null,
        p_items: items,
        p_tracking_url: s.tracking_url?.value.trim() || null,
        p_shipping_carrier: s.shipping_carrier?.value.trim() || null
      });
      if (rpc.error) throw rpc.error;

      const saved = rpc.data || {};
      if ($('orderDiscountStatus')) {
        $('orderDiscountStatus').textContent = saved.discount
          ? 'تخفیف نهایی تأیید شد • ' + money(saved.discount)
          : (discountCode ? 'کد معتبر بود اما مبلغ تخفیف صفر شد.' : 'بدون کد تخفیف');
      }
      await audit(id ? 'update' : 'create', 'orders', saved.order_id || id || 'new', {
        order_code: s.order_code.value.trim(),
        total: Number(saved.total || 0),
        discount: Number(saved.discount || 0),
        discount_id: saved.discount_id || null,
        discount_code: saved.discount_code || null,
        items: items.length
      });
      closeModal();
      toast('__AZICON_SUCCESS__ سفارش با محاسبه نهایی تخفیف ذخیره شد');
      await Promise.all([loadOrders(), loadDashboard()]);
    } catch (err) {
      if (status) status.textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  // ===== DISCOUNT / PROMOTION ENGINE =====
  const discountState = { rows: [], products: [], categories: [], brands: [], customers: [], selectedCustomerId: null, stats: {} };

  function discountBadge(x) {
    const now = Date.now(), start = new Date(x.starts_at).getTime(), end = x.ends_at ? new Date(x.ends_at).getTime() : Infinity;
    if (!x.is_active) return '<span class="badge red">خاموش</span>';
    if (now < start) return '<span class="badge warn">زمان‌بندی شده</span>';
    if (now > end) return '<span class="badge red">منقضی</span>';
    if (x.usage_limit != null && Number(x.used_count || 0) >= Number(x.usage_limit)) return '<span class="badge red">سقف مصرف</span>';
    return '<span class="badge ok">فعال</span>';
  }

  function discountValueText(x) {
    return x.discount_type === 'percentage' ? Number(x.value).toLocaleString('fa-IR') + '٪' : money(x.value);
  }

  async function loadDiscountReferenceData() {
    const [p,c,b,cu] = await Promise.all([
      state.db.from('products').select('id,name,code,brand,category_name').order('name').limit(1000),
      state.db.from('categories').select('id,name,slug').order('sort_order').order('name'),
      state.db.from('brands').select('id,name').order('sort_order').order('name'),
      state.db.from('customers').select('id,full_name,mobile,email').order('full_name').limit(1000)
    ]);
    if (p.error) throw p.error;
    if (c.error) throw c.error;
    if (b.error) throw b.error;
    if (cu.error) throw cu.error;
    discountState.products = p.data || [];
    discountState.categories = c.data || [];
    discountState.brands = b.data || [];
    discountState.customers = cu.data || [];
  }

  async function fetchDiscountData() {
    const [d,s] = await Promise.all([
      state.db.from('discounts').select('*').order('priority',{ascending:false}).order('created_at',{ascending:false}).limit(500),
      state.db.rpc('azim_discount_stats')
    ]);
    if (d.error) throw d.error;
    if (s.error) throw s.error;
    const stats = {};
    (s.data || []).forEach(x => { stats[x.discount_id] = x; });
    discountState.stats = stats;
    discountState.rows = (d.data || []).map(x => ({
      ...x,
      used_count: Number(stats[x.id]?.used_count || 0),
      total_discount: Number(stats[x.id]?.total_discount || 0),
      last_used_at: stats[x.id]?.last_used_at || null
    }));
    return discountState.rows;
  }

  async function loadDiscounts() {
    const box = $('discountsTable');
    if (!box) return;
    try {
      await fetchDiscountData();
      const active = discountState.rows.filter(x => x.is_active).length;
      const codes = discountState.rows.filter(x => x.code).length;
      const auto = discountState.rows.filter(x => x.auto_apply).length;
      $('discountStatTotal').textContent = discountState.rows.length.toLocaleString('fa-IR');
      $('discountStatActive').textContent = active.toLocaleString('fa-IR');
      $('discountStatCodes').textContent = codes.toLocaleString('fa-IR');
      $('discountStatAuto').textContent = auto.toLocaleString('fa-IR');
      renderDiscounts();
    } catch (err) {
      showSectionError('discountsTable', err);
    }
  }

  function renderDiscounts() {
    const term = ($('discountSearch')?.value || '').trim().toLocaleLowerCase('fa');
    const status = $('discountFilterStatus')?.value || '';
    const type = $('discountFilterType')?.value || '';
    const rows = discountState.rows.filter(x => {
      const hay = [x.name,x.code].filter(Boolean).join(' ').toLocaleLowerCase('fa');
      const now = Date.now(), start = new Date(x.starts_at).getTime(), end = x.ends_at ? new Date(x.ends_at).getTime() : Infinity;
      let state = x.is_active ? (now < start ? 'scheduled' : (now > end ? 'expired' : 'active')) : 'off';
      if (status && state !== status) return false;
      if (type && x.discount_type !== type) return false;
      return !term || hay.includes(term);
    });
    if (!rows.length) {
      $('discountsTable').innerHTML = '<div class="empty">تخفیفی مطابق فیلترها پیدا نشد.</div>';
      return;
    }
    const body = rows.map(x => {
      const target = x.applies_to === 'all' ? 'همه محصولات' :
        x.applies_to === 'products' ? 'محصولات انتخابی' :
        x.applies_to === 'categories' ? 'دسته‌ها' :
        x.applies_to === 'brands' ? 'برندها' : 'مشتریان انتخابی';
      const usage = x.usage_limit == null ? Number(x.used_count||0).toLocaleString('fa-IR') + ' / ∞' : Number(x.used_count||0).toLocaleString('fa-IR') + ' / ' + Number(x.usage_limit).toLocaleString('fa-IR');
      return '<tr>' +
        '<td><strong>' + esc(x.name) + '</strong><div class="muted">' + esc(x.notes || '') + '</div></td>' +
        '<td><code dir="ltr">' + esc(x.code || 'بدون کد') + '</code></td>' +
        '<td>' + discountValueText(x) + (x.max_discount ? '<div class="muted">سقف ' + money(x.max_discount) + '</div>' : '') + '</td>' +
        '<td>' + esc(target) + (x.auto_apply ? '<div><span class="badge warn">خودکار</span></div>' : '') + '</td>' +
        '<td>' + usage + '</td><td>' + discountBadge(x) + '</td>' +
        '<td>' + dateFa(x.starts_at,false) + '<br>' + (x.ends_at ? dateFa(x.ends_at,false) : 'بدون پایان') + '</td>' +
        '<td>' +
          (can.all() ? '<button class="btn secondary" data-edit-discount="' + x.id + '">ویرایش</button> <button class="btn ghost" data-toggle-discount="' + x.id + '">' + (x.is_active ? 'خاموش' : 'روشن') + '</button> <button class="btn ghost" data-delete-discount="' + x.id + '">حذف</button>' : '') +
        '</td></tr>';
    }).join('');
    $('discountsTable').innerHTML =
      '<div class="table-wrap"><table class="table"><thead><tr><th>نام</th><th>کد</th><th>ارزش</th><th>اعمال</th><th>مصرف</th><th>وضعیت</th><th>بازه</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function discountForm(x, presetCustomerId = null, presetProductId = null) {
    const isEdit = !!x;
    const current = x || {};
    const scope = current.applies_to || (presetProductId ? 'products' : (presetCustomerId ? 'customers' : 'all'));
    const values = current.value ?? 10;
    const starts = current.starts_at ? new Date(current.starts_at).toISOString().slice(0,16) : new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    const ends = current.ends_at ? new Date(current.ends_at).toISOString().slice(0,16) : '';
    const customerName = presetCustomerId ? (discountState.customers.find(c=>c.id===presetCustomerId)?.full_name || '') : '';
    const productName = presetProductId ? (discountState.products.find(p=>p.id===presetProductId)?.name || '') : '';
    return '<form id="discountForm" class="grid2">' +
      '<div class="field full"><label>عنوان تخفیف *</label><input class="input" name="name" required value="' + esc(current.name) + '" placeholder="مثلاً تخفیف تابستانه"></div>' +
      '<div class="field"><label>کد تخفیف</label><div class="az-coupon-code-row"><input class="input" name="code" dir="ltr" value="' + esc(current.code || '') + '" placeholder="مثلاً AZIM20" autocomplete="off"><button type="button" class="btn secondary" id="generateDiscountCodeBtn">⚡ تولید کد</button></div><small class="field-hint">کد با حروف بزرگ ذخیره می‌شود و تکراری بودن آن در دیتابیس کنترل می‌شود.</small></div>' +
      '<div class="field"><label>نوع تخفیف *</label><select class="select" name="discount_type"><option value="percentage" ' + (current.discount_type !== 'fixed' ? 'selected' : '') + '>درصدی</option><option value="fixed" ' + (current.discount_type === 'fixed' ? 'selected' : '') + '>مبلغ ثابت</option></select></div>' +
      '<div class="field"><label>مقدار *</label><input class="input" name="value" type="number" min="1" step="1" required value="' + esc(values) + '"><small class="field-hint">برای درصد: ۱ تا ۱۰۰ / برای مبلغ: تومان</small></div>' +
      '<div class="field"><label>سقف تخفیف (تومان)</label><input class="input" name="max_discount" type="number" min="0" value="' + esc(current.max_discount ?? '') + '"></div>' +
      '<div class="field"><label>حداقل مبلغ سفارش</label><input class="input" name="min_order_amount" type="number" min="0" value="' + esc(current.min_order_amount ?? 0) + '"></div>' +
      '<div class="field"><label>شروع</label><input class="input" name="starts_at" type="datetime-local" value="' + esc(starts) + '"></div>' +
      '<div class="field"><label>پایان</label><input class="input" name="ends_at" type="datetime-local" value="' + esc(ends) + '"></div>' +
      '<div class="field"><label>سقف کل استفاده</label><input class="input" name="usage_limit" type="number" min="1" value="' + esc(current.usage_limit ?? '') + '" placeholder="خالی = نامحدود"></div>' +
      '<div class="field"><label>حداکثر استفاده هر مشتری</label><input class="input" name="per_customer_limit" type="number" min="1" value="' + esc(current.per_customer_limit ?? 1) + '"></div>' +
      '<div class="field"><label>اولین خرید فقط</label><label class="check"><input name="first_order_only" type="checkbox" ' + (current.first_order_only ? 'checked' : '') + '> فقط برای مشتریِ بدون سفارش</label></div>' +
      '<div class="field"><label>اعمال خودکار</label><label class="check"><input name="auto_apply" type="checkbox" ' + (current.auto_apply ? 'checked' : '') + '> بدون نیاز به کد در سفارش</label></div>' +
      '<div class="field"><label>اولویت</label><input class="input" name="priority" type="number" value="' + esc(current.priority ?? 0) + '"></div>' +
      '<div class="field"><label>دامنه اعمال *</label><select class="select" name="applies_to"><option value="all" ' + (scope==='all'?'selected':'') + '>همه محصولات</option><option value="products" ' + (scope==='products'?'selected':'') + '>محصولات انتخابی</option><option value="categories" ' + (scope==='categories'?'selected':'') + '>دسته‌بندی‌های انتخابی</option><option value="brands" ' + (scope==='brands'?'selected':'') + '>برندهای انتخابی</option><option value="customers" ' + (scope==='customers'?'selected':'') + '>مشتریان انتخابی</option></select></div>' +
      '<div class="field full"><div class="discount-target-wrap"><div class="discount-target-head"><strong>انتخاب موارد مشمول</strong><span id="discountTargetCount" class="badge">۰ انتخاب</span></div><div id="discountTargetBox"></div></div></div>' +
      '<div class="field full"><label>یادداشت داخلی</label><textarea class="textarea" name="notes">' + esc(current.notes || '') + '</textarea></div>' +
      '<label class="check field full"><input name="is_active" type="checkbox" ' + (current.is_active === false ? '' : 'checked') + '> فعال</label>' +
      (presetCustomerId ? '<div class="field full"><div class="badge ok">🎁 تخفیف اختصاصی برای: ' + esc(customerName) + '</div></div>' : '') +
      (presetProductId ? '<div class="field full"><div class="badge ok">🏷️ محصول انتخاب‌شده: ' + esc(productName || 'محصول') + '</div></div>' : '') +
      '<div class="field full"><div class="tools"><button class="btn" type="submit">ذخیره تخفیف</button><button class="btn secondary" type="button" id="discountPreviewBtn">پیش‌نمایش منطق</button></div></div><div id="discountStatus" class="status field full"></div>' +
      '</form>';
  }

  async function loadDiscountTargets(x, presetCustomerId = null, presetProductId = null) {
    const form = $('discountForm');
    const box = $('discountTargetBox');
    if (!form || !box) return;
    const scope = form.elements.applies_to.value;
    let selected = new Set();
    if (x && scope !== 'all') {
      const table = scope === 'products' ? 'discount_products' : scope === 'categories' ? 'discount_categories' : scope === 'brands' ? 'discount_brands' : 'discount_customers';
      const r = await state.db.from(table).select(scope === 'products' ? 'product_id' : scope === 'categories' ? 'category_id' : scope === 'brands' ? 'brand_id' : 'customer_id').eq('discount_id', x.id);
      if (r.error) return showTargetError(r.error);
      selected = new Set((r.data || []).map(v => v.product_id || v.category_id || v.brand_id || v.customer_id));
    }
    if (presetCustomerId) selected.add(presetCustomerId);
    if (presetProductId && scope === 'products') selected.add(presetProductId);

    if (scope === 'all') {
      box.innerHTML = '<div class="empty">این تخفیف روی همه محصولات اعمال می‌شود؛ انتخاب دیگری لازم نیست.</div>';
      updateDiscountTargetCount();
      return;
    }

    const list = scope === 'products' ? discountState.products :
      scope === 'categories' ? discountState.categories :
      scope === 'brands' ? discountState.brands : discountState.customers;

    const titleKey = scope === 'products' ? 'نام محصول' : scope === 'categories' ? 'نام دسته' : scope === 'brands' ? 'نام برند' : 'مشتری';
    box.innerHTML =
      '<input id="discountTargetSearch" class="input discount-target-search" placeholder="جستجو در ' + titleKey + '…">' +
      '<div id="discountTargetList" class="discount-target-list">' +
      list.map(item => {
        const id = item.id, name = scope === 'customers' ? (item.full_name + ' · ' + item.mobile) : item.name;
        return '<label class="discount-target-item"><input type="checkbox" data-target-id="' + id + '" ' + (selected.has(id) ? 'checked' : '') + '><span>' + esc(name) + '</span></label>';
      }).join('') +
      '</div>';
    $('discountTargetSearch').oninput = () => {
      const q = $('discountTargetSearch').value.trim().toLocaleLowerCase('fa');
      document.querySelectorAll('#discountTargetList .discount-target-item').forEach(el => {
        el.style.display = el.textContent.toLocaleLowerCase('fa').includes(q) ? '' : 'none';
      });
    };
    $('discountTargetList').addEventListener('change', updateDiscountTargetCount);
    updateDiscountTargetCount();
  }

  function showTargetError(err) {
    $('discountTargetBox').innerHTML = '<div class="empty">خطا: ' + esc(errorText(err)) + '</div>';
  }

  function updateDiscountTargetCount() {
    const n = document.querySelectorAll('#discountTargetList input[data-target-id]:checked').length;
    if ($('discountTargetCount')) $('discountTargetCount').textContent = n.toLocaleString('fa-IR') + ' انتخاب';
  }

  async function openDiscountEditor(id, presetCustomerId = null, codeOnly = false, presetProductId = null) {
    if (!can.all()) return toast('__AZICON_BLOCK__ فقط مالک/مدیر ارشد می‌تواند تخفیف بسازد.');
    await loadDiscountReferenceData();
    let x = id ? discountState.rows.find(r => r.id === id) : null;
    if (id && !x) {
      const r = await state.db.from('discounts').select('*').eq('id', id).single();
      if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
      x = r.data;
    }
    const title = id ? 'ویرایش تخفیف' : (presetProductId ? 'کد تخفیف محصول' : (presetCustomerId ? 'تخفیف اختصاصی مشتری' : (codeOnly ? 'ساخت کد تخفیف' : 'ساخت تخفیف جدید')));
    openModal(title, discountForm(x || null, presetCustomerId, presetProductId));
    const form = $('discountForm');
    if (codeOnly || presetProductId) form.dataset.codeRequired = '1';
    form.onsubmit = (e) => saveDiscount(e, id, presetCustomerId, presetProductId);
    form.elements.applies_to.onchange = () => loadDiscountTargets(x || null, presetCustomerId, presetProductId);
    $('discountPreviewBtn').onclick = () => previewDiscountLogic(form);
    $('generateDiscountCodeBtn')?.addEventListener('click', () => {
      form.elements.code.value = generateDiscountCode();
      form.elements.code.dispatchEvent(new Event('input', {bubbles:true}));
      form.elements.code.focus();
    });
    form.elements.code?.addEventListener('input', () => {
      const at = form.elements.code.selectionStart;
      form.elements.code.value = form.elements.code.value.toUpperCase().replace(/\s+/g,'');
      try { form.elements.code.setSelectionRange(at, at); } catch (_) {}
    });
    await loadDiscountTargets(x || null, presetCustomerId, presetProductId);
  }

  function previewDiscountLogic(form) {
    const s = form.elements;
    const type = s.discount_type.value;
    const val = Number(s.value.value || 0);
    const max = Number(s.max_discount.value || 0);
    const min = Number(s.min_order_amount.value || 0);
    const exampleBase = Math.max(min || 1000000, 1000000);
    let d = type === 'percentage' ? Math.floor(exampleBase * val / 100) : val;
    if (max > 0) d = Math.min(d,max);
    const remaining = Math.max(0, exampleBase - d);
    $('discountStatus').textContent = 'نمونه روی سفارش ' + money(exampleBase) + ': تخفیف ' + money(d) + ' ← مبلغ پس از تخفیف ' + money(remaining);
  }

  async function saveDiscount(e, id, presetCustomerId = null, presetProductId = null) {
    e.preventDefault();
    if (!can.all()) return toast('__AZICON_BLOCK__ فقط مالک/مدیر ارشد می‌تواند تخفیف را مدیریت کند.');
    const s = e.target.elements;
    const status = $('discountStatus');
    const saveBtn = e.target.querySelector('button[type="submit"]');
    try {
      const name = s.name.value.trim();
      const code = s.code.value.trim().toUpperCase().replace(/\s+/g,'');
      const type = s.discount_type.value;
      const value = Number(s.value.value || 0);
      const min = Number(s.min_order_amount.value || 0);
      const max = s.max_discount.value === '' ? null : Number(s.max_discount.value);
      const usage = s.usage_limit.value === '' ? null : Number(s.usage_limit.value);
      const per = Number(s.per_customer_limit.value || 1);
      const starts = s.starts_at.value ? new Date(s.starts_at.value).toISOString() : new Date().toISOString();
      const ends = s.ends_at.value ? new Date(s.ends_at.value).toISOString() : null;
      const scope = s.applies_to.value;
      const checked = Array.from(document.querySelectorAll('#discountTargetList input[data-target-id]:checked')).map(el=>el.dataset.targetId).filter(Boolean);

      if (!name) throw new Error('عنوان تخفیف الزامی است.');
      if (e.target.dataset.codeRequired === '1' && !code) throw new Error('کد تخفیف برای این بخش الزامی است.');
      if (code && !/^[A-Z0-9_-]{2,50}$/.test(code)) throw new Error('فرمت کد تخفیف نامعتبر است.');
      if (type === 'percentage' && (value < 1 || value > 100)) throw new Error('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.');
      if (type === 'fixed' && value < 1) throw new Error('مبلغ تخفیف باید بیشتر از صفر باشد.');
      if (min < 0) throw new Error('حداقل مبلغ سفارش نمی‌تواند منفی باشد.');
      if (max != null && (!Number.isFinite(max) || max < 0)) throw new Error('سقف تخفیف نامعتبر است.');
      if (usage != null && (!Number.isInteger(usage) || usage < 1)) throw new Error('سقف استفاده باید حداقل ۱ باشد.');
      if (!Number.isInteger(per) || per < 1) throw new Error('حداکثر استفاده هر مشتری باید حداقل ۱ باشد.');
      if (scope !== 'all' && !checked.length) throw new Error('برای این دامنه حداقل یک مورد را انتخاب کن.');
      if (scope === 'all' && checked.length) throw new Error('برای تخفیف کلی نباید موردی انتخاب شده باشد.');
      if (ends && new Date(ends) <= new Date(starts)) throw new Error('پایان باید بعد از شروع باشد.');

      if (saveBtn) saveBtn.disabled = true;
      const r = await state.db.rpc('azim_save_discount', {
        p_id: id || null,
        p_name: name,
        p_code: code || null,
        p_discount_type: type,
        p_value: Math.floor(value),
        p_max_discount: max == null ? null : Math.floor(max),
        p_min_order_amount: Math.floor(min),
        p_starts_at: starts,
        p_ends_at: ends,
        p_usage_limit: usage == null ? null : Math.floor(usage),
        p_per_customer_limit: Math.floor(per),
        p_first_order_only: !!s.first_order_only.checked,
        p_auto_apply: !!s.auto_apply.checked,
        p_applies_to: scope,
        p_priority: Number.isFinite(Number(s.priority.value)) ? Math.floor(Number(s.priority.value)) : 0,
        p_is_active: !!s.is_active.checked,
        p_notes: s.notes.value.trim() || null,
        p_targets: checked
      });
      if (r.error) throw r.error;

      const rid = r.data?.id || id;
      await audit(id ? 'update' : 'create', 'discounts', rid, {
        name, code: code || null, scope, type, value: Math.floor(value), targets: checked.length
      });
      closeModal();
      toast('__AZICON_SUCCESS__ تخفیف ذخیره شد');
      await loadDiscounts();
      await loadDiscountCodes();
    } catch (err) {
      if (status) status.textContent = '__AZICON_ERROR__ ' + errorText(err);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function toggleDiscount(id) {
    if (!can.all()) return;
    const x = discountState.rows.find(r=>r.id===id);
    if (!x) return;
    const r = await state.db.from('discounts').update({is_active:!x.is_active,updated_at:new Date().toISOString()}).eq('id',id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('toggle','discounts',id,{is_active:!x.is_active});
    await loadDiscounts();
    await loadDiscountCodes();
  }

  async function deleteDiscount(id) {
    if (!can.all()) return;
    const x = discountState.rows.find(r=>r.id===id);
    if (!x) return;
    if (!confirm('این تخفیف و اتصال‌های آن حذف شود؟')) return;
    const r = await state.db.from('discounts').delete().eq('id',id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('delete','discounts',id,{name:x.name,code:x.code});
    toast('__AZICON_SUCCESS__ تخفیف حذف شد');
    await loadDiscounts();
    await loadDiscountCodes();
  }

  async function calculateAdminDiscount(code, customerId, items, subtotal, excludeOrderId = null) {
    const normalized = String(code || '').trim().toUpperCase();
    const r = normalized
      ? await state.db.from('discounts').select('*').eq('code',normalized).maybeSingle()
      : await state.db.from('discounts').select('*').eq('auto_apply',true).eq('is_active',true).order('priority',{ascending:false}).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (r.error) throw r.error;
    const x = r.data;
    if (!x) return {discount:0,row:null,reason:'کد تخفیف پیدا نشد.'};
    const now = Date.now(), start = new Date(x.starts_at).getTime(), end = x.ends_at ? new Date(x.ends_at).getTime() : Infinity;
    if (!x.is_active) return {discount:0,row:x,reason:'این تخفیف غیرفعال است.'};
    if (now < start) return {discount:0,row:x,reason:'زمان شروع این تخفیف نرسیده است.'};
    if (now > end) return {discount:0,row:x,reason:'این تخفیف منقضی شده است.'};
    if (subtotal < Number(x.min_order_amount || 0)) return {discount:0,row:x,reason:'مبلغ سفارش به حداقل لازم نرسیده است.'};
    let usedQ = state.db.from('discount_redemptions').select('id',{count:'exact',head:true}).eq('discount_id',x.id);
    if (excludeOrderId) usedQ = usedQ.neq('order_id', excludeOrderId);
    const used = await usedQ;
    if (used.error) throw used.error;
    if (x.usage_limit != null && Number(used.count || 0) >= Number(x.usage_limit)) return {discount:0,row:x,reason:'سقف استفاده از این کد تکمیل شده است.'};
    if (customerId) {
      let customerUsesQ = state.db.from('discount_redemptions').select('id',{count:'exact',head:true}).eq('discount_id',x.id).eq('customer_id',customerId);
      if (excludeOrderId) customerUsesQ = customerUsesQ.neq('order_id', excludeOrderId);
      const customerUses = await customerUsesQ;
      if (customerUses.error) throw customerUses.error;
      if (Number(customerUses.count || 0) >= Number(x.per_customer_limit || 1)) return {discount:0,row:x,reason:'این مشتری قبلاً بیش از حد مجاز از کد استفاده کرده است.'};
    }
    if (x.first_order_only) {
      if (!customerId) return {discount:0,row:x,reason:'این تخفیف فقط برای مشتریِ ثبت‌شده و اولین خرید است.'};
      let ordq = state.db.from('orders').select('id').eq('customer_id',customerId).neq('status','cancelled');
      if (excludeOrderId) ordq = ordq.neq('id', excludeOrderId);
      const ord = await ordq.limit(1);
      if (ord.error) throw ord.error;
      if ((ord.data||[]).length) return {discount:0,row:x,reason:'این تخفیف فقط برای اولین خرید است.'};
    }
    if (x.applies_to === 'customers') {
      if (!customerId) return {discount:0,row:x,reason:'برای این کد باید مشتری انتخاب شود.'};
      const ok = await state.db.from('discount_customers').select('customer_id').eq('discount_id',x.id).eq('customer_id',customerId).maybeSingle();
      if (ok.error) throw ok.error;
      if (!ok.data) return {discount:0,row:x,reason:'این کد برای این مشتری تعریف نشده است.'};
    }

    let eligibleSubtotal = subtotal;
    if (x.applies_to !== 'all') {
      const ids = items.map(i=>i.product_id).filter(Boolean);
      if (x.applies_to === 'products') {
        const q = await state.db.from('discount_products').select('product_id').eq('discount_id',x.id).in('product_id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);
        if (q.error) throw q.error;
        const allowed = new Set((q.data||[]).map(v=>v.product_id));
        eligibleSubtotal = items.filter(i=>allowed.has(i.product_id)).reduce((s,i)=>s+i.line_total,0);
      } else {
        const prodRows = await state.db.from('products').select('id,brand,category_name').in('id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);
        if (prodRows.error) throw prodRows.error;
        const map = Object.fromEntries((prodRows.data||[]).map(v=>[v.id,v]));
        let allowed = new Set();
        if (x.applies_to === 'categories') {
          const q = await state.db.from('discount_categories').select('category_id').eq('discount_id',x.id);
          if (q.error) throw q.error;
          const catIds = new Set((q.data||[]).map(v=>v.category_id));
          const cats = await state.db.from('categories').select('id,name').in('id',[...catIds].length?[...catIds]:['00000000-0000-0000-0000-000000000000']);
          if (cats.error) throw cats.error;
          const names = new Set((cats.data||[]).map(v=>v.name));
          allowed = new Set(items.filter(i=>names.has(map[i.product_id]?.category_name)).map(i=>i.product_id));
        } else if (x.applies_to === 'brands') {
          const q = await state.db.from('discount_brands').select('brand_id').eq('discount_id',x.id);
          if (q.error) throw q.error;
          const brandIds = new Set((q.data||[]).map(v=>v.brand_id));
          const brands = await state.db.from('brands').select('id,name').in('id',[...brandIds].length?[...brandIds]:['00000000-0000-0000-0000-000000000000']);
          if (brands.error) throw brands.error;
          const names = new Set((brands.data||[]).map(v=>v.name));
          allowed = new Set(items.filter(i=>names.has(map[i.product_id]?.brand)).map(i=>i.product_id));
        }
        eligibleSubtotal = items.filter(i=>allowed.has(i.product_id)).reduce((s,i)=>s+i.line_total,0);
      }
    }
    if (eligibleSubtotal <= 0) return {discount:0,row:x,reason:'هیچ قلم مشمول این تخفیف در سفارش نیست.'};
    let amount = x.discount_type === 'percentage' ? Math.floor(eligibleSubtotal * Number(x.value) / 100) : Number(x.value);
    if (x.max_discount != null) amount = Math.min(amount, Number(x.max_discount));
    amount = Math.min(amount, eligibleSubtotal);
    return {discount:Math.max(0,amount),row:x,reason:'کد تخفیف معتبر است.'};
  }

  async function applyOrderDiscount(showToast = true) {
    const form = $('orderForm');
    if (!form) return;
    const items = readOrderItems();
    const subtotal = items.reduce((s,i)=>s+i.line_total,0);
    const customerId = form.elements.customer_id.value || null;
    const code = form.elements.discount_code.value.trim();
    const out = $('orderDiscountStatus');
    const total = $('orderTotalPreview');
    try {
      const result = await calculateAdminDiscount(code,customerId,items,subtotal,form.dataset.orderId || null);
      if (out) out.textContent = result.reason + (result.discount ? ' • تخفیف: ' + money(result.discount) : '');
      form.elements.discount.value = String(result.discount);
      if (form.elements.total) form.elements.total.value = String(Math.max(0, subtotal + Number(form.elements.shipping_cost.value||0) - result.discount));
      if (total) total.textContent = 'جمع اقلام: ' + money(subtotal) + ' · ارسال: ' + money(Number(form.elements.shipping_cost.value||0)) + ' · تخفیف: ' + money(result.discount) + ' · نهایی: ' + money(Math.max(0, subtotal + Number(form.elements.shipping_cost.value||0) - result.discount));
      form.dataset.discountId = result.row?.id || '';
      if (showToast) toast(result.discount ? '__AZICON_SUCCESS__ تخفیف اعمال شد' : result.reason);
    } catch (err) {
      if (out) out.textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  function ensureDiscountSection() {
    const main = document.querySelector('.main');
    if (!main || $('view-discounts')) return;
    const sec = document.createElement('section');
    sec.id = 'view-discounts';
    sec.className = 'view';
    sec.innerHTML =
      '<div class="az-discount-shell">' +
        '<div class="az-discount-hero"><div><span class="az-section-kicker">SALES ENGINE · DISCOUNTS</span><h2>تخفیف و پروموشن</h2><p>ساخت کد تخفیف، تخفیف خودکار، تخفیف محصول و تخفیف اختصاصی مشتری.</p></div><div class="tools"><button id="newDiscountBtn" class="btn">＋ ساخت تخفیف</button></div></div>' +
        '<div class="cards az-discount-stats">' +
          '<div class="card"><div class="k">همه تخفیف‌ها</div><div id="discountStatTotal" class="v">—</div><div class="s">کمپین و کد</div></div>' +
          '<div class="card"><div class="k">فعال</div><div id="discountStatActive" class="v">—</div><div class="s">قابل استفاده</div></div>' +
          '<div class="card"><div class="k">کدها</div><div id="discountStatCodes" class="v">—</div><div class="s">دارای کد</div></div>' +
          '<div class="card"><div class="k">خودکار</div><div id="discountStatAuto" class="v">—</div><div class="s">بدون کد</div></div>' +
        '</div>' +
        '<div class="panel"><div class="panel-head"><h2>مدیریت تخفیف‌ها</h2><div class="tools"><input id="discountSearch" class="input" placeholder="نام یا کد تخفیف…"><select id="discountFilterStatus" class="select"><option value="">همه وضعیت‌ها</option><option value="active">فعال</option><option value="scheduled">زمان‌بندی شده</option><option value="expired">منقضی</option><option value="off">خاموش</option></select><select id="discountFilterType" class="select"><option value="">همه انواع</option><option value="percentage">درصدی</option><option value="fixed">مبلغ ثابت</option></select></div></div><div id="discountsTable" class="table-wrap"></div></div>' +
      '</div>';
    main.appendChild(sec);
    $('newDiscountBtn').onclick = () => openDiscountEditor(null);
    $('discountSearch').oninput = renderDiscounts;
    $('newDiscountBtn').style.display = can.all() ? '' : 'none';
    $('discountFilterStatus').onchange = renderDiscounts;
    $('discountFilterType').onchange = renderDiscounts;
  }

  function ensureDiscountCodeSection() {
    const main = document.querySelector('.main');
    if (!main || $('view-discount-codes')) return;
    const sec = document.createElement('section');
    sec.id = 'view-discount-codes';
    sec.className = 'view';
    sec.innerHTML =
      '<div class="az-discount-shell">' +
        '<div class="az-discount-hero"><div><span class="az-section-kicker">CUSTOMER COUPON CENTER</span><h2>مرکز کدهای تخفیف</h2><p>کدهای عمومی، اولین‌خرید، حداقل‌سبد، محدود به محصول/دسته/برند یا اختصاصی برای مشتری؛ با قوانین قابل کنترل.</p></div><div class="tools"><button id="newDiscountCodeBtn" class="btn">＋ ساخت کد تخفیف</button></div></div>' +
        '<div class="cards az-discount-stats">' +
          '<div class="card"><div class="k">کدهای فعال</div><div id="discountCodeStatActive" class="v">—</div><div class="s">قابل استفاده</div></div>' +
          '<div class="card"><div class="k">کل کدها</div><div id="discountCodeStatTotal" class="v">—</div><div class="s">کدهای ثبت‌شده</div></div>' +
          '<div class="card"><div class="k">تعداد استفاده</div><div id="discountCodeStatUses" class="v">—</div><div class="s">مصرف ثبت‌شده</div></div>' +
          '<div class="card"><div class="k">ارزش تخفیف</div><div id="discountCodeStatValue" class="v">—</div><div class="s">جمع مبلغ تخفیف</div></div>' +
        '</div>' +
        '<div class="panel"><div class="panel-head"><h2>کوپن‌ها</h2><div class="tools"><input id="discountCodeSearch" class="input" placeholder="جستجو در نام یا کد…"><select id="discountCodeFilter" class="select"><option value="">همه وضعیت‌ها</option><option value="active">فعال</option><option value="scheduled">زمان‌بندی شده</option><option value="expired">منقضی</option><option value="off">خاموش</option></select></div></div><div id="discountCodesTable" class="table-wrap"></div></div>' +
      '</div>';
    main.appendChild(sec);
    $('newDiscountCodeBtn').onclick = () => openDiscountCodeEditor(null);
    $('discountCodeSearch').oninput = renderDiscountCodes;
    $('discountCodeFilter').onchange = renderDiscountCodes;
    $('newDiscountCodeBtn').style.display = can.all() ? '' : 'none';
  }

  async function loadDiscountCodes() {
    const box = $('discountCodesTable');
    if (!box) return;
    try {
      await fetchDiscountData();
      const rows = discountState.rows.filter(x => String(x.code || '').trim());
      const active = rows.filter(x => x.is_active && new Date(x.starts_at).getTime() <= Date.now() && (!x.ends_at || new Date(x.ends_at).getTime() >= Date.now()) && !(x.usage_limit != null && Number(x.used_count||0) >= Number(x.usage_limit))).length;
      const uses = rows.reduce((sum,x)=>sum+Number(x.used_count||0),0);
      const value = rows.reduce((sum,x)=>sum+Number(x.total_discount||0),0);
      if ($('discountCodeStatTotal')) $('discountCodeStatTotal').textContent = rows.length.toLocaleString('fa-IR');
      if ($('discountCodeStatActive')) $('discountCodeStatActive').textContent = active.toLocaleString('fa-IR');
      if ($('discountCodeStatUses')) $('discountCodeStatUses').textContent = uses.toLocaleString('fa-IR');
      if ($('discountCodeStatValue')) $('discountCodeStatValue').textContent = money(value);
      renderDiscountCodes();
    } catch (err) {
      showSectionError('discountCodesTable', err);
    }
  }

  function renderDiscountCodes() {
    const box = $('discountCodesTable');
    if (!box) return;
    const term = ($('discountCodeSearch')?.value || '').trim().toLocaleLowerCase('fa');
    const filter = $('discountCodeFilter')?.value || '';
    const now = Date.now();
    const rows = (discountState.rows || []).filter(x => {
      if (!String(x.code || '').trim()) return false;
      const hay = (String(x.name || '') + ' ' + String(x.code || '')).toLocaleLowerCase('fa');
      if (term && !hay.includes(term)) return false;
      const stateName = !x.is_active ? 'off' :
        (new Date(x.starts_at).getTime() > now ? 'scheduled' :
        (x.ends_at && new Date(x.ends_at).getTime() < now ? 'expired' :
        (x.usage_limit != null && Number(x.used_count||0) >= Number(x.usage_limit) ? 'expired' : 'active')));
      if (filter && stateName !== filter) return false;
      return true;
    });
    if (!rows.length) {
      box.innerHTML = '<div class="az-coupon-empty"><div style="font-size:28px">🏷️</div><strong>هنوز کد تخفیفی مطابق فیلتر ثبت نشده</strong><div class="muted" style="margin-top:6px">کد را می‌توان برای کل سبد، محصول، دسته، برند یا مشتری ساخت.</div></div>';
      return;
    }
    const scopeText = x => x.applies_to === 'all' ? 'کل سبد' :
      x.applies_to === 'products' ? 'محصولات انتخابی' :
      x.applies_to === 'categories' ? 'دسته‌های انتخابی' :
      x.applies_to === 'brands' ? 'برندهای انتخابی' : 'مشتری‌های انتخابی';
    const body = rows.map(x => {
      const used = Number(x.used_count || 0);
      const limit = x.usage_limit == null ? '∞' : Number(x.usage_limit).toLocaleString('fa-IR');
      const remaining = x.usage_limit == null ? 'نامحدود' : Math.max(0, Number(x.usage_limit)-used).toLocaleString('fa-IR');
      const value = x.discount_type === 'percentage' ? Number(x.value||0).toLocaleString('fa-IR') + '٪' : money(x.value);
      const tags = [
        '<span class="badge">' + esc(scopeText(x)) + '</span>',
        x.first_order_only ? '<span class="badge warn">اولین خرید</span>' : '',
        x.auto_apply ? '<span class="badge warn">خودکار</span>' : '',
        x.min_order_amount ? '<span class="badge">حداقل ' + esc(money(x.min_order_amount)) + '</span>' : ''
      ].join('');
      return '<article class="az-coupon-card">' +
        '<div class="az-coupon-top"><div><div class="az-coupon-code" dir="ltr">' + esc(x.code) + '</div><h3 class="az-coupon-title">' + esc(x.name || 'کد تخفیف') + '</h3><p class="az-coupon-sub">' + esc(x.notes || 'کوپن فروش') + '</p></div>' + discountBadge(x) + '</div>' +
        '<div class="az-coupon-main"><div><div class="az-coupon-label">مقدار تخفیف</div><div class="az-coupon-value">' + esc(value) + '</div>' + (x.max_discount ? '<div class="muted">سقف: ' + money(x.max_discount) + '</div>' : '') + '</div><div class="az-coupon-scope"><div class="az-coupon-label">دامنه</div><strong>' + esc(scopeText(x)) + '</strong></div></div>' +
        '<div class="az-coupon-meta"><div><span class="az-coupon-label">استفاده</span><span class="az-coupon-number">' + used.toLocaleString('fa-IR') + ' / ' + limit + '</span></div><div><span class="az-coupon-label">باقی‌مانده</span><span class="az-coupon-number">' + remaining + '</span></div><div><span class="az-coupon-label">اعتبار تا</span><span class="az-coupon-number">' + esc(x.ends_at ? dateFa(x.ends_at,false) : 'بدون پایان') + '</span></div><div><span class="az-coupon-label">ارزش مصرف‌شده</span><span class="az-coupon-number">' + esc(money(x.total_discount || 0)) + '</span></div></div>' +
        '<div class="az-coupon-tags">' + tags + '</div>' +
        '<div class="az-coupon-actions">' + (can.all() ? '<button class="btn secondary" data-edit-discount="' + x.id + '">ویرایش</button>' : '') + '<button class="btn ghost" data-copy-discount="' + esc(x.code) + '">کپی کد</button>' +
        (can.all() ? '<button class="btn ghost" data-toggle-discount="' + x.id + '">' + (x.is_active ? 'خاموش' : 'روشن') + '</button><button class="btn ghost" data-delete-discount="' + x.id + '">حذف</button>' : '') +
        '</div></article>';
    }).join('');
    box.innerHTML = '<div class="az-coupon-grid">' + body + '</div>';
  }

  async function openDiscountCodeEditor(id) {
    await openDiscountEditor(id, null, true);
  }

  async function redeemOrderDiscount(orderId, result, customerId, orderCode) {
    const discountId = result?.row?.id || null;
    if (!discountId) {
      await state.db.from('discount_redemptions').delete().eq('order_id',orderId);
      return;
    }
    await state.db.from('discount_redemptions').delete().eq('order_id',orderId);
    const ins = await state.db.from('discount_redemptions').insert({
      discount_id:discountId, customer_id:customerId || null, order_id:orderId,
      code_used:result.row.code || null, discount_amount:Number(result.discount||0), created_by:state.user.id
    });
    if (ins.error) throw ins.error;
  }

  function generateDiscountCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(7);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random()*256);
    let suffix = '';
    bytes.forEach(b => suffix += alphabet[b % alphabet.length]);
    return 'AZIM-' + suffix;
  }

  async function copyDiscountCode(code) {
    const value = String(code || '').trim();
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const ta = document.createElement('textarea');
        ta.value = value; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast('__AZICON_SUCCESS__ کد کپی شد');
    } catch (_) {
      toast('__AZICON_ERROR__ کپی کد ممکن نشد؛ خود کد را انتخاب کن.');
    }
  }

  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-edit-discount]'); if (d) openDiscountEditor(d.dataset.editDiscount);
    const dt = e.target.closest('[data-toggle-discount]'); if (dt) toggleDiscount(dt.dataset.toggleDiscount);
    const dd = e.target.closest('[data-delete-discount]'); if (dd) deleteDiscount(dd.dataset.deleteDiscount);
    const dc = e.target.closest('[data-new-discount-customer]'); if (dc) openDiscountEditor(null, dc.dataset.newDiscountCustomer);
    const dp = e.target.closest('[data-new-discount-product]'); if (dp) openDiscountEditor(null, null, true, dp.dataset.newDiscountProduct);
    const cp = e.target.closest('[data-copy-discount]'); if (cp) copyDiscountCode(cp.dataset.copyDiscount);
  });

  async function loadMedia() {
    const r = await state.db.from('media_assets').select('*').order('created_at', { ascending: false }).limit(200);
    if (r.error) return showSectionError('mediaTable', r.error);
    if (!r.data?.length) return $('mediaTable').innerHTML = '<div class="empty">رسانه‌ای ثبت نشده.</div>';
    const body = r.data.map((x) =>
      '<tr><td>' + (x.public_url ? '<img class="thumb" src="' + esc(x.public_url) + '" alt="">' : '—') + '</td>' +
      '<td>' + esc(x.filename) + '</td><td>' + esc(x.folder) + '</td><td>' + (((x.size_bytes || 0) / 1024).toFixed(1)) +
      ' KB</td><td>' + dateFa(x.created_at) + '</td><td>' +
      (can.edit() ? '<button class="btn ghost" data-delete-media="' + x.id + '">حذف</button>' : '') + '</td></tr>'
    ).join('');
    $('mediaTable').innerHTML = '<table class="table"><thead><tr><th>تصویر</th><th>فایل</th><th>پوشه</th><th>حجم</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>' +
      body + '</tbody></table>';
  }

  async function uploadMedia() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه آپلود رسانه ندارد.');
    const input = $('mediaFile');
    const button = $('uploadMediaBtn');
    const file = input?.files?.[0];
    if (!file) return toast('یک فایل انتخاب کن');
    if (!String(file.type || '').startsWith('image/')) return toast('__AZICON_ERROR__ فقط فایل تصویری مجاز است.');
    if (file.size > 10 * 1024 * 1024) return toast('__AZICON_ERROR__ حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد.');
    const folder = $('mediaFolder').value;
    const path = folder + '/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (button) button.disabled = true;
    try {
      const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) throw up.error;
      const url = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
      const r = await state.db.from('media_assets').insert({
        filename: file.name, storage_path: path, public_url: url, mime_type: file.type,
        size_bytes: file.size, folder, uploaded_by: state.user.id
      });
      if (r.error) {
        await state.db.storage.from('admin-media').remove([path]).catch(() => {});
        throw r.error;
      }
      await audit('upload', 'media_assets', path, { folder, filename: file.name });
      input.value = '';
      toast('__AZICON_SUCCESS__ فایل آپلود شد');
      await loadMedia();
    } catch (err) {
      toast('__AZICON_ERROR__ ' + errorText(err));
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function deleteMedia(id) {
    if (!can.edit()) return;
    const r = await state.db.from('media_assets').select('*').eq('id', id).single();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    if (!confirm('این فایل رسانه‌ای حذف شود؟')) return;
    const rem = await state.db.storage.from('admin-media').remove([r.data.storage_path]);
    if (rem.error) return toast('__AZICON_ERROR__ ' + errorText(rem.error));
    const d = await state.db.from('media_assets').delete().eq('id', id);
    if (d.error) return toast('__AZICON_ERROR__ ' + errorText(d.error));
    await audit('delete', 'media_assets', id, { path: r.data.storage_path });
    toast('__AZICON_SUCCESS__ رسانه حذف شد');
    await loadMedia();
  }

  const contentMeta = {
    home_meta: {
      title: 'متای صفحه اصلی',
      fields: [
        ['title', 'عنوان سایت', 'input'],
        ['description', 'توضیحات متا', 'textarea']
      ]
    },
    home_hero: {
      title: 'هیرو صفحه اصلی',
      fields: [
        ['eyebrow', 'برچسب بالای هیرو', 'input'],
        ['title', 'عنوان اصلی', 'input'],
        ['highlight', 'خط برجسته عنوان', 'input'],
        ['description', 'توضیحات', 'textarea'],
        ['trust_badges', 'مزیت‌ها (هر خط یک مورد)', 'lines'],
        ['primary_cta', 'دکمه کاتالوگ', 'input'],
        ['contact_cta', 'دکمه ارتباط', 'input']
      ]
    },
    home_choice: {
      title: 'مسیرهای خرید',
      fields: [
        ['eyebrow', 'برچسب', 'input'],
        ['title', 'عنوان', 'input'],
        ['lead', 'متن راهنما', 'textarea']
      ]
    },
    home_why: {
      title: 'مزیت‌های فروشگاه',
      fields: [
        ['eyebrow', 'برچسب', 'input'],
        ['title', 'عنوان', 'input'],
        ['lead', 'متن راهنما', 'textarea']
      ]
    },
    contact_page: {
      title: 'صفحه ارتباط و سفارش',
      fields: [
        ['title', 'عنوان صفحه', 'input'],
        ['description', 'توضیحات متا', 'textarea'],
        ['email', 'ایمیل فروشگاه', 'input']
      ]
    }
  };

  const sensitiveContentKeys = new Set(['checkout_payment', 'ai_settings', 'checkout_rules']);
  const canEditContentKey = (key) => {
    const clean = String(key || '').trim();
    if (clean === 'checkout_payment') return false;
    return can.edit() && (!sensitiveContentKeys.has(clean) || can.all());
  };

  async function loadContent() {
    const r = await state.db.from('site_content').select('*').order('updated_at', { ascending: false });
    if (r.error) return showSectionError('contentTable', r.error);
    state.contentRows = r.data || [];
    if (!state.contentRows.length) return $('contentTable').innerHTML = '<div class="empty">هنوز محتوایی ثبت نشده.</div>';
    const body = state.contentRows.map((x) =>
      '<tr><td>' + esc(x.section_key) + '</td><td>' + esc(x.title || '—') + '</td><td>' +
      (x.is_active ? '<span class="badge ok">فعال</span>' : '<span class="badge red">غیرفعال</span>') +
      '</td><td>' + dateFa(x.updated_at) + '</td><td>' +
      (x.section_key === 'checkout_payment'
        ? '<button class="btn secondary" data-open-payment-admin>__AZICON_INVOICE__ مدیریت درگاه</button>'
        : (canEditContentKey(x.section_key) ? '<button class="btn secondary" data-edit-content="' + x.id + '">ویرایش</button>' : '<span class="badge warn">فقط مدیران</span>')) +
      '</td></tr>'
    ).join('');
    $('contentTable').innerHTML =
      '<table class="table"><thead><tr><th>کلید</th><th>عنوان</th><th>وضعیت</th><th>آخرین بروزرسانی</th><th>عملیات</th></tr></thead><tbody>' +
      body + '</tbody></table>';
  }

  function contentForm(x) {
    const key = x?.section_key || '';
    const meta = contentMeta[key];
    if (!meta) {
      return '<form id="contentForm" class="grid2">' +
        '<div class="field"><label>کلید یکتا *</label><input class="input" name="section_key" required value="' + esc(key) + '"></div>' +
        '<div class="field"><label>عنوان</label><input class="input" name="title" value="' + esc(x?.title) + '"></div>' +
        '<label class="check field"><input name="is_active" type="checkbox" ' + (x?.is_active === false ? '' : 'checked') + '> فعال</label>' +
        '<div class="field full"><label>Payload JSON</label><textarea class="textarea" name="payload" style="min-height:260px">' +
        esc(JSON.stringify(x?.payload || {}, null, 2)) + '</textarea></div>' +
        '<div class="field full"><button class="btn">ذخیره</button></div><div id="contentStatus" class="status field full"></div></form>';
    }
    const payload = x?.payload || {};
    const fields = meta.fields.map((f) => {
      if (f[2] === 'textarea') return '<div class="field full"><label>' + f[1] + '</label><textarea class="textarea" name="f_' + f[0] + '">' + esc(payload[f[0]] || '') + '</textarea></div>';
      if (f[2] === 'lines') return '<div class="field full"><label>' + f[1] + '</label><textarea class="textarea" name="f_' + f[0] + '" placeholder="هر مورد در یک خط">' + esc(Array.isArray(payload[f[0]]) ? payload[f[0]].join('\\n') : '') + '</textarea></div>';
      return '<div class="field"><label>' + f[1] + '</label><input class="input" name="f_' + f[0] + '" value="' + esc(payload[f[0]] || '') + '"></div>';
    }).join('');
    return '<form id="contentForm" class="grid2">' +
      '<div class="field"><label>بخش</label><input class="input" value="' + esc(key) + '" disabled></div>' +
      '<div class="field"><label>عنوان مدیریتی</label><input class="input" name="admin_title" value="' + esc(x?.title || meta.title) + '"></div>' +
      fields +
      '<label class="check field full"><input name="is_active" type="checkbox" ' + (x?.is_active === false ? '' : 'checked') + '> فعال روی سایت</label>' +
      '<div class="field full"><button class="btn">ذخیره محتوا</button></div><div id="contentStatus" class="status field full"></div></form>';
  }

  async function editContent(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ویرایش محتوا ندارد.');
    const keyRow = state.contentRows.find((x) => x.id === id);
    if (!canEditContentKey(keyRow?.section_key)) return toast('__AZICON_BLOCK__ تنظیمات پرداخت، هوش مصنوعی و قواعد checkout فقط برای مدیران قابل ویرایش است.');
    const r = await state.db.from('site_content').select('*').eq('id', id).single();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal('ویرایش محتوا', contentForm(r.data));
    $('contentForm').onsubmit = (e) => saveContent(e, id);
  }

  function newContent() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ساخت محتوا ندارد.');
    openModal('بخش محتوایی جدید', contentForm(null));
    $('contentForm').onsubmit = (e) => saveContent(e, null);
  }

  async function saveContent(e, id) {
    e.preventDefault();
    try {
      const s = e.target.elements;
      const key = s.section_key ? s.section_key.value.trim() : state.contentRows.find((x) => x.id === id)?.section_key;
      if (!canEditContentKey(key)) return toast('__AZICON_BLOCK__ این بخش فقط توسط مدیران قابل ذخیره است.');
      let payload = {};
      const meta = contentMeta[key];
      if (meta) {
        meta.fields.forEach((f) => {
          const val = s['f_' + f[0]]?.value || '';
          payload[f[0]] = f[2] === 'lines' ? val.split('\\n').map((x) => x.trim()).filter(Boolean) : val.trim();
        });
      } else {
        payload = JSON.parse(s.payload.value || '{}');
      }
      const title = s.admin_title ? s.admin_title.value.trim() || null : s.title.value.trim() || null;
      const p = {
        section_key: key, title, payload, is_active: key === 'ai_settings' ? true : !!s.is_active.checked,
        updated_by: state.user.id
      };
      let r;
      if (id) r = await state.db.from('site_content').update(p).eq('id', id);
      else r = await state.db.from('site_content').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'site_content', id || key, { section_key: key });
      closeModal();
      toast('__AZICON_SUCCESS__ محتوای سایت ذخیره شد');
      await loadContent();
    } catch (err) {
      $('contentStatus').textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }


  function copyField(name, label, value, kind = 'input', wide = false) {
    const cls = wide ? 'field full' : 'field';
    if (kind === 'lines') {
      return '<div class="' + cls + '"><label>' + esc(label) + '</label><textarea class="textarea az-copy-textarea" name="' + name + '" placeholder="هر مورد در یک خط">' + esc(Array.isArray(value) ? value.join('\\n') : '') + '</textarea></div>';
    }
    return '<div class="' + cls + '"><label>' + esc(label) + '</label>' +
      (kind === 'textarea'
        ? '<textarea class="textarea az-copy-textarea" name="' + name + '">' + esc(value || '') + '</textarea>'
        : '<input class="input" name="' + name + '" value="' + esc(value || '') + '">') +
      '</div>';
  }

  function copyGet(obj, path, fallback = '') {
    return path.split('.').reduce((v, k) => v == null ? undefined : v[k], obj) ?? fallback;
  }

  function copySet(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      const next = parts[i + 1];
      if (last) {
        cur[part] = value;
      } else {
        if (cur[part] == null) cur[part] = /^\d+$/.test(next) ? [] : {};
        cur = cur[part];
      }
    });
  }

  function siteCopyDefaults() {
    return {
      footer: {
        brand:'عظیم ابزار',
        tagline:'مرجع تخصصی ابزارهای مکانیکی و صنعتی',
        description:'',
        online_badge:'سامانه فعال استعلام قیمت و سفارش کالا',
        categories_heading:'دسته‌بندی‌های تخصصی',
        categories:[],
        catalog_cta:'مشاهده کاتالوگ جامع محصولات',
        quick_heading:'دسترسی سریع و خدمات',
        quick_links:[],
        contact_heading:'نشانی و راه‌های ارتباطی',
        address:'',
        phone:'۰۹۱۲-۲۳۹۴۵۹۷',
        hours:'',
        bottom_text:'© تمامی حقوق مادی و معنوی متعلق به عظیم ابزار است.',
        bottom_subtext:'مرکز تأمین و توزیع تخصصی ابزارهای کارگاهی، صنعتی و خودرویی کشور'
      },
      home: {
        meta:{title:'',description:''},
        header:{brand:'',tagline:'',nav_home:'',nav_products:'',nav_contact:''},
        topbar:[],
        hero:{eyebrow:'',title:'',highlight:'',description:'',trust:[],primary_cta:'',contact_cta:''},
        hud:{label:'',badge:'',value:'',unit:'',specs:[],chips:[['',''],['','']]},
        ticker:[],
        choice:{eyebrow:'',title:'',lead:'',cards:[['','','',''],['','','',''],['','','','']]},
        why:{eyebrow:'',title:'',lead:'',items:[['',''],['',''],['',''],['','']]},
        footer:{text:'',links:[]}
      },
      contact:{
        meta:{title:'',description:''},
        header:{brand:'',tagline:'',back:''},
        hero:{title:'',description:'',call_cta:'',form_cta:''},
        channels_head:{title:'',description:''},
        phone:{title:'',pill:'',value:'',sub:'',copy:'',call:''},
        support:{title:'',pill:'',value:'',sub:'',button:''},
        email:{title:'',pill:'',value:'',sub:'',copy:'',send:''},
        address:{title:'',pill:'',value:'',sub:'',button:'',neshan_url:'',balad_url:''},
        hours:{title:'',status:'',rows:[['',''],['',''],['','']]},
        form:{title:'',description:'',topicsLabel:'',topics:[],fullnameLabel:'',fullnamePlaceholder:'',mobileLabel:'',mobilePlaceholder:'',subjectLabel:'',subjectOptions:[],businessLabel:'',businessPlaceholder:'',detailsLabel:'',detailsPlaceholder:'',submit:'',whatsapp:''},
        trust:[['',''],['',''],['',''],['','']],
        faq:{title:'',items:[['',''],['',''],['','']]},
        bottom:{title:'',badge:'',address:'',meta1:'',meta2:'',phone:'',map:''},
        footer:{text:'',links:[]}
      }
    };
  }

  const unifiedSiteFields = [
    ['home.meta.title','عنوان SEO صفحه اصلی'],['home.meta.description','توضیحات SEO صفحه اصلی','textarea'],
    ['home.header.brand','نام برند'],['home.header.tagline','شعار زیر برند'],
    ['home.header.nav_home','منوی صفحه اصلی'],['home.header.nav_products','منوی کاتالوگ محصولات'],
    ['home.header.nav_contact','منوی ارتباط و سفارش'],
    ['home.topbar','نوار بالای صفحه','lines'],['home.hero.eyebrow','برچسب بالای هیرو'],
    ['home.hero.title','عنوان اصلی هیرو'],['home.hero.highlight','خط برجسته هیرو'],
    ['home.hero.description','توضیحات هیرو','textarea'],['home.hero.trust','۴ مزیت هیرو','lines'],
    ['home.hero.primary_cta','دکمه کاتالوگ'],['home.hero.contact_cta','دکمه ارتباط'],
    ['home.hud.label','عنوان HUD'],['home.hud.badge','نشان HUD'],['home.hud.value','عدد HUD'],
    ['home.hud.unit','واحد HUD'],['home.hud.specs','مشخصات HUD','lines'],
    ['home.hud.chips.0.0','چیپ شناور اول — عنوان'],['home.hud.chips.0.1','چیپ شناور اول — توضیح'],
    ['home.hud.chips.1.0','چیپ شناور دوم — عنوان'],['home.hud.chips.1.1','چیپ شناور دوم — توضیح'],
    ['home.ticker','متن‌های نوار متحرک','lines'],
    ['home.choice.eyebrow','مسیرها — برچسب'],['home.choice.title','مسیرها — عنوان'],
    ['home.choice.lead','مسیرها — توضیح','textarea'],
    ['home.choice.cards.0.0','مسیر اول — برچسب'],['home.choice.cards.0.1','مسیر اول — عنوان'],
    ['home.choice.cards.0.2','مسیر اول — توضیح','textarea'],['home.choice.cards.0.3','مسیر اول — دکمه'],
    ['home.choice.cards.1.0','مسیر دوم — برچسب'],['home.choice.cards.1.1','مسیر دوم — عنوان'],
    ['home.choice.cards.1.2','مسیر دوم — توضیح','textarea'],['home.choice.cards.1.3','مسیر دوم — دکمه'],
    ['home.choice.cards.2.0','مسیر سوم — برچسب'],['home.choice.cards.2.1','مسیر سوم — عنوان'],
    ['home.choice.cards.2.2','مسیر سوم — توضیح','textarea'],['home.choice.cards.2.3','مسیر سوم — دکمه'],
    ['home.why.eyebrow','مزایا — برچسب'],['home.why.title','مزایا — عنوان'],['home.why.lead','مزایا — توضیح','textarea'],
    ['home.why.items.0.0','مزیت ۱ — عنوان'],['home.why.items.0.1','مزیت ۱ — توضیح','textarea'],
    ['home.why.items.1.0','مزیت ۲ — عنوان'],['home.why.items.1.1','مزیت ۲ — توضیح','textarea'],
    ['home.why.items.2.0','مزیت ۳ — عنوان'],['home.why.items.2.1','مزیت ۳ — توضیح','textarea'],
    ['home.why.items.3.0','مزیت ۴ — عنوان'],['home.why.items.3.1','مزیت ۴ — توضیح','textarea'],
    ['home.footer.text','متن فوتر'],['home.footer.links','لینک‌های فوتر','lines'],

    ['footer.brand','فوتر — نام برند'],
    ['footer.tagline','فوتر — زیرعنوان'],
    ['footer.description','فوتر — معرفی فروشگاه','textarea'],
    ['footer.online_badge','فوتر — وضعیت سامانه'],
    ['footer.categories_heading','فوتر — عنوان دسته‌بندی‌ها'],
    ['footer.categories','فوتر — دسته‌بندی‌ها (هر خط یک مورد)','lines'],
    ['footer.catalog_cta','فوتر — متن لینک کاتالوگ'],
    ['footer.quick_heading','فوتر — عنوان دسترسی سریع'],
    ['footer.quick_links','فوتر — لینک‌های دسترسی سریع (هر خط یک مورد)','lines'],
    ['footer.contact_heading','فوتر — عنوان راه‌های ارتباطی'],
    ['footer.address','فوتر — آدرس','textarea'],
    ['footer.phone','فوتر — شماره مشاوره'],
    ['footer.hours','فوتر — ساعات کاری','textarea'],
    ['footer.bottom_text','فوتر — متن نوار پایانی'],
    ['footer.bottom_subtext','فوتر — توضیح نوار پایانی','textarea'],

    ['contact.meta.title','عنوان SEO ارتباط با ما'],['contact.meta.description','توضیحات SEO ارتباط با ما','textarea'],
    ['contact.header.brand','ارتباط — نام برند'],['contact.header.tagline','ارتباط — شعار زیر برند'],['contact.header.back','متن بازگشت'],
    ['contact.hero.title','ارتباط — عنوان','textarea'],['contact.hero.description','ارتباط — توضیحات','textarea'],
    ['contact.hero.call_cta','دکمه تماس'],['contact.hero.form_cta','دکمه فرم'],
    ['contact.channels_head.title','بخش راه‌های ارتباط — عنوان'],['contact.channels_head.description','بخش راه‌های ارتباط — توضیح','textarea'],
    ['contact.phone.title','تلفن — عنوان'],['contact.phone.pill','تلفن — برچسب'],['contact.phone.value','تلفن — شماره'],
    ['contact.phone.sub','تلفن — توضیح','textarea'],['contact.phone.copy','تلفن — دکمه کپی'],['contact.phone.call','تلفن — دکمه تماس'],
    ['contact.support.title','پشتیبانی — عنوان'],['contact.support.pill','پشتیبانی — برچسب'],
    ['contact.support.value','پشتیبانی — متن اصلی','textarea'],['contact.support.sub','پشتیبانی — توضیح','textarea'],['contact.support.button','پشتیبانی — دکمه'],
    ['contact.email.title','ایمیل — عنوان'],['contact.email.pill','ایمیل — برچسب'],['contact.email.value','ایمیل'],
    ['contact.email.sub','ایمیل — توضیح','textarea'],['contact.email.copy','ایمیل — دکمه کپی'],['contact.email.send','ایمیل — دکمه ارسال'],
    ['contact.address.title','آدرس — عنوان'],['contact.address.pill','آدرس — برچسب'],['contact.address.value','آدرس','textarea'],
    ['contact.address.sub','آدرس — توضیح','textarea'],['contact.address.button','آدرس — دکمه'],['contact.address.neshan_url','لینک موقعیت در نشان'],['contact.address.balad_url','لینک موقعیت در بلد'],
    ['contact.hours.title','ساعات — عنوان'],['contact.hours.status','ساعات — وضعیت'],
    ['contact.hours.rows.0.0','شنبه تا چهارشنبه — برچسب'],['contact.hours.rows.0.1','شنبه تا چهارشنبه — ساعت'],
    ['contact.hours.rows.1.0','پنجشنبه — برچسب'],['contact.hours.rows.1.1','پنجشنبه — ساعت'],
    ['contact.hours.rows.2.0','جمعه و تعطیلات — برچسب'],['contact.hours.rows.2.1','جمعه و تعطیلات — توضیح'],
    ['contact.form.title','فرم — عنوان'],['contact.form.description','فرم — توضیح','textarea'],
    ['contact.form.topicsLabel','فرم — عنوان موضوعات'],['contact.form.topics','فرم — موضوعات سریع','lines'],
    ['contact.form.fullnameLabel','فرم — نام'],['contact.form.fullnamePlaceholder','فرم — جای‌خالی نام'],
    ['contact.form.mobileLabel','فرم — موبایل'],['contact.form.mobilePlaceholder','فرم — جای‌خالی موبایل'],
    ['contact.form.subjectLabel','فرم — دسته‌بندی'],['contact.form.subjectOptions','فرم — گزینه‌های دسته‌بندی','lines'],
    ['contact.form.businessLabel','فرم — کارگاه'],['contact.form.businessPlaceholder','فرم — جای‌خالی کارگاه'],
    ['contact.form.detailsLabel','فرم — شرح درخواست','textarea'],['contact.form.detailsPlaceholder','فرم — جای‌خالی شرح','textarea'],
    ['contact.form.submit','فرم — دکمه ارسال'],['contact.form.whatsapp','فرم — دکمه پیام‌رسان'],
    ['contact.trust.0.0','اعتماد ۱ — عنوان'],['contact.trust.0.1','اعتماد ۱ — توضیح'],
    ['contact.trust.1.0','اعتماد ۲ — عنوان'],['contact.trust.1.1','اعتماد ۲ — توضیح'],
    ['contact.trust.2.0','اعتماد ۳ — عنوان'],['contact.trust.2.1','اعتماد ۳ — توضیح'],
    ['contact.trust.3.0','اعتماد ۴ — عنوان'],['contact.trust.3.1','اعتماد ۴ — توضیح'],
    ['contact.faq.title','سؤالات متداول — عنوان'],
    ['contact.faq.items.0.0','سؤال ۱'],['contact.faq.items.0.1','پاسخ ۱','textarea'],
    ['contact.faq.items.1.0','سؤال ۲'],['contact.faq.items.1.1','پاسخ ۲','textarea'],
    ['contact.faq.items.2.0','سؤال ۳'],['contact.faq.items.2.1','پاسخ ۳','textarea'],
    ['contact.faq.items.3.0','سؤال ۴'],['contact.faq.items.3.1','پاسخ ۴','textarea'],
    ['contact.faq.items.4.0','سؤال ۵'],['contact.faq.items.4.1','پاسخ ۵','textarea'],
    ['contact.bottom.title','پایین صفحه — عنوان آدرس'],['contact.bottom.badge','پایین صفحه — برچسب'],
    ['contact.bottom.address','پایین صفحه — آدرس','textarea'],['contact.bottom.meta1','پایین صفحه — توضیح اول'],
    ['contact.bottom.meta2','پایین صفحه — توضیح دوم'],['contact.bottom.phone','پایین صفحه — تلفن'],
    ['contact.bottom.map','پایین صفحه — دکمه نقشه'],['contact.footer.text','فوتر ارتباط','textarea'],['contact.footer.links','فوتر ارتباط — لینک‌ها','lines']
  ];

  function siteCopyForm(copy) {
    const p = Object.assign(siteCopyDefaults(), copy || {});
    const fieldHtml = (prefix) => unifiedSiteFields.filter(f => f[0] === prefix || f[0].startsWith(prefix + '.')).map(f => {
      const kind = f[2] || 'input';
      return copyField('sc_' + f[0], f[1], copyGet(p, f[0], kind === 'lines' ? [] : ''), kind, kind === 'textarea' || kind === 'lines');
    }).join('');
    return '<form id="unifiedSiteForm" class="az-unified-form">' +
      '<div class="az-copy-intro"><strong>ویرایش یکجای نوشته‌های سایت</strong><small>از همین صفحه متن‌های قابل مشاهده صفحه اصلی و «ارتباط با ما» را تغییر بده. دکمه‌ها و ساختار صفحه دست‌نخورده می‌مانند.</small></div>' +
      '<details class="az-copy-group" open><summary>__AZICON_HOME__ صفحه اصلی — هدر و SEO</summary><div class="grid2">' + fieldHtml('home.meta') + fieldHtml('home.header') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_TARGET__ صفحه اصلی — هیرو و نوار بالایی</summary><div class="grid2">' + fieldHtml('home.topbar') + fieldHtml('home.hero') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_GEAR__ صفحه اصلی — HUD و نوار متحرک</summary><div class="grid2">' + fieldHtml('home.hud') + fieldHtml('home.ticker') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_COMPASS__ صفحه اصلی — مسیرهای خرید</summary><div class="grid2">' + fieldHtml('home.choice') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_TOOLS__ صفحه اصلی — مزیت‌ها</summary><div class="grid2">' + fieldHtml('home.why') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_DOWN__ صفحه اصلی — فوتر</summary><div class="grid2">' + fieldHtml('home.footer') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_PIN__ فوتر مشترک و اطلاعات فروشگاه</summary><div class="grid2">' + fieldHtml('footer') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_PHONE__ ارتباط با ما — هدر و SEO</summary><div class="grid2">' + fieldHtml('contact.meta') + fieldHtml('contact.header') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_INVOICE__ ارتباط با ما — معرفی صفحه</summary><div class="grid2">' + fieldHtml('contact.hero') + fieldHtml('contact.channels_head') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_PHONE__ ارتباط با ما — راه‌های تماس</summary><div class="grid2">' + fieldHtml('contact.phone') + fieldHtml('contact.support') + fieldHtml('contact.email') + fieldHtml('contact.address') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_CLOCK__ ارتباط با ما — ساعات کاری</summary><div class="grid2">' + fieldHtml('contact.hours') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_NOTE__ ارتباط با ما — فرم استعلام</summary><div class="grid2">' + fieldHtml('contact.form') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_SUCCESS__ ارتباط با ما — مزیت‌ها و اعتماد</summary><div class="grid2">' + fieldHtml('contact.trust') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_QUESTION__ ارتباط با ما — پرسش‌های متداول</summary><div class="grid2">' + fieldHtml('contact.faq') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_PIN__ ارتباط با ما — آدرس پایین صفحه و فوتر</summary><div class="grid2">' + fieldHtml('contact.bottom') + fieldHtml('contact.footer') + '</div></details>' +
      '<div class="az-copy-savebar"><button class="btn" type="submit">__AZICON_SAVE__ ذخیره همه نوشته‌ها</button><span id="unifiedSiteStatus" class="status"></span></div>' +
      '</form>';
  }


  function sharedFooterForm(copy) {
    const f = Object.assign(siteCopyDefaults().footer, copy?.footer || {});
    return '<form id="sharedFooterForm" class="az-unified-form">' +
      '<div class="az-copy-intro"><strong>__AZICON_PIN__ ویرایش فوتر و اطلاعات فروشگاه</strong>' +
      '<small>اطلاعاتی که در پایین صفحات مشتری دیده می‌شود را از اینجا تغییر بده؛ ساختار و لینک‌ها حفظ می‌شوند.</small></div>' +
      '<details class="az-copy-group" open><summary>هویت و معرفی فروشگاه</summary><div class="grid2">' +
        copyField('sf_brand','نام برند',f.brand) +
        copyField('sf_tagline','زیرعنوان',f.tagline) +
        copyField('sf_description','معرفی فروشگاه',f.description,'textarea',true) +
        copyField('sf_online_badge','وضعیت سامانه',f.online_badge) +
      '</div></details>' +
      '<details class="az-copy-group"><summary>دسته‌بندی‌ها و دسترسی سریع</summary><div class="grid2">' +
        copyField('sf_categories_heading','عنوان دسته‌بندی‌ها',f.categories_heading) +
        copyField('sf_categories','دسته‌بندی‌ها (هر خط یک مورد)',f.categories,'lines',true) +
        copyField('sf_catalog_cta','متن لینک کاتالوگ',f.catalog_cta) +
        copyField('sf_quick_heading','عنوان دسترسی سریع',f.quick_heading) +
        copyField('sf_quick_links','لینک‌های دسترسی سریع (هر خط یک مورد)',f.quick_links,'lines',true) +
      '</div></details>' +
      '<details class="az-copy-group"><summary>آدرس و تماس</summary><div class="grid2">' +
        copyField('sf_contact_heading','عنوان راه‌های ارتباطی',f.contact_heading) +
        copyField('sf_address','آدرس',f.address,'textarea',true) +
        copyField('sf_phone','شماره مشاوره',f.phone) +
        copyField('sf_hours','ساعات کاری',f.hours,'textarea',true) +
      '</div></details>' +
      '<details class="az-copy-group"><summary>نوار پایانی</summary><div class="grid2">' +
        copyField('sf_bottom_text','متن پایانی',f.bottom_text,'textarea',true) +
        copyField('sf_bottom_subtext','توضیح پایانی',f.bottom_subtext,'textarea',true) +
      '</div></details>' +
      '<div class="az-copy-savebar"><button class="btn" type="submit">__AZICON_SAVE__ ذخیره فوتر</button><button class="btn ghost" type="button" id="previewSharedFooter">__AZICON_GLOBE__ پیش‌نمایش سایت</button><span id="sharedFooterStatus" class="status"></span></div>' +
    '</form>';
  }

  async function openSharedFooterEditor() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ویرایش فوتر را ندارد.');
    const r = await state.db.from('site_content').select('id,payload').eq('section_key','site_copy').maybeSingle();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal('فوتر و اطلاعات فروشگاه', sharedFooterForm(r.data?.payload || {}));
    $('sharedFooterForm').onsubmit = (e) => saveSharedFooterContent(e, r.data?.id || null);
    $('previewSharedFooter')?.addEventListener('click', () => window.open(new URL('index.html', window.location.origin).href, '_blank', 'noopener'));
  }

  async function saveSharedFooterContent(e, rowId) {
    e.preventDefault();
    if (!can.edit()) return;
    const status = $('sharedFooterStatus');
    try {
      const existing = await state.db.from('site_content').select('id,payload').eq('section_key','site_copy').maybeSingle();
      if (existing.error) throw existing.error;
      const copy = Object.assign(siteCopyDefaults(), existing.data?.payload || {});
      copy.footer = {
        brand:e.target.elements.sf_brand.value.trim(),
        tagline:e.target.elements.sf_tagline.value.trim(),
        description:e.target.elements.sf_description.value.trim(),
        online_badge:e.target.elements.sf_online_badge.value.trim(),
        categories_heading:e.target.elements.sf_categories_heading.value.trim(),
        categories:e.target.elements.sf_categories.value.split('\n').map(x => x.trim()).filter(Boolean),
        catalog_cta:e.target.elements.sf_catalog_cta.value.trim(),
        quick_heading:e.target.elements.sf_quick_heading.value.trim(),
        quick_links:e.target.elements.sf_quick_links.value.split('\n').map(x => x.trim()).filter(Boolean),
        contact_heading:e.target.elements.sf_contact_heading.value.trim(),
        address:e.target.elements.sf_address.value.trim(),
        phone:e.target.elements.sf_phone.value.trim(),
        hours:e.target.elements.sf_hours.value.trim(),
        bottom_text:e.target.elements.sf_bottom_text.value.trim(),
        bottom_subtext:e.target.elements.sf_bottom_subtext.value.trim()
      };
      const saved = rowId
        ? await state.db.from('site_content').update({section_key:'site_copy',title:'ویرایش یکجای متن سایت',payload:copy,is_active:true,updated_by:state.user.id}).eq('id',rowId)
        : await state.db.from('site_content').insert({section_key:'site_copy',title:'ویرایش یکجای متن سایت',payload:copy,is_active:true,updated_by:state.user.id});
      if (saved.error) throw saved.error;
      await audit('update','site_content',rowId || 'site_copy',{scope:'shared-footer'});
      if(status) status.textContent='__AZICON_SUCCESS__ فوتر ذخیره شد';
      toast('__AZICON_SUCCESS__ اطلاعات فوتر ذخیره شد');
      await loadContent();
    } catch (err) {
      if(status) status.textContent='__AZICON_ERROR__ ' + errorText(err);
    }
  }

  const focusedCopyGroups = {
    home: [
      ['__AZICON_HOME__ هدر و SEO','home.meta,home.header'],
      ['__AZICON_TARGET__ هیرو و نوار بالایی','home.topbar,home.hero'],
      ['__AZICON_COMPASS__ مسیرهای خرید','home.choice'],
      ['__AZICON_TOOLS__ مزیت‌های فروشگاه','home.why'],
      ['__AZICON_DOWN__ فوتر صفحه اصلی','home.footer']
    ],
    contact: [
      ['__AZICON_PHONE__ هدر و SEO','contact.meta,contact.header'],
      ['__AZICON_INVOICE__ معرفی صفحه','contact.hero,contact.channels_head'],
      ['__AZICON_PHONE__ تلفن، پشتیبانی، ایمیل و آدرس','contact.phone,contact.support,contact.email,contact.address'],
      ['__AZICON_CLOCK__ ساعات کاری','contact.hours'],
      ['__AZICON_NOTE__ فرم استعلام و پیام','contact.form'],
      ['__AZICON_SUCCESS__ مزیت‌های اعتماد','contact.trust'],
      ['__AZICON_QUESTION__ پرسش‌های متداول','contact.faq'],
      ['__AZICON_PIN__ آدرس پایین صفحه و فوتر','contact.bottom,contact.footer']
    ]
  };

  function fieldsForPaths(paths) {
    const wanted = new Set(paths.split(',').map(x => x.trim()));
    return unifiedSiteFields.filter(f => [...wanted].some(prefix => f[0] === prefix || f[0].startsWith(prefix + '.')));
  }

  function focusedSiteForm(scope, copy) {
    const p = Object.assign(siteCopyDefaults(), copy || {});
    const groups = focusedCopyGroups[scope] || [];
    return '<form id="focusedSiteForm" class="az-unified-form">' +
      '<div class="az-copy-intro"><strong>' + (scope === 'contact' ? '__AZICON_PHONE__ مدیریت صفحه ارتباط با ما' : '__AZICON_HOME__ مدیریت صفحه اصلی') + '</strong>' +
      '<small>فقط محتوای همین صفحه در این بخش قرار دارد؛ اطلاعات را تغییر بده و «ذخیره صفحه» را بزن.</small></div>' +
      groups.map((g,i) => {
        const html = fieldsForPaths(g[1]).map(f => {
          const kind = f[2] || 'input';
          return copyField('fc_' + f[0], f[1], copyGet(p, f[0], kind === 'lines' ? [] : ''), kind, kind === 'textarea' || kind === 'lines');
        }).join('');
        return '<details class="az-copy-group" ' + (i === 0 ? 'open' : '') + '><summary>' + g[0] + '</summary><div class="grid2">' + html + '</div></details>';
      }).join('') +
      '<div class="az-copy-savebar"><button class="btn" type="submit">__AZICON_SAVE__ ذخیره صفحه</button><button class="btn ghost" type="button" id="previewFocusedSite">__AZICON_GLOBE__ پیش‌نمایش</button><span id="focusedSiteStatus" class="status"></span></div>' +
      '</form>';
  }

  async function openFocusedSiteEditor(scope) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ویرایش محتوای سایت را ندارد.');
    const r = await state.db.from('site_content').select('id,section_key,title,payload,is_active').eq('section_key','site_copy').maybeSingle();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal(scope === 'contact' ? 'ویرایش صفحه ارتباط با ما' : 'ویرایش صفحه اصلی', focusedSiteForm(scope, r.data?.payload || {}));
    $('focusedSiteForm').onsubmit = (e) => saveFocusedSiteContent(e, scope, r.data?.id || null);
    $('previewFocusedSite')?.addEventListener('click', () => {
      const target = scope === 'contact' ? 'contact.html' : 'index.html';
      window.open(new URL(target, window.location.origin).href, '_blank', 'noopener');
    });
  }

  async function saveFocusedSiteContent(e, scope, rowId) {
    e.preventDefault();
    if (!can.edit()) return;
    const status = $('focusedSiteStatus');
    try {
      const existingRow = await state.db.from('site_content').select('section_key,payload').eq('section_key','site_copy').maybeSingle();
      if (existingRow.error) throw existingRow.error;
      const copy = Object.assign(siteCopyDefaults(), existingRow.data?.payload || {});
      const fields = (focusedCopyGroups[scope] || []).flatMap(g => fieldsForPaths(g[1]));
      fields.forEach(f => {
        const el = e.target.elements['fc_' + f[0]];
        if (!el) return;
        copySet(copy, f[0], f[2] === 'lines'
          ? el.value.split('\n').map(x => x.trim()).filter(Boolean)
          : el.value.trim());
      });

      const saved = rowId
        ? await state.db.from('site_content').update({section_key:'site_copy',title:'ویرایش یکجای متن سایت',payload:copy,is_active:true,updated_by:state.user.id}).eq('id',rowId)
        : await state.db.from('site_content').insert({section_key:'site_copy',title:'ویرایش یکجای متن سایت',payload:copy,is_active:true,updated_by:state.user.id});
      if (saved.error) throw saved.error;

      if (scope === 'home') {
        const h = copy.home || {};
        const compat = [
          ['home_meta',{title:copyGet(h,'meta.title') || 'عظیم ابزار | مرجع تخصصی ابزارهای مکانیکی، کارگاهی و صنعتی',description:copyGet(h,'meta.description') || copyGet(h,'hero.description')}],
          ['home_hero',{eyebrow:copyGet(h,'hero.eyebrow'),title:copyGet(h,'hero.title'),highlight:copyGet(h,'hero.highlight'),description:copyGet(h,'hero.description'),trust_badges:copyGet(h,'hero.trust',[]),primary_cta:copyGet(h,'hero.primary_cta'),contact_cta:copyGet(h,'hero.contact_cta')}],
          ['home_choice',{eyebrow:copyGet(h,'choice.eyebrow'),title:copyGet(h,'choice.title'),lead:copyGet(h,'choice.lead')}],
          ['home_why',{eyebrow:copyGet(h,'why.eyebrow'),title:copyGet(h,'why.title'),lead:copyGet(h,'why.lead')}]
        ];
        for (const [key,payload] of compat) {
          const rr = await state.db.from('site_content').update({payload,updated_by:state.user.id}).eq('section_key',key);
          if (rr.error) throw rr.error;
        }
      } else {
        const p = copy.contact || {};
        const rr = await state.db.from('site_content').update({
          payload:{title:copyGet(p,'meta.title') || copyGet(p,'hero.title'),description:copyGet(p,'meta.description') || copyGet(p,'hero.description'),email:copyGet(p,'email.value')},
          updated_by:state.user.id
        }).eq('section_key','contact_page');
        if (rr.error) throw rr.error;
      }
      await audit('update','site_content',rowId || 'site_copy',{scope});
      if (status) status.textContent='__AZICON_SUCCESS__ ذخیره شد';
      toast('__AZICON_SUCCESS__ صفحه ' + (scope === 'contact' ? 'ارتباط با ما' : 'اصلی') + ' بروزرسانی شد');
      await loadContent();
    } catch (err) {
      if (status) status.textContent='__AZICON_ERROR__ ' + errorText(err);
    }
  }

  async function openUnifiedSiteEditor() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ویرایش محتوای سایت را ندارد.');
    const r = await state.db.from('site_content').select('id,section_key,title,payload,is_active').eq('section_key','site_copy').maybeSingle();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal('ویرایش یکجای سایت', siteCopyForm(r.data?.payload || {}));
    $('unifiedSiteForm').onsubmit = (e) => saveUnifiedSiteContent(e, r.data?.id || null);
  }

  async function saveUnifiedSiteContent(e, rowId) {
    e.preventDefault();
    if (!can.edit()) return;
    const status = $('unifiedSiteStatus');
    try {
      const base = siteCopyDefaults();
      const allRows = await state.db.from('site_content').select('section_key,payload').in('section_key',['site_copy','home_meta','home_hero','home_choice','home_why','contact_page']);
      if (allRows.error) throw allRows.error;
      const existing = allRows.data || [];
      const source = existing.find(x => x.section_key === 'site_copy')?.payload || {};
      const copy = Object.assign(siteCopyDefaults(), source);
      unifiedSiteFields.forEach((f) => {
        const el = e.target.elements['sc_' + f[0]];
        if (!el) return;
        copySet(copy, f[0], (f[2] === 'lines' ? el.value.split('\\n').map(x => x.trim()).filter(Boolean) : el.value.trim()));
      });
      const copyPayload = { ...base, ...copy };
      const up = {
        section_key:'site_copy',
        title:'ویرایش یکجای متن سایت',
        payload:copyPayload,
        is_active:true,
        updated_by:state.user.id
      };
      const r = rowId
        ? await state.db.from('site_content').update(up).eq('id',rowId)
        : await state.db.from('site_content').insert(up);
      if (r.error) throw r.error;

      const h = copyPayload.home || {};
      const c = copyPayload.contact || {};
      const compat = [
        ['home_meta', {title: copyGet(h,'meta.title') || 'عظیم ابزار | مرجع تخصصی ابزارهای مکانیکی، کارگاهی و صنعتی', description: copyGet(h,'meta.description') || copyGet(h,'hero.description') || ''}],
        ['home_hero', {eyebrow:copyGet(h,'hero.eyebrow'),title:copyGet(h,'hero.title'),highlight:copyGet(h,'hero.highlight'),description:copyGet(h,'hero.description'),trust_badges:copyGet(h,'hero.trust',[]),primary_cta:copyGet(h,'hero.primary_cta'),contact_cta:copyGet(h,'hero.contact_cta')}],
        ['home_choice', {eyebrow:copyGet(h,'choice.eyebrow'),title:copyGet(h,'choice.title'),lead:copyGet(h,'choice.lead')}],
        ['home_why', {eyebrow:copyGet(h,'why.eyebrow'),title:copyGet(h,'why.title'),lead:copyGet(h,'why.lead')}],
        ['contact_page', {title:copyGet(c,'meta.title') || copyGet(c,'hero.title'),description:copyGet(c,'meta.description') || copyGet(c,'hero.description'),email:copyGet(c,'email.value')}]
      ];
      for (const [key,payload] of compat) {
        const row = existing.find(x => x.section_key === key);
        if (!row) continue;
        const rr = await state.db.from('site_content').update({payload,updated_by:state.user.id}).eq('section_key',key);
        if (rr.error) throw rr.error;
      }
      await audit('update','site_content',rowId || 'site_copy',{section_key:'site_copy',scope:'home+contact'});
      if (status) status.textContent='__AZICON_SUCCESS__ همه نوشته‌ها ذخیره شد';
      toast('__AZICON_SUCCESS__ نوشته‌های صفحه اصلی و ارتباط با ما ذخیره شد');
      await loadContent();
    } catch (err) {
      if (status) status.textContent='__AZICON_ERROR__ ' + errorText(err);
    }
  }

  function aiForm(x) {
    const p = x?.payload || {};
    const prompts = Array.isArray(p.quick_prompts) ? p.quick_prompts : [];
    const enabled = p.enabled !== false;
    return '<div class="az-ai-grid">' +
      '<div class="az-ai-main">' +
        '<div class="az-ai-card az-ai-chat-card">' +
          '<div class="az-ai-card-head"><div><strong>تست زنده دستیار</strong><small>قبل از تحویل، دقیقاً ببین AI چه پاسخی به مشتری می‌دهد.</small></div><span class="az-ai-live">LIVE</span></div>' +
          '<div id="aiChatMessages" class="az-ai-chat-messages"><div class="az-ai-message ai"><b>دستیار</b><span>' + esc(p.greeting || 'سلام، چطور می‌توانم برای انتخاب ابزار کمکتان کنم؟') + '</span></div></div>' +
          '<div id="aiQuickPromptRow" class="az-ai-quick-row">' + prompts.slice(0,8).map((q,i) => '<button type="button" class="az-ai-prompt" data-ai-prompt="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' +
          '<form id="aiChatForm" class="az-ai-chat-form"><input id="aiChatInput" class="input" autocomplete="off" placeholder="مثلاً: برای آچار ۱۰×۱۱ چه گزینه‌ای داریم؟"><button class="btn" type="submit">ارسال</button></form>' +
          '<div id="aiChatStatus" class="status"></div>' +
        '</div>' +
        '<div class="az-ai-card">' +
          '<div class="az-ai-card-head"><div><strong>تنظیمات مدل و رفتار</strong><small>کنترل کامل Provider، مدل و دستورالعمل دستیار.</small></div></div>' +
          '<form id="aiForm" class="grid2">' +
            '<label class="check field full az-ai-enable"><input name="enabled" type="checkbox" ' + (enabled ? 'checked' : '') + '> <span><b>دستیار روی سایت فعال باشد</b><small>وقتی خاموش است، API باید وضعیت غیرفعال را مدیریت کند.</small></span></label>' +
            '<div class="field"><label>Provider اصلی</label><select class="select" name="provider"><option value="gemini" ' + (p.provider === 'gemini' ? 'selected' : '') + '>Gemini</option><option value="openai" ' + (p.provider === 'openai' ? 'selected' : '') + '>OpenAI</option></select></div>' +
            '<div class="field"><label>مدل اصلی</label><input class="input" name="model" value="' + esc(p.model || 'gemini-3.6-flash') + '"></div>' +
            '<div class="field"><label>مدل پشتیبان</label><input class="input" name="fallback_model" value="' + esc(p.fallback_model || 'gpt-4o-mini') + '"></div>' +
            '<div class="field"><label>حداکثر تعداد دکمه سریع</label><input class="input" value="' + Math.min(prompts.length || 0,8) + '" disabled></div>' +
            '<div class="field full"><label>پیام خوشامد</label><textarea class="textarea" name="greeting">' + esc(p.greeting || '') + '</textarea></div>' +
            '<div class="field full"><label>دستور سیستم</label><textarea class="textarea az-ai-system-prompt" name="system_instruction">' + esc(p.system_instruction || '') + '</textarea></div>' +
            '<div class="field full"><label>دکمه‌های سریع</label><textarea class="textarea" name="quick_prompts" placeholder="هر مورد در یک خط">' + esc(prompts.join('\\n')) + '</textarea><small class="field-hint">این موارد مستقیماً به‌عنوان پیشنهاد سؤال در چت نمایش داده می‌شوند.</small></div>' +
            '<div class="field full"><div class="tools"><button class="btn" type="submit">ذخیره تنظیمات</button><button type="button" id="testAIButton" class="btn secondary">تست API</button></div></div>' +
            '<div id="aiStatus" class="status field full"></div>' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<div class="az-ai-side">' +
        '<div class="az-ai-card az-ai-status-card"><div class="az-ai-card-head"><div><strong>وضعیت سرویس</strong><small>نمای لحظه‌ای پیکربندی فعلی</small></div></div><div class="az-ai-metrics"><div><span>وضعیت</span><b id="aiMetricStatus">' + (enabled ? 'فعال' : 'خاموش') + '</b></div><div><span>Provider</span><b id="aiMetricProvider">' + esc(p.provider || '—') + '</b></div><div><span>مدل اصلی</span><b id="aiMetricModel" dir="ltr">' + esc(p.model || '—') + '</b></div><div><span>Fallback</span><b id="aiMetricFallback" dir="ltr">' + esc(p.fallback_model || '—') + '</b></div></div></div>' +
        '<div class="az-ai-card"><div class="az-ai-card-head"><div><strong>اتصال به کاتالوگ</strong><small>منبع اطلاعات محصول برای پاسخ‌گویی.</small></div><span class="az-ai-catalog-dot"></span></div><div class="az-ai-catalog"><div><b id="aiCatalogProducts">—</b><span>محصول</span></div><div><b id="aiCatalogCategories">—</b><span>دسته</span></div><div><b id="aiCatalogVariants">—</b><span>محصول دارای واریانت</span></div></div><div id="aiCatalogStatus" class="status"></div></div>' +
        '<div class="az-ai-card"><div class="az-ai-card-head"><div><strong>آخرین فعالیت‌های AI</strong><small>تست‌ها و تغییرات ثبت‌شده در Audit Log.</small></div></div><div id="aiLogs" class="az-ai-logs"><div class="az-ai-log-empty">در حال بارگذاری…</div></div></div>' +
        '<div class="az-ai-card az-ai-rules"><strong>قواعد پیشنهادی فروش</strong><ul><li>قیمت و مشخصات فقط از داده واقعی کاتالوگ خوانده شود.</li><li>برای محصول ناموجود، گزینه جایگزین پیشنهاد شود؛ اطلاعات ساختگی نه.</li><li>اگر سؤال مبهم بود، قبل از پیشنهاد قطعی سؤال روشن‌کننده بپرسد.</li></ul></div>' +
      '</div>' +
    '</div>';
  }

  function aiProductsView() {
    return '<div class="az-ai-products-wrap"><div class="az-section-head"><div><span class="az-section-kicker">PRODUCT AI</span><h2>🤖 ربات محصولات</h2><p>هر محصول به‌صورت خودکار از دیتابیس خوانده می‌شود؛ سایز یا مدل انتخاب‌شده هم به AI می‌رسد.</p></div><span class="az-ai-live">LIVE</span></div><div class="az-ai-product-metrics"><div><span>کل محصولات</span><b id="aipTotal">—</b></div><div><span>فعال</span><b id="aipActive">—</b></div><div><span>دارای سایز/مدل</span><b id="aipVariants">—</b></div><div><span>درخواست امروز</span><b id="aipToday">—</b></div><div><span>توکن خروجی امروز</span><b id="aipOutputTokens">—</b></div></div><div class="az-ai-product-grid"><div class="az-ai-card"><div class="az-ai-card-head"><div><strong>تست واقعی ربات محصول</strong><small>محصول و واریانت واقعی را انتخاب کن.</small></div></div><div class="grid2"><div class="field full"><label>جستجوی محصول</label><div class="az-search-wrap"><span>⌕</span><input id="aipSearch" class="input" placeholder="نام یا کد محصول…" autocomplete="off"></div></div><div class="field full"><label>محصول</label><select id="aipProduct" class="select"><option value="">انتخاب محصول…</option></select></div><div class="field"><label>سایز / مدل</label><select id="aipVariant" class="select"><option value="">بدون واریانت</option></select></div><div class="field"><label>سؤال اختیاری</label><input id="aipQuestion" class="input" maxlength="600" placeholder="خالی = معرفی کوتاه و دقیق"></div><div class="field full"><button type="button" id="aipTestBtn" class="btn">🤖 تست ربات</button></div><div id="aipProductInfo" class="field full"></div><div id="aipResult" class="az-ai-product-result field full">هنوز تستی انجام نشده.</div><div id="aipStatus" class="status field full"></div></div></div><div class="az-ai-card"><div class="az-ai-card-head"><div><strong>اتصال خودکار</strong><small>نیازی به ساخت دستی برای هر محصول نیست.</small></div></div><div class="az-ai-product-rules"><div><b>۱</b><span>محصول جدید یا ویرایش‌شده ← اطلاعات زنده از دیتابیس.</span></div><div><b>۲</b><span>انتخاب سایز/مدل ← همان واریانت به AI.</span></div><div><b>۳</b><span>کلیک روی ربات ← فقط همان محصول خوانده می‌شود.</span></div><div><b>۴</b><span>پاسخ کوتاه و دقیق و بدون حدس.</span></div></div></div></div></div>';
  }

  async function loadAIProducts() {
    const el=$('aiProductsEditor'); if(!el) return; el.innerHTML=aiProductsView();
    const startOfDay=new Date(); startOfDay.setHours(0,0,0,0);
    const [tot,active,variantCount,usage]=await Promise.all([
      countTable('products'),
      countTable('products', q=>q.eq('is_active',true)),
      countTable('products', q=>q.not('variants','is',null)),
      state.db.from('ai_usage_logs').select('output_tokens,success,created_at').gte('created_at',startOfDay.toISOString()).limit(5000)
    ]);
    $('aipTotal').textContent=Number(tot||0).toLocaleString('fa-IR');
    $('aipActive').textContent=Number(active||0).toLocaleString('fa-IR');
    $('aipVariants').textContent=Number(variantCount||0).toLocaleString('fa-IR');
    const ur=usage?.data||[];
    $('aipToday').textContent=ur.filter(x=>x.success).length.toLocaleString('fa-IR');
    $('aipOutputTokens').textContent=ur.reduce((n,x)=>n+Number(x.output_tokens||0),0).toLocaleString('fa-IR');

    const search=$('aipSearch'), sel=$('aipProduct'); let cache=[];
    async function searchProducts(term=''){
      let rq=state.db.from('products').select('id,code,name,brand,description,category_name,variants,is_active').order('name').limit(30);
      term=String(term||'').trim().replace(/[(),]/g,' ');
      if(term) rq=rq.or('name.ilike.%'+term+'%,code.ilike.%'+term+'%');
      const rr=await rq;
      if(rr.error){$('aipStatus').textContent='__AZICON_ERROR__ '+errorText(rr.error);return;}
      cache=rr.data||[];
      sel.innerHTML='<option value="">انتخاب محصول…</option>'+cache.map(p=>'<option value="'+esc(p.id)+'">'+esc((p.code||'')+' · '+(p.name||'محصول'))+'</option>').join('');
      syncVariants();
    }
    function syncVariants(){
      const p=cache.find(x=>x.id===sel.value);
      const vs=Array.isArray(p?.variants)?p.variants.map(v=>String(v?.size??v?.label??v?.name??'').trim()).filter(Boolean):[];
      const vsel=$('aipVariant');
      vsel.innerHTML='<option value="">بدون واریانت / حالت پایه</option>'+vs.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
      $('aipProductInfo').innerHTML=p?'<div class="az-ai-product-info"><b>'+esc(p.name||'محصول')+'</b><span>'+esc(p.brand||p.category_name||'')+'</span><small>'+esc(p.description||'توضیح ثبت نشده')+'</small></div>':'';
    }
    await searchProducts('');
    let t=null;
    search.oninput=()=>{clearTimeout(t);t=setTimeout(()=>searchProducts(search.value),220);};
    sel.onchange=syncVariants;
    $('aipTestBtn').onclick=async()=>{
      const p=cache.find(x=>x.id===sel.value),status=$('aipStatus'),out=$('aipResult');
      if(!p){status.textContent='ابتدا محصول را انتخاب کن.';return;}
      const variant=$('aipVariant').value||'',message=$('aipQuestion').value.trim();
      status.textContent='در حال دریافت پاسخ واقعی AI…';out.textContent='در حال پاسخ‌گویی…';
      try{
        const rr=await fetch(String(window.AZIM_AI_API_URL||'/api/chat'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'product',product_id:p.id,product_code:p.code,variant_label:variant,message})});
        const d=await rr.json().catch(()=>({}));
        if(!rr.ok) throw Error(d.error||'HTTP '+rr.status);
        out.textContent=String(d.reply||'پاسخی دریافت نشد.');
        status.textContent='پاسخ '+(d.provider||'AI')+' برای '+(p.code||p.name)+(variant?' · '+variant:'')+' دریافت شد.';
        await audit('ai_product_test','products',p.id,{product_code:p.code,variant_label:variant,provider:d.provider||'api',result:'success'});
      }catch(e){
        out.textContent='پاسخ دریافت نشد.';
        status.textContent='__AZICON_ERROR__ '+errorText(e);
        await audit('ai_product_test','products',p.id,{product_code:p.code,variant_label:variant,result:'error'});
      }
    };
  }

  async function loadAI() {
    const r = await state.db.from('site_content').select('*').eq('section_key', 'ai_settings').maybeSingle();
    const row = r.data || null;
    if (r.error) {
      $('aiEditor').innerHTML = '<div class="empty">__AZICON_ERROR__ ' + esc(errorText(r.error)) + '</div>';
      return;
    }
    $('aiEditor').innerHTML = aiForm(row);
    const p = row?.payload || {};
    const enabled = p.enabled !== false;
    $('aiHealth').textContent = enabled ? '● فعال' : '● خاموش';
    $('aiHealth').className = 'badge ' + (enabled ? 'ok' : 'red');
    $('aiForm').onsubmit = (e) => saveAI(e, row);
    $('testAIButton').onclick = () => testAI();
    $('aiTestTop').onclick = () => testAI();
    $('aiChatForm').onsubmit = (e) => sendAIChat(e);
    document.querySelectorAll('[data-ai-prompt]').forEach((b) => {
      b.onclick = () => {
        $('aiChatInput').value = b.dataset.aiPrompt || '';
        $('aiChatInput').focus();
      };
    });
    await loadAICatalogStats();
    await loadAILogs();
  }

  async function loadAICatalogStats() {
    const [products, categories, variants] = await Promise.all([
      countTable('products'),
      countTable('categories'),
      countTable('products', q => q.not('variants', 'is', null))
    ]);
    if ($('aiCatalogProducts')) $('aiCatalogProducts').textContent = Number(products || 0).toLocaleString('fa-IR');
    if ($('aiCatalogCategories')) $('aiCatalogCategories').textContent = Number(categories || 0).toLocaleString('fa-IR');
    if ($('aiCatalogVariants')) $('aiCatalogVariants').textContent = Number(variants || 0).toLocaleString('fa-IR');
    if ($('aiCatalogStatus')) $('aiCatalogStatus').textContent = 'داده‌ها از دیتابیس فروشگاه خوانده می‌شوند.';
  }

  async function loadAILogs() {
    const el = $('aiLogs');
    if (!el) return;
    const r = await state.db.from('audit_logs').select('action,entity,entity_id,metadata,created_at').order('created_at', { ascending: false }).limit(80);
    if (r.error) { el.innerHTML = '<div class="az-ai-log-empty">ثبت فعالیت در دسترس نیست.</div>'; return; }
    const rows = (r.data || []).filter(x => x.entity === 'site_content' && (x.metadata?.section_key === 'ai_settings' || x.action === 'ai_test')).slice(0,8);
    el.innerHTML = rows.length ? rows.map(x =>
      '<div class="az-ai-log"><span class="az-ai-log-dot"></span><div><b>' + esc(x.action === 'ai_test' ? 'تست دستیار' : 'تغییر تنظیمات') + '</b><small>' + dateFa(x.created_at) + '</small></div><em>' + esc(x.metadata?.provider || x.metadata?.result || 'ثبت شد') + '</em></div>'
    ).join('') : '<div class="az-ai-log-empty">هنوز فعالیت AI ثبت نشده.</div>';
  }

  async function saveAI(e, row) {
    e.preventDefault();
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه تنظیم AI ندارد.');
    const s = e.target.elements;
    const existingPayload = (row && row.payload && typeof row.payload === 'object') ? row.payload : {};
    const payload = {
      ...existingPayload,
      enabled: s.enabled.checked,
      provider: s.provider.value,
      model: s.model.value.trim(),
      fallback_model: s.fallback_model.value.trim(),
      greeting: s.greeting.value.trim(),
      system_instruction: s.system_instruction.value.trim(),
      quick_prompts: s.quick_prompts.value.split('\\n').map((x) => x.trim()).filter(Boolean)
    };
    const p = { section_key: 'ai_settings', title: 'کنترل دستیار هوشمند', payload, is_active: true, updated_by: state.user.id };
    const r = row?.id
      ? await state.db.from('site_content').update(p).eq('id', row.id)
      : await state.db.from('site_content').insert(p);
    if (r.error) { $('aiStatus').textContent = '__AZICON_ERROR__ ' + errorText(r.error); return; }
    await audit('update', 'site_content', row?.id || 'ai_settings', { section_key: 'ai_settings', enabled: payload.enabled, provider: payload.provider });
    toast('__AZICON_SUCCESS__ تنظیمات AI ذخیره شد');
    await loadAI();
  }

  async function testAI() {
    const status = $('aiStatus');
    const top = $('aiTestTop');
    if (status) status.textContent = 'در حال تست اتصال به /api/chat…';
    if (top) top.disabled = true;
    try {
      const r = await fetch(String(window.AZIM_AI_API_URL||'/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'یک پاسخ خیلی کوتاه بده: برای انتخاب آچار چه چیزی مهم است؟' })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      const reply = String(data.reply || '').trim();
      if (status) status.textContent = '__AZICON_SUCCESS__ پاسخ دریافت شد: ' + reply.slice(0, 320);
      await audit('ai_test', 'site_content', 'ai_settings', { section_key: 'ai_settings', result: 'success', provider: data.provider || 'api' });
      await loadAILogs();
    } catch (e) {
      if (status) status.textContent = '__AZICON_ERROR__ تست AI ناموفق: ' + errorText(e);
      await audit('ai_test', 'site_content', 'ai_settings', { section_key: 'ai_settings', result: 'error' });
      await loadAILogs();
    } finally {
      if (top) top.disabled = false;
    }
  }

  async function sendAIChat(e) {
    e.preventDefault();
    const input = $('aiChatInput');
    const box = $('aiChatMessages');
    const status = $('aiChatStatus');
    const message = input?.value.trim();
    if (!message || !box) return;
    const userRow = document.createElement('div');
    userRow.className = 'az-ai-message user';
    userRow.innerHTML = '<b>مشتری</b><span>' + esc(message) + '</span>';
    box.appendChild(userRow);
    input.value = '';
    status.textContent = 'در حال دریافت پاسخ…';
    try {
      const r = await fetch(String(window.AZIM_AI_API_URL||'/api/chat'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({mode:'general',message}) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      const aiRow = document.createElement('div');
      aiRow.className = 'az-ai-message ai';
      aiRow.innerHTML = '<b>دستیار</b><span>' + esc(String(data.reply || 'پاسخی دریافت نشد.')) + '</span>';
      box.appendChild(aiRow);
      box.scrollTop = box.scrollHeight;
      status.textContent = '__AZICON_SUCCESS__ پاسخ دریافت شد';
      await audit('ai_test', 'site_content', 'ai_settings', { section_key:'ai_settings', result:'chat_success' });
      await loadAILogs();
    } catch (err) {
      status.textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  function setupAdminInvite() {
    const open=$('inviteAdminBtn'), box=$('adminInviteBox'), form=$('adminInviteForm'), cancel=$('cancelInviteBtn');
    if(!open||!box||!form) return;
    open.style.display=can.all()?'':'none';
    open.onclick=()=>{ box.hidden=false; $('inviteEmail')?.focus(); };
    cancel?.addEventListener('click',()=>{box.hidden=true;form.reset();if($('inviteStatus'))$('inviteStatus').textContent='';});
    form.addEventListener('submit',async(e)=>{
      e.preventDefault();
      if(!can.all()) return;
      const status=$('inviteStatus'), email=String($('inviteEmail')?.value||'').trim().toLowerCase(),
        name=String($('inviteName')?.value||'').trim(), role=String($('inviteRole')?.value||'sales');
      if(status)status.textContent='در حال ارسال دعوت…';
      try{
        const {data,error}=await state.db.functions.invoke('azim-admin-invite',{body:{email,name,role}});
        if(error)throw error;
        if(!data?.ok)throw new Error(data?.error||'ارسال دعوت ناموفق بود.');
        if(status)status.textContent='__AZICON_SUCCESS__ دعوت برای '+email+' ارسال شد.';
        form.reset();box.hidden=true;await loadAdmins();
      }catch(err){if(status)status.textContent='__AZICON_ERROR__ '+errorText(err);}
    });
  }

  async function loadAdmins() {
    const r = await state.db.from('admin_users').select('user_id,role,is_active,created_at').order('created_at');
    if (r.error) return showSectionError('adminsTable', r.error);
    const body = (r.data || []).map((x) =>
      '<tr><td dir="ltr" style="font-size:9px">' + esc(x.user_id) + '</td><td>' +
      (can.all() ? '<select class="select admin-role" data-id="' + x.user_id + '">' +
      ['owner','admin','editor','sales'].map((v) => '<option value="' + v + '" ' + (x.role === v ? 'selected' : '') + '>' + labels[v] + '</option>').join('') + '</select>' : esc(labels[x.role] || x.role)) +
      '</td><td>' + (can.all() ? '<input type="checkbox" class="admin-active" data-id="' + x.user_id + '" ' + (x.is_active ? 'checked' : '') + '>' : (x.is_active ? 'بله' : 'خیر')) +
      '</td><td>' + dateFa(x.created_at, false) + '</td></tr>'
    ).join('');
    $('adminsTable').innerHTML = body ?
      '<table class="table"><thead><tr><th>User UUID</th><th>نقش</th><th>فعال</th><th>تاریخ</th></tr></thead><tbody>' + body + '</tbody></table>' :
      '<div class="empty">مدیری ثبت نشده.</div>';
  }

  async function changeAdmin(id, field, value) {
    if (!can.all()) return toast('__AZICON_BLOCK__ فقط مالک/مدیر ارشد می‌تواند کاربران مدیر را تغییر دهد.');
    if (id === state.user.id && field === 'is_active' && value === false) return toast('حساب جاری را غیرفعال نکن.');
    if (id === state.user.id && field === 'role') return toast('نقش حساب جاری را از داخل همین نشست تغییر نده.');
    const p = {}; p[field] = value;
    try {
      const r = await state.db.from('admin_users').update(p).eq('user_id', id);
      if (r.error) throw r.error;
      await audit(field === 'role' ? 'role_change' : 'status_change', 'admin_users', id, p);
      toast('__AZICON_SUCCESS__ بروزرسانی شد');
    } catch (err) {
      toast('__AZICON_ERROR__ ' + errorText(err));
      await loadAdmins();
    }
  }

  async function loadSecurity() {
    const el = $('securityPanel');
    if (!el || !state.db || !state.user) return;
    el.innerHTML = '<div class="az-security-loading">در حال بررسی وضعیت امنیتی حساب…</div>';
    try {
      const [aal, factors, session] = await Promise.all([
        state.db.auth.mfa.getAuthenticatorAssuranceLevel(),
        state.db.auth.mfa.listFactors(),
        state.db.auth.getSession()
      ]);
      if (aal.error) throw aal.error;
      if (factors.error) throw factors.error;
      if (session.error) throw session.error;

      const current = aal.data?.currentLevel || 'aal1';
      const next = aal.data?.nextLevel || 'aal2';
      const totp = (factors.data?.totp || []).filter(x => x.status === 'verified');
      const pending = (factors.data?.totp || []).filter(x => x.status !== 'verified');
      const expiresAt = session.data?.session?.expires_at ? new Date(session.data.session.expires_at * 1000) : null;
      const expText = expiresAt ? expiresAt.toLocaleString('fa-IR') : 'نامشخص';
      const aalOk = current === 'aal2';

      el.innerHTML =
        '<div class="az-security-grid">' +
          '<div class="az-security-main">' +
            '<div class="az-security-hero">' +
              '<div><span class="az-security-kicker">SECURITY CENTER</span><h2>حساب مدیر تحت کنترل است</h2><p>مجوزهای مدیریتی دیتابیس فقط در نشست MFA سطح AAL2 قابل استفاده هستند.</p></div>' +
              '<div class="az-security-status ' + (aalOk ? 'ok' : 'warn') + '"><span></span><strong>' + (aalOk ? 'MFA فعال' : 'نیازمند MFA') + '</strong><small>' + esc(current.toUpperCase()) + '</small></div>' +
            '</div>' +
            '<div class="az-security-cards">' +
              '<div class="az-security-card"><span>سطح نشست</span><b>' + esc(current.toUpperCase()) + '</b><small>' + (aalOk ? 'تأیید دومرحله‌ای در این نشست برقرار است.' : 'بدون AAL2 دسترسی مدیریتی رد می‌شود.') + '</small></div>' +
              '<div class="az-security-card"><span>عامل TOTP</span><b>' + String(totp.length) + '</b><small>' + (totp.length ? 'عامل تأییدشده برای حساب وجود دارد.' : 'هیچ عامل TOTP تأییدشده‌ای ندارید.') + '</small></div>' +
              '<div class="az-security-card"><span>نشست بعدی</span><b>' + esc(next.toUpperCase()) + '</b><small>سطح اطمینان مورد انتظار برای عملیات حساس.</small></div>' +
              '<div class="az-security-card"><span>انقضای نشست</span><b dir="ltr" style="font-size:10px">' + esc(expText) + '</b><small>توکن نشست طبق تنظیمات Supabase مدیریت می‌شود.</small></div>' +
            '</div>' +
            '<div class="az-security-section">' +
              '<div class="az-security-section-head"><strong>کنترل‌های فعال</strong><small>بررسی‌های امنیتی قابل مشاهده از داخل پنل</small></div>' +
              '<div class="az-security-checks">' +
                '<div class="az-security-check ' + (aalOk ? 'ok' : 'bad') + '"><span>' + (aalOk ? '✓' : '!') + '</span><div><b>احراز هویت دومرحله‌ای</b><small>دسترسی حساس به نشست AAL2 وابسته است.</small></div></div>' +
                '<div class="az-security-check ' + (totp.length ? 'ok' : 'bad') + '"><span>' + (totp.length ? '✓' : '!') + '</span><div><b>Authenticator / TOTP</b><small>' + (totp.length ? 'عامل TOTP تأیید شده است.' : 'یک عامل TOTP باید فعال شود.') + '</small></div></div>' +
                '<div class="az-security-check ok"><span>✓</span><div><b>تفکیک نقش‌ها</b><small>دسترسی‌ها بر اساس owner / admin / editor / sales کنترل می‌شوند.</small></div></div>' +
                '<div class="az-security-check ok"><span>✓</span><div><b>ثبت رویدادها</b><small>عملیات مدیریتی حساس در Audit Log ثبت می‌شوند.</small></div></div>' +
              '</div>' +
            '</div>' +
            (pending.length ? '<div class="az-security-warning">یک عامل MFA در وضعیت انتظار تأیید است. قبل از خروج از این دستگاه، فعال‌سازی آن را کامل کنید.</div>' : '') +
          '</div>' +
          '<aside class="az-security-side">' +
            '<div class="az-security-section"><div class="az-security-section-head"><strong>عامل‌های MFA</strong><small>Supabase Auth</small></div><div class="az-security-factor-list">' +
              (totp.length ? totp.map(x => '<div class="az-security-factor"><span class="dot"></span><div><b>' + esc(x.friendly_name || 'TOTP') + '</b><small>تأیید شده · ' + esc(x.created_at ? dateFa(x.created_at,false) : '—') + '</small></div></div>').join('') : '<div class="az-security-empty">عامل تأییدشده‌ای ثبت نشده.</div>') +
            '</div></div>' +
            '<div class="az-security-section"><div class="az-security-section-head"><strong>اقدام امنیتی</strong></div><button id="securityRecheckBtn" class="btn" style="width:100%">بازبینی MFA</button><p class="az-security-note">برای تغییر عامل یا بازیابی MFA از تنظیمات Auth حساب Supabase استفاده کنید؛ این پنل هیچ secret یا seed را ذخیره نمی‌کند.</p></div>' +
          '</aside>' +
        '</div>';

      $('securityRecheckBtn')?.addEventListener('click', async () => {
        const ok = await requireAdminMFA();
        if (ok) { toast('__AZICON_SUCCESS__ نشست MFA تأیید شد'); await loadSecurity(); }
      });
    } catch (err) {
      el.innerHTML = '<div class="empty">__AZICON_ERROR__ بررسی امنیتی ناموفق: ' + esc(errorText(err)) + '</div>';
    }
  }

  async function loadReports() {
    const el=$('salesReport');
    if(!el) return;
    const days=Math.max(1,Math.min(3650,Number($('reportPeriod')?.value||30)||30));
    const since=new Date(Date.now()-days*86400000).toISOString();
    el.innerHTML='<div class="az-skeleton"></div>';
    const [o,i]=await Promise.all([
      state.db.from('orders').select('id,order_code,total,discount,shipping_cost,status,payment_status,created_at').gte('created_at',since).not('status','eq','cancelled').order('created_at',{ascending:true}).limit(5000),
      state.db.from('order_items').select('order_id,product_name,quantity,line_total')
    ]);
    if(o.error||i.error){ el.innerHTML='<div class="empty">__AZICON_ERROR__ دریافت گزارش فروش ناموفق بود: '+esc(errorText(o.error||i.error))+'</div>'; return; }
    const orders=o.data||[], items=i.data||[];
    const paidLike=new Set(['paid','partially_refunded','refunded']);
    const gross=orders.reduce((s,x)=>s+Number(x.total||0),0);
    const count=orders.length;
    const paid=orders.filter(x=>paidLike.has(String(x.payment_status||''))).reduce((s,x)=>s+Number(x.total||0),0);
    const avg=count?gross/count:0;
    const daily=new Map();
    const orderIds=new Set(orders.map(x=>x.id));
    for(const o of orders){
      const k=new Date(o.created_at).toISOString().slice(0,10);
      daily.set(k,(daily.get(k)||0)+Number(o.total||0));
    }
    const top=new Map();
    for(const x of items){
      if(!orderIds.has(x.order_id)) continue;
      const key=String(x.product_name||'بدون نام');
      const row=top.get(key)||{qty:0,amount:0};
      row.qty+=Number(x.quantity||0); row.amount+=Number(x.line_total||0); top.set(key,row);
    }
    const topRows=[...top.entries()].sort((a,b)=>b[1].qty-a[1].qty).slice(0,10);
    const dailyRows=[...daily.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    const card=(label,value,sub)=>'<div class="card"><div class="k">'+esc(label)+'</div><div class="v">'+esc(value)+'</div><div class="s">'+esc(sub||'')+'</div></div>';
    el.innerHTML='<div class="cards" style="margin-top:12px">'+
      card('سفارش غیرلغوشده',count.toLocaleString('fa-IR'),'در بازه انتخابی')+
      card('فروش ثبت‌شده',money(gross),'جمع کل سفارش‌ها')+
      card('پرداخت قطعی/عودت‌شده',money(paid),'بر اساس وضعیت پرداخت')+
      card('میانگین سفارش',money(Math.round(avg)),'بدون سفارش‌های لغوشده')+
      '</div>'+
      '<div class="panel" style="margin-top:14px"><div class="panel-head"><h3>روند روزانه فروش</h3><span class="muted">'+esc(days)+' روز اخیر</span></div>'+
      '<div class="table-wrap"><table class="table"><thead><tr><th>روز</th><th>فروش</th></tr></thead><tbody>'+
      (dailyRows.length?dailyRows.map(([d,v])=>'<tr><td dir="ltr">'+esc(d)+'</td><td>'+money(v)+'</td></tr>').join(''):'<tr><td colspan="2">داده‌ای نیست.</td></tr>')+
      '</tbody></table></div></div>'+
      '<div class="panel" style="margin-top:14px"><div class="panel-head"><h3>محصولات پرفروش</h3><span class="muted">بر مبنای تعداد</span></div>'+
      '<div class="table-wrap"><table class="table"><thead><tr><th>محصول</th><th>تعداد</th><th>مبلغ خطوط</th></tr></thead><tbody>'+
      (topRows.length?topRows.map(([n,v])=>'<tr><td>'+esc(n)+'</td><td>'+Number(v.qty).toLocaleString('fa-IR')+'</td><td>'+money(v.amount)+'</td></tr>').join(''):'<tr><td colspan="3">داده‌ای نیست.</td></tr>')+
      '</tbody></table></div></div>';
  }

  async function loadAudit() {
    const r = await state.db.from('audit_logs').select('id,actor_id,action,entity,entity_id,metadata,created_at').order('created_at', { ascending: false }).limit(120);
    if (r.error) return showSectionError('auditTable', r.error);
    const body = (r.data || []).map((x) =>
      '<tr><td>' + dateFa(x.created_at) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.entity) +
      '</td><td style="font-size:9px">' + esc(x.entity_id || '—') + '</td><td>' + esc(JSON.stringify(x.metadata || {})) + '</td></tr>'
    ).join('');
    $('auditTable').innerHTML = body ?
      '<table class="table"><thead><tr><th>زمان</th><th>عملیات</th><th>بخش</th><th>شناسه</th><th>جزئیات</th></tr></thead><tbody>' +
      body + '</tbody></table>' : '<div class="empty">هنوز فعالیتی ثبت نشده.</div>';
  }

  document.addEventListener('click', (e) => {
    const rvA = e.target.closest('[data-review-approve]'); if (rvA) { e.preventDefault(); moderateReview(rvA.dataset.reviewApprove, true); return; }
    const rvU = e.target.closest('[data-review-unapprove]'); if (rvU) { e.preventDefault(); moderateReview(rvU.dataset.reviewUnapprove, false); return; }
    const rvD = e.target.closest('[data-review-delete]'); if (rvD) { e.preventDefault(); deleteReview(rvD.dataset.reviewDelete); return; }
    const p = e.target.closest('[data-edit-product]'); if (p) editProduct(p.dataset.editProduct);
    const t = e.target.closest('[data-toggle-product]'); if (t) toggleProduct(t.dataset.toggleProduct);
    const c = e.target.closest('[data-edit-category]'); if (c) editCategory(c.dataset.editCategory);
    const ct = e.target.closest('[data-toggle-category]'); if (ct) toggleCategory(ct.dataset.toggleCategory);
    const b = e.target.closest('[data-edit-brand]'); if (b) editBrand(b.dataset.editBrand);
    const bt = e.target.closest('[data-toggle-brand]'); if (bt) toggleBrand(bt.dataset.toggleBrand);
    const i = e.target.closest('[data-edit-inquiry]'); if (i) editInquiry(i.dataset.editInquiry);
    const cu = e.target.closest('[data-edit-customer]'); if (cu) editCustomer(cu.dataset.editCustomer);
    const ro = e.target.closest('[data-restore-order]'); if (ro) { e.preventDefault(); e.stopPropagation(); openRestoreCancelledOrderConfirm(ro.dataset.restoreOrder); return; }
    const ocAction = e.target.closest('[data-order-control-action]');
    if (ocAction) {
      e.preventDefault();
      e.stopPropagation();
      handleOrderControlAction(ocAction.dataset.orderId || ocAction.closest('[data-order-card]')?.dataset.orderCard, ocAction.dataset.orderControlAction, ocAction);
      return;
    }
    const editFull = e.target.closest('[data-order-edit-full]');
    if (editFull) { e.preventDefault(); e.stopPropagation(); openOrderEditor(editFull.dataset.orderEditFull); return; }
    if (e.target.matches('#adminServiceRequestsPanel')) {
      e.preventDefault();
      $('closeServiceRequestsBtn')?.click();
      return;
    }
    const op = e.target.closest('[data-order-page]');
    if (op) {
      e.preventDefault();
      const targetPage = Number(op.dataset.orderPage || 1);
      if (!op.disabled && Number.isFinite(targetPage) && targetPage >= 1) {
        ordersPage = targetPage;
        loadOrders();
      }
      return;
    }
    const o = e.target.closest('[data-edit-order]'); if (o) { e.preventDefault(); openOrderEditor(o.dataset.editOrder); return; }
    const oc = e.target.closest('[data-order-card]'); if (oc) { e.preventDefault(); openOrder(oc.dataset.orderCard); return; }
    const sr = e.target.closest('[data-service-action]'); if (sr) { e.preventDefault(); e.stopPropagation(); handleAdminServiceRequest(sr.dataset.id, sr.dataset.kind, sr.dataset.action, sr); return; }
    const m = e.target.closest('[data-delete-media]'); if (m) deleteMedia(m.dataset.deleteMedia);
    const co = e.target.closest('[data-edit-content]'); if (co) editContent(co.dataset.editContent);
    const fc = e.target.closest('[data-filter-category]'); if (fc) { $('productSearch').value=''; if ($('productCategoryFilter')) $('productCategoryFilter').value=fc.dataset.filterCategory; setView('products'); }
  });

  document.addEventListener('keydown', (e) => {
    const card = e.target.closest?.('[data-order-card]');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openOrder(card.dataset.orderCard);
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('admin-role')) changeAdmin(e.target.dataset.id, 'role', e.target.value);
    if (e.target.matches('[data-product-select],#productSelectAll')) {
      const checks = document.querySelectorAll('[data-product-select]');
      const n = document.querySelectorAll('[data-product-select]:checked').length;
      $('productBulkBar')?.classList.toggle('show', n > 0);
      if ($('selectedProductCount')) $('selectedProductCount').textContent = n.toLocaleString('fa-IR') + ' انتخاب';
    }
    if (e.target.classList.contains('admin-active')) changeAdmin(e.target.dataset.id, 'is_active', e.target.checked);
  });

  (async function boot() {
    if (!window.supabase || !window.AZIM_SUPABASE_URL || !window.AZIM_SUPABASE_ANON_KEY) {
      $('loginScreen').classList.remove('hidden');
      $('loginStatus').textContent = 'پیکربندی Supabase ناقص است.';
      return;
    }
    ensureExtraUI();
    ensureDiscountSection();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installAnimatedIconLayer, { once: true }); else installAnimatedIconLayer();
    initAdminMenu();
    initCommandPalette();
    state.db = window.supabase.createClient(window.AZIM_SUPABASE_URL, window.AZIM_SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    $('loginBtn').onclick = async () => {
      const email = $('loginEmail').value.trim();
      const password = $('loginPassword').value;
      if (!email || !password) return $('loginStatus').textContent = 'ایمیل و رمز عبور را وارد کن.';
      $('loginStatus').textContent = 'در حال ورود…';
      const r = await state.db.auth.signInWithPassword({ email, password });
      if (r.error) return $('loginStatus').textContent = '__AZICON_ERROR__ ' + errorText(r.error);
      if (!(await ensureAdmin())) {
        await state.db.auth.signOut();
        return;
      }
      if (!(await requireAdminMFA())) return;
      setupAdminInvite();
      await loadDashboard();
    };

    if (await ensureAdmin()) {
      setupAdminInvite();
      if (await requireAdminMFA()) await loadDashboard();
    }
  })();
})();