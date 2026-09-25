(() => {
  'use strict';

  if (window.__AZIM_ADMIN_V35) return;
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
    productCacheLoaded: false,
    contentRows: []
  };

  const viewInfo = {
    dashboard: ['داشبورد', 'نمای کلی فروشگاه، سفارش‌ها، مشتریان و سلامت سیستم'],
    products: ['محصولات', 'افزودن، ویرایش، قیمت، تصویر، دسته و وضعیت نمایش'],
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
    'ai-products': ['ربات محصولات', 'مشاوره خودکار بر اساس اطلاعات واقعی کاتالوگ']
  };

  const labels = {
    new: 'جدید', in_progress: 'در حال بررسی', quoted: 'پیش‌فاکتور',
    answered: 'پاسخ داده شد', closed: 'بسته', spam: 'اسپم',
    pending: 'در انتظار', confirmed: 'تایید شده', processing: 'در حال پردازش',
    shipped: 'ارسال شده', delivered: 'تحویل شده', cancelled: 'لغو شده',
    unpaid: 'پرداخت نشده', paid: 'پرداخت شده', refunded: 'مرجوع شده',
    packed: 'بسته‌بندی شده',
    owner: 'مالک', admin: 'مدیر', editor: 'ویرایشگر', sales: 'فروش'
  };

  const can = {
    all: () => ['owner', 'admin'].includes(state.me?.role),
    edit: () => ['owner', 'admin', 'editor'].includes(state.me?.role),
    sales: () => ['owner', 'admin', 'sales'].includes(state.me?.role)
  };

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
    modal.classList.add('show');
  }

  function closeModal() {
    $('modal').classList.remove('show');
    $('modal').classList.remove('drawer-mode');
    $('modal').classList.remove('product-editor-modal');
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
      $('mfaChallengeLogoutBtn')?.addEventListener('click', async () => {
        await state.db.auth.signOut();
        $('mfaScreen')?.classList.add('hidden');
        $('loginScreen')?.classList.remove('hidden');
        const loginStatus = $('loginStatus');
        if (loginStatus) loginStatus.textContent = '';
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
    });
    const role = state.me?.role;
    const allowed = {
      dashboard:['owner','admin','editor','sales'],
      products:['owner','admin','editor','sales'],
      categories:['owner','admin','editor'],
      brands:['owner','admin','editor'],
      inquiries:['owner','admin','sales'],
      orders:['owner','admin','sales'],
      discounts:['owner','admin','sales'],
      'discount-codes':['owner','admin','sales'],
      customers:['owner','admin','sales'],
      media:['owner','admin','editor'],
      content:['owner','admin','editor'],
      admins:['owner','admin'],
      audit:['owner','admin'],
      security:['owner','admin'],
      ai:['owner','admin','editor'],
      'ai-products':['owner','admin','editor']
    };
    document.querySelectorAll('[data-menu-view]').forEach((btn) => {
      btn.style.display = (allowed[btn.dataset.menuView] || []).includes(role) ? '' : 'none';
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
      ['ai','هوش مصنوعی','چت عمومی و تنظیمات AI']
    ];
    let active = 0;
    function render(q='') {
      const nq = q.trim().toLowerCase();
      const matches = navItems.filter(x => !nq || (x[1]+' '+x[2]).toLowerCase().includes(nq));
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

    const main = document.querySelector('.main');
    const dash = $('view-dashboard');
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
    $('homeCopyBtn')?.addEventListener('click', () => openFocusedSiteEditor('home'));
    $('contactCopyBtn')?.addEventListener('click', () => openFocusedSiteEditor('contact'));
    $('homeCopyCard')?.addEventListener('click', () => openFocusedSiteEditor('home'));
    $('contactCopyCard')?.addEventListener('click', () => openFocusedSiteEditor('contact'));
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
  }

  function applyRoleUI() {
    const role = state.me?.role;
    const map = {
      products: ['owner', 'admin', 'editor', 'sales'],
      categories: ['owner', 'admin', 'editor'],
      brands: ['owner', 'admin', 'editor'],
      inquiries: ['owner', 'admin', 'sales'],
      orders: ['owner', 'admin', 'sales'],
      discounts: ['owner', 'admin', 'sales'],
      'discount-codes': ['owner', 'admin', 'sales'],
      customers: ['owner', 'admin', 'sales'],
      media: ['owner', 'admin', 'editor'],
      content: ['owner', 'admin', 'editor'],
      admins: ['owner', 'admin'],
      audit: ['owner', 'admin'],
      ai: ['owner', 'admin', 'editor']
    };
    document.querySelectorAll('.nav button[data-view]').forEach((b) => {
      const v = b.dataset.view;
      const allowed = !map[v] || map[v].includes(role);
      b.style.display = allowed ? '' : 'none';
    });
    if ($('newProductBtn')) $('newProductBtn').style.display = can.edit() ? '' : 'none';
    if ($('newCategoryBtn')) $('newCategoryBtn').style.display = can.edit() ? '' : 'none';
    if ($('newBrandBtn')) $('newBrandBtn').style.display = can.edit() ? '' : 'none';
    if ($('newContentBtn')) $('newContentBtn').style.display = can.edit() ? '' : 'none';
    if ($('uploadMediaBtn')) $('uploadMediaBtn').style.display = can.edit() ? '' : 'none';
  }

  function activeView() {
    return document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';
  }

  async function setView(name) {
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
    await loadSection(name);
  }

  function showSkeleton(id, rows = 5) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = '<div style="display:grid;gap:8px">' + Array.from({length: rows}, () => '<div class="az-skeleton"></div>').join('') + '</div>';
  }

  async function loadSection(name) {
    if (name === 'discounts') return loadDiscounts();
    if (name === 'discount-codes') return loadDiscountCodes();
    if (name === 'ai-products') return loadAIProducts();
    const skeletons = {
      products: 'productsTable', categories: 'categoriesTable', brands: 'brandsTable',
      inquiries: 'inquiriesTable', orders: 'ordersTable', customers: 'customersTable',
      media: 'mediaTable', content: 'contentTable', admins: 'adminsTable', audit: 'auditTable'
    };
    if (skeletons[name]) showSkeleton(skeletons[name]);
    try {
      if (name === 'dashboard') await loadDashboard();
      else if (name === 'products') await loadProducts();
      else if (name === 'categories') await loadCategories();
      else if (name === 'brands') await loadBrands();
      else if (name === 'inquiries') await loadInquiries();
      else if (name === 'orders') await loadOrders();
      else if (name === 'customers') await loadCustomers();
      else if (name === 'media') await loadMedia();
      else if (name === 'content') await loadContent();
      else if (name === 'ai') await loadAI();
      else if (name === 'admins') await loadAdmins();
      else if (name === 'audit') await loadAudit();
    } catch (e) {
      toast('__AZICON_ERROR__ ' + errorText(e));
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

    const [a, p] = await Promise.all([
      state.db.from('inquiries').select('id,full_name,mobile,subject,status,created_at').order('created_at', { ascending: false }).limit(6),
      state.db.from('products').select('id,name,brand,code,price,is_active,img,updated_at').order('updated_at', { ascending: false }).limit(6)
    ]);

    if (a.error) showSectionError('dashboardInquiries', a.error);
    else $('dashboardInquiries').innerHTML = renderInquiryTable(a.data || [], true);
    if (p.error) showSectionError('dashboardProducts', p.error);
    else $('dashboardProducts').innerHTML = renderProductTable(p.data || [], true);

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

  function healthItemModern(label, ok, value) {
    return '<div class="az-health-card"><div class="az-health-title">' + esc(label) + '</div><div class="az-health-value">' +
      (ok ? '__AZICON_SUCCESS__ آماده' : '__AZICON_WARNING__ بررسی') + '</div><div class="az-health-sub">' + esc(value) + '</div></div>';
  }
  function miniStat(label, value) {
    return '<div class="az-mini-stat"><b>' + esc(label) + '</b><strong>' + Number(value || 0).toLocaleString('fa-IR') + '</strong></div>';
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
        : money(p.price)) + '</td><td><span class="badge ' + (p.is_active ? 'ok' : 'red') + '">' +
        (p.is_active ? 'فعال' : 'غیرفعال') + '</span></td>' + actions + '</tr>';
    }).join('');
    return '<table class="table"><thead><tr><th>تصویر</th><th>محصول</th><th>کد</th><th>برند</th><th>قیمت</th><th>وضعیت</th>' +
      (compact ? '' : '<th>عملیات</th>') + '</tr></thead><tbody>' + body.replace(/<tr>/g, '<tr>') + '</tbody></table>';
  }

  function renderInquiryTable(rows, compact) {
    if (!rows.length) return '<div class="empty">درخواستی ثبت نشده است.</div>';
    const body = rows.map((x) =>
      '<tr><td>' + esc(x.full_name) + '</td><td dir="ltr">' + esc(x.mobile) + '</td><td>' +
      esc(x.subject || '—') + '</td><td><span class="badge warn">' + esc(labels[x.status] || x.status) +
      '</span></td><td>' + dateFa(x.created_at) + '</td>' +
      (compact ? '' : '<td><button class="btn secondary" data-edit-inquiry="' + x.id + '">مدیریت</button></td>') +
      '</tr>'
    ).join('');
    return '<table class="table"><thead><tr><th>نام</th><th>موبایل</th><th>موضوع</th><th>وضعیت</th><th>زمان</th>' +
      (compact ? '' : '<th>عملیات</th>') + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  let productSearchTimer = null;

  async function loadProducts() {
    await ensureCaches();
    let q = state.db.from('products')
      .select('id,name,brand,cat,code,badge,description,img,original_price,price,page,category_name,is_active,variants,discount_type,discount_value,discount_is_active,discount_starts_at,discount_ends_at,updated_at,created_at')
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
      let img = id ? (state.products.find((x) => x.id === id)?.img || null) : null;
      if (s.clearImage?.checked) img = null;
      const file = s.file?.files?.[0];
      if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = 'products/' + crypto.randomUUID() + '.' + ext;
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
      const p = {
        name: s.name.value.trim(),
        brand: s.brand.value.trim() || 'بدون برند',
        category_name: category || null,
        cat: category,
        code: nextCode,
        badge: s.badge.value.trim() || null,
        description: s.description.value.trim() || s.name.value.trim(),
        original_price: s.original_price.value ? Number(s.original_price.value) : null,
        price: s.price.value ? Number(s.price.value) : null,
        img,
        is_active: s.is_active.checked,
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
      const backup = {
        exported_at: new Date().toISOString(),
        version: 'azim-abzar-admin-backup-v1',
        products: state.products || [],
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
      const file = s.image_file?.files?.[0];
      if (file) {
        const path = 'categories/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
        if (up.error) throw up.error;
        image = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
      }
      const p = {
        name: s.name.value.trim(), slug: s.slug.value.trim(), sort_order: Number(s.sort_order.value || 0),
        description: s.description.value.trim() || null, image, is_active: s.is_active.checked
      };
      const r = id ? await state.db.from('categories').update(p).eq('id', id) : await state.db.from('categories').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'categories', id || 'new', { name: p.name });
      closeModal();
      toast('__AZICON_SUCCESS__ دسته ذخیره شد');
      await loadCategories();
    } catch (err) { $('categoryStatus').textContent = '__AZICON_ERROR__ ' + errorText(err); }
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
      const file = s.logo_file?.files?.[0];
      if (file) {
        const path = 'brands/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
        if (up.error) throw up.error;
        logo = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
      }
      const p = {
        name: s.name.value.trim(), slug: s.slug.value.trim(), sort_order: Number(s.sort_order.value || 0),
        description: s.description.value.trim() || null, logo, is_active: s.is_active.checked
      };
      const r = id ? await state.db.from('brands').update(p).eq('id', id) : await state.db.from('brands').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'brands', id || 'new', { name: p.name });
      closeModal();
      toast('__AZICON_SUCCESS__ برند ذخیره شد');
      await loadBrands();
    } catch (err) { $('brandStatus').textContent = '__AZICON_ERROR__ ' + errorText(err); }
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

  async function loadOrders() {
    const r = await state.db.from('orders')
      .select('id,order_code,customer_id,status,payment_status,shipping_status,subtotal,discount,discount_id,discount_code,shipping_cost,total,tracking_code,notes,created_at')
      .order('created_at', { ascending: false }).limit(200);
    if (r.error) return showSectionError('ordersTable', r.error);
    const rows = r.data || [];
    if (!rows.length) {
      $('ordersTable').innerHTML = '<div class="empty">هنوز سفارشی ثبت نشده؛ از «＋ سفارش جدید» استفاده کن.</div>';
      return;
    }

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

    const body = rows.map((x) => {
      const status = labels[x.status] || x.status || '—';
      const payment = labels[x.payment_status] || x.payment_status || '—';
      const shipping = labels[x.shipping_status] || x.shipping_status || '—';
      const discount = Number(x.discount || 0);

      return '<article class="az-order-card">' +
        '<div class="az-order-card-head">' +
          '<div class="az-order-code"><span>سفارش</span><strong dir="ltr">' + esc(x.order_code || '—') + '</strong><small>' + dateFa(x.created_at) + '</small></div>' +
          '<div class="az-order-statuses">' +
            '<span class="az-order-pill ' + statusTone(x.status) + '">' + esc(status) + '</span>' +
            '<span class="az-order-pill ' + statusTone(x.payment_status) + '">' + esc(payment) + '</span>' +
            '<span class="az-order-pill ' + statusTone(x.shipping_status) + '">' + esc(shipping) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="az-order-card-body">' +
          '<div class="az-order-total"><span>مبلغ نهایی</span><strong>' + money(x.total) + '</strong>' + (discount ? '<small>پس از ' + money(discount) + ' تخفیف</small>' : '<small>بدون تخفیف</small>') + '</div>' +
          '<div class="az-order-meta">' +
            '<div><span>قبل تخفیف</span><b>' + money(x.subtotal) + '</b></div>' +
            '<div><span>هزینه ارسال</span><b>' + (Number(x.shipping_cost || 0) ? money(x.shipping_cost) : 'هماهنگی با واحد فروش') + '</b></div>' +
            '<div><span>کد تخفیف</span><b dir="ltr">' + esc(x.discount_code || '—') + '</b></div>' +
            '<div><span>رهگیری</span><b dir="ltr">' + esc(x.tracking_code || '—') + '</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="az-order-card-foot">' +
          '<span class="az-order-foot-note">' + (x.customer_id ? 'مشتری ثبت‌شده' : 'بدون پرونده مشتری') + '</span>' +
          (can.sales() ? '<button class="btn secondary az-order-manage" data-edit-order="' + x.id + '">مدیریت سفارش <span>←</span></button>' : '') +
        '</div>' +
      '</article>';
    }).join('');

    $('ordersTable').innerHTML =
      '<div class="az-order-overview">' +
        stat('کل سفارش‌ها', rows.length.toLocaleString('fa-IR'), 'ثبت‌شده در پنل') +
        stat('در حال پیگیری', pendingCount.toLocaleString('fa-IR'), 'در چرخه پردازش') +
        stat('نیازمند پرداخت', unpaidCount.toLocaleString('fa-IR'), 'پرداخت نهایی نشده') +
        stat('ارزش سفارش‌ها', money(totalValue), 'جمع مبلغ نهایی') +
      '</div>' +
      '<div class="az-orders-list">' + body + '</div>';
  }

  async function loadCustomersForOrder() {
    const r = await state.db.from('customers').select('id,full_name,mobile').order('full_name');
    return r.data || [];
  }

  async function loadProductsForOrder() {
    if (state.productCacheLoaded) return state.products;
    const r = await state.db.from('products').select('id,name,code,price,is_active,discount_type,discount_value,discount_is_active,discount_starts_at,discount_ends_at').order('name').limit(1000);
    if (!r.error) { state.products = r.data || []; state.productCacheLoaded = true; }
    return state.products;
  }

  function orderTimeline(status) {
    const steps = ['pending','confirmed','processing','shipped','delivered'];
    const current = Math.max(0, steps.indexOf(status));
    return '<div class="az-order-timeline">' + steps.map((v,i) =>
      '<span class="az-order-step ' + (i < current ? 'done' : (i === current ? 'current' : '')) + '">' +
      '<i></i>' + esc(labels[v] || v) + '</span>'
    ).join('') + '</div>';
  }

  function orderForm(x, customers, items) {
    const customerOptions = customers.map((c) =>
      '<option value="' + esc(c.id) + '" ' + (x?.customer_id === c.id ? 'selected' : '') + '>' +
      esc(c.full_name) + ' · ' + esc(c.mobile) + '</option>'
    ).join('');
    const itemRows = (items || []).map((it, idx) => orderItemRow(it, idx)).join('');
    return '<div class="az-order-timeline-wrap">' + orderTimeline(x?.status || 'pending') + '</div><form id="orderForm" class="grid2">'
      '<div class="field"><label>کد سفارش *</label><input class="input" name="order_code" required value="' + esc(x?.order_code || newOrderCode()) + '"></div>' +
      '<div class="field"><label>مشتری</label><select class="select" name="customer_id"><option value="">بدون مشتری</option>' + customerOptions + '</select></div>' +
      '<div class="field"><label>وضعیت</label><select class="select" name="status">' + selectOptions(['pending','confirmed','processing','shipped','delivered','cancelled'], x?.status || 'pending', labels) + '</select></div>' +
      '<div class="field"><label>پرداخت</label><select class="select" name="payment_status">' + selectOptions(['unpaid','pending','paid','refunded'], x?.payment_status || 'unpaid', labels) + '</select></div>' +
      '<div class="field"><label>ارسال</label><select class="select" name="shipping_status">' + selectOptions(['pending','packed','shipped','delivered'], x?.shipping_status || 'pending', labels) + '</select></div>' +
      '<div class="field"><label>مبلغ نهایی</label><input class="input" name="total" type="number" min="0" value="' + esc(x?.total ?? 0) + '"><div id="orderTotalPreview" class="muted" style="margin-top:4px">' + money(x?.total ?? 0) + '</div></div>' +
      '<div class="field"><label>کد رهگیری</label><input class="input" name="tracking_code" value="' + esc(x?.tracking_code) + '"></div>' +
      '<div class="field"><label>کد تخفیف</label><div class="tools" style="width:100%"><input class="input" name="discount_code" dir="ltr" value="' + esc(x?.discount_code || '') + '" placeholder="مثلاً AZIM20"><button type="button" id="applyOrderDiscountBtn" class="btn secondary">اعمال تخفیف</button></div><div id="orderDiscountStatus" class="status"></div><input type="hidden" name="discount" value="' + esc(x?.discount ?? 0) + '"></div>' +
      '<div class="field"><label>هزینه ارسال</label><input class="input" name="shipping_cost" type="number" min="0" value="' + esc(x?.shipping_cost ?? 0) + '"></div>' +
      '<div class="field full"><label>یادداشت</label><textarea class="textarea" name="notes">' + esc(x?.notes) + '</textarea></div>' +
      '<div class="field full"><div class="panel" style="margin:0"><div class="panel-head"><h2>اقلام سفارش</h2><button type="button" id="addOrderItemBtn" class="btn secondary">＋ قلم</button></div>' +
      '<div id="orderItemsBox">' + (itemRows || '<div class="empty">قلمی اضافه نشده.</div>') + '</div></div></div>' +
      '<div class="field full"><button class="btn">ذخیره سفارش</button></div><div id="orderStatus" class="status field full"></div></form>';
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
    const productOptions = state.products.map((p) =>
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

  async function openOrder(id) {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی سفارش‌ها ندارد.');
    const [o, c, i] = await Promise.all([
      state.db.from('orders').select('*').eq('id', id).single(),
      loadCustomersForOrder(),
      state.db.from('order_items').select('*').eq('order_id', id)
    ]);
    if (o.error) return toast('__AZICON_ERROR__ ' + errorText(o.error));
    state.orderItems = i.data || [];
    await loadProductsForOrder();
    openModal('مدیریت سفارش', orderForm(o.data, c, state.orderItems));
    wireOrderForm(id);
  }

  async function newOrder() {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما اجازه ساخت سفارش ندارد.');
    const c = await loadCustomersForOrder();
    await loadProductsForOrder();
    state.orderItems = [];
    openModal('سفارش جدید', orderForm(null, c, []));
    wireOrderForm(null);
  }

  function readOrderItems() {
    return Array.from(document.querySelectorAll('#orderItemsBox .order-item-row')).map((row) => {
      const productId = row.querySelector('.item-product')?.value || null;
      const qtyRaw = Number(row.querySelector('.item-qty')?.value || 1);
      const qty = qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
      const price = Number(row.querySelector('.item-price')?.value || 0);
      const variantLabel = String(row.querySelector('.item-variant')?.value || '').trim();
      const product = state.products.find((p) => p.id === productId);
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
    document.querySelectorAll('#orderItemsBox .order-item-row').forEach((row) => {
      const q = Number(row.querySelector('.item-qty')?.value || 1);
      const p = Number(row.querySelector('.item-price')?.value || 0);
      const total = row.querySelector('.item-total');
      if (total) total.value = String(q * p);
    });
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
        const p = state.products.find((x) => x.id === e.target.value);
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

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      for (const item of items) {
        if (!UUID_RE.test(String(item.product_id || ''))) {
          throw new Error('شناسه یکی از محصولات سفارش نامعتبر است.');
        }
        if (item.order_item_id && !UUID_RE.test(String(item.order_item_id))) {
          throw new Error('شناسه یکی از اقلام سفارش نامعتبر است.');
        }
      }

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
        p_items: items
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
    if (!can.all()) return;
    const s = e.target.elements;
    const status = $('discountStatus');
    try {
      const name = s.name.value.trim();
      let code = s.code.value.trim().toUpperCase().replace(/\s+/g,'');
      const type = s.discount_type.value;
      const value = Number(s.value.value || 0);
      const min = Number(s.min_order_amount.value || 0);
      const max = s.max_discount.value === '' ? null : Number(s.max_discount.value);
      const usage = s.usage_limit.value === '' ? null : Number(s.usage_limit.value);
      const per = Number(s.per_customer_limit.value || 1);
      const starts = s.starts_at.value ? new Date(s.starts_at.value).toISOString() : new Date().toISOString();
      const ends = s.ends_at.value ? new Date(s.ends_at.value).toISOString() : null;
      const scope = s.applies_to.value;
      const checked = Array.from(document.querySelectorAll('#discountTargetList input[data-target-id]:checked')).map(el=>el.dataset.targetId);
      if (!name) throw new Error('عنوان تخفیف الزامی است.');
      if (e.target.dataset.codeRequired === '1' && !code) throw new Error('کد تخفیف برای این بخش الزامی است.');
      if (type === 'percentage' && (value < 1 || value > 100)) throw new Error('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.');
      if (type === 'fixed' && value < 1) throw new Error('مبلغ تخفیف باید بیشتر از صفر باشد.');
      if (min < 0) throw new Error('حداقل مبلغ سفارش نمی‌تواند منفی باشد.');
      if (max != null && max < 0) throw new Error('سقف تخفیف نمی‌تواند منفی باشد.');
      if (usage != null && usage < 1) throw new Error('سقف استفاده باید حداقل ۱ باشد.');
      if (per < 1) throw new Error('حداکثر استفاده هر مشتری باید حداقل ۱ باشد.');
      if (scope !== 'all' && !checked.length) throw new Error('برای این دامنه حداقل یک مورد را انتخاب کن.');
      if (ends && new Date(ends) <= new Date(starts)) throw new Error('پایان باید بعد از شروع باشد.');
      const payload = {
        name, code: code || null, discount_type:type, value,
        max_discount:max, min_order_amount:min, starts_at:starts, ends_at:ends,
        usage_limit:usage, per_customer_limit:per, first_order_only:s.first_order_only.checked,
        auto_apply:s.auto_apply.checked, applies_to:scope, priority:Number(s.priority.value||0),
        is_active:s.is_active.checked, notes:s.notes.value.trim()||null, created_by:state.user.id
      };
      let rid=id;
      let r = id
        ? await state.db.from('discounts').update({...payload, updated_at:new Date().toISOString()}).eq('id',id)
        : await state.db.from('discounts').insert(payload).select('id').single();
      if (r.error) throw r.error;
      rid = rid || r.data.id;

      const tables = [
        ['discount_products','product_id'],
        ['discount_categories','category_id'],
        ['discount_brands','brand_id'],
        ['discount_customers','customer_id']
      ];
      for (const [table] of tables) {
        const d = await state.db.from(table).delete().eq('discount_id',rid);
        if (d.error) throw d.error;
      }
      if (scope !== 'all' && checked.length) {
        const table = scope === 'products' ? 'discount_products' : scope === 'categories' ? 'discount_categories' : scope === 'brands' ? 'discount_brands' : 'discount_customers';
        const key = scope === 'products' ? 'product_id' : scope === 'categories' ? 'category_id' : scope === 'brands' ? 'brand_id' : 'customer_id';
        const ins = await state.db.from(table).insert(checked.map(v=>({discount_id:rid,[key]:v})));
        if (ins.error) throw ins.error;
      }
      await audit(id?'update':'create','discounts',rid,{name,code,scope,type,value,targets:checked.length});
      closeModal();
      toast('__AZICON_SUCCESS__ تخفیف ذخیره شد');
      await loadDiscounts();
      await loadDiscountCodes();
    } catch (err) {
      if (status) status.textContent = '__AZICON_ERROR__ ' + errorText(err);
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
      if (total) total.textContent = money(Math.max(0, subtotal + Number(form.elements.shipping_cost.value||0) - result.discount));
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