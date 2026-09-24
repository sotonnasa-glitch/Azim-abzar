(() => {
  'use strict';

  const URL = () => String(window.AZIM_SUPABASE_URL || '').trim();
  const KEY = () => String(window.AZIM_SUPABASE_ANON_KEY || '').trim();

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m] || m));

  const fmt = (value) => new Intl.NumberFormat('fa-IR').format(Number(value) || 0);

  async function fetchJson(path) {
    const base = URL();
    const key = KEY();
    if (!base || !key) throw new Error('اتصال دیتابیس فروشگاه تنظیم نشده است.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(base + path, {
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key
        },
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Supabase HTTP ' + response.status);
      return await response.json();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('دریافت دسته‌بندی‌ها بیشتر از زمان مجاز طول کشید.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizeCategory(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[ۀة]/g, 'ه')
      .replace(/\u200c/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function makeSection() {
    const existing = document.getElementById('azim-home-categories');
    if (existing) return existing;

    const section = document.createElement('section');
    section.id = 'azim-home-categories';
    section.className = 'az-home-categories';
    section.setAttribute('aria-labelledby', 'az-home-categories-title');

    const wrap = document.createElement('div');
    wrap.className = 'az-home-categories-wrap';

    wrap.innerHTML =
      '<div class="az-home-categories-head">' +
        '<div>' +
          '<span class="az-home-categories-kicker">LIVE CATALOG</span>' +
          '<h2 id="az-home-categories-title">دسته‌بندی واقعی محصولات</h2>' +
          '<p>دسته‌ها و تعداد کالاها مستقیماً از دیتابیس فروشگاه نمایش داده می‌شوند.</p>' +
        '</div>' +
        '<a class="az-home-categories-all" href="./products-v4.html">مشاهده همه محصولات ←</a>' +
      '</div>' +
      '<div class="az-home-categories-status" role="status" aria-live="polite">در حال دریافت دسته‌بندی‌ها…</div>' +
      '<div class="az-home-categories-grid" id="az-home-categories-grid"></div>';

    section.appendChild(wrap);

    const anchor = document.getElementById('azim-why-us');
    const choice = document.getElementById('azim-choice-guide');
    if (choice?.parentNode) {
      choice.parentNode.insertBefore(section, choice.nextSibling);
    } else if (anchor?.parentNode) {
      anchor.parentNode.insertBefore(section, anchor);
    } else {
      const footer = document.querySelector('footer');
      if (footer?.parentNode) footer.parentNode.insertBefore(section, footer);
      else document.body.appendChild(section);
    }

    return section;
  }

  function setError(section, message) {
    const status = section.querySelector('.az-home-categories-status');
    const grid = section.querySelector('#az-home-categories-grid');
    if (status) status.textContent = message;
    if (grid) {
      grid.innerHTML =
        '<div class="az-home-categories-error">' +
          '<strong>دسته‌بندی‌ها فعلاً بارگذاری نشدند.</strong>' +
          '<span>' + esc(message) + '</span>' +
          '<button type="button" class="az-home-categories-retry">تلاش دوباره</button>' +
        '</div>';
      grid.querySelector('.az-home-categories-retry')?.addEventListener('click', load);
    }
  }

  async function load() {
    const section = makeSection();
    const status = section.querySelector('.az-home-categories-status');
    const grid = section.querySelector('#az-home-categories-grid');

    if (status) status.textContent = 'در حال دریافت دسته‌بندی‌ها…';
    if (grid) grid.innerHTML = '';

    try {
      const [categories, products] = await Promise.all([
        fetchJson('/rest/v1/categories?select=name,slug,description,image,sort_order,is_active&is_active=eq.true&order=sort_order.asc&limit=100'),
        fetchJson('/rest/v1/products?select=category_name,cat&is_active=eq.true&limit=2000')
      ]);

      const rows = Array.isArray(categories) ? categories.filter(Boolean) : [];
      const counts = new Map();

      for (const product of (Array.isArray(products) ? products : [])) {
        const key = normalizeCategory(product?.category_name || product?.cat);
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      if (!rows.length) {
        if (status) status.textContent = 'هنوز دسته‌بندی فعالی در فروشگاه ثبت نشده است.';
        return;
      }

      const total = rows.reduce((sum, row) => sum + (counts.get(normalizeCategory(row.name)) || 0), 0);
      if (status) {
        status.innerHTML = '<span>' + fmt(rows.length) + ' دسته فعال</span><span>·</span><span>' + fmt(total) + ' محصول در دسته‌ها</span>';
      }

      rows.forEach((row, index) => {
        const name = String(row.name || '').trim();
        if (!name) return;

        const card = document.createElement('a');
        card.className = 'az-home-category-card';
        card.href = './products-v4.html?cat=' + encodeURIComponent(String(row.slug || name));
        card.setAttribute('aria-label', 'مشاهده محصولات دسته ' + name);

        const image = String(row.image || '').trim();
        const count = counts.get(normalizeCategory(name)) || 0;

        card.innerHTML =
          '<div class="az-home-category-icon">' +
            (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : '<span aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span>') +
          '</div>' +
          '<div class="az-home-category-copy">' +
            '<span class="az-home-category-index">CAT · ' + String(index + 1).padStart(2, '0') + '</span>' +
            '<strong>' + esc(name) + '</strong>' +
            '<small>' + esc(row.description || 'مشاهده محصولات این دسته') + '</small>' +
          '</div>' +
          '<div class="az-home-category-count"><b>' + fmt(count) + '</b><span>محصول</span><i>←</i></div>';

        grid.appendChild(card);
      });

      if (!grid.children.length) {
        if (status) status.textContent = 'دسته‌بندی معتبر برای نمایش پیدا نشد.';
      }
    } catch (error) {
      setError(section, error?.message || 'خطای نامشخص در دریافت دسته‌بندی‌ها.');
    }
  }

  function ready() {
    if (!document.querySelector('#home')) return;

    // This section is informative, not required for first paint or scrolling.
    // Start it during idle time so the initial interaction stays responsive.
    const start = () => load();
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(start, { timeout: 1400 });
    } else {
      window.setTimeout(start, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
})();