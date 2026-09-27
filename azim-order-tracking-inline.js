(() => {
  'use strict';

  const root = document.getElementById('azInlineOrderTracking');
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => {
    const s = String(value ?? '');
    return s.replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  };

  const money = (value) => {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat('fa-IR').format(Number.isFinite(n) ? n : 0) + ' تومان';
  };

  const faDate = (value) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(String(value)));
    } catch (_) {
      return '—';
    }
  };

  const normalizeCode = (value) => String(value || '').trim().toUpperCase();
  const normalizeMobile = (value) => {
    let s = String(value || '').trim()
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[\s\-()]/g, '');
    if (s.startsWith('+98')) s = '0' + s.slice(3);
    else if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2);
    return s;
  };

  const safeExternalUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, window.location.href);
      return /^https?:$/i.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  };

  const statusLabels = {
    pending: 'در انتظار تأیید',
    confirmed: 'تأیید شده',
    processing: 'در حال آماده‌سازی',
    shipped: 'ارسال شده',
    delivered: 'تحویل شده',
    cancelled: 'لغو شده'
  };

  const paymentLabels = {
    unpaid: 'پرداخت نشده',
    pending: 'در انتظار پرداخت',
    paid: 'پرداخت شده',
    partially_refunded: 'بخشی از وجه مسترد شده',
    refunded: 'مسترد شده',
    failed: 'پرداخت ناموفق',
    cancelled: 'پرداخت لغو شده',
    review_required: 'نیازمند بررسی'
  };

  const shippingLabels = {
    pending: 'در انتظار ارسال',
    packed: 'بسته‌بندی شده',
    shipped: 'تحویل به شرکت ارسال',
    delivered: 'تحویل شده'
  };

  const returnLabels = {
    pending: 'در حال بررسی',
    approved: 'تأیید شد',
    rejected: 'رد شد',
    received: 'کالا دریافت شد',
    closed: 'بسته شد'
  };

  let currentCode = '';
  let currentMobile = '';
  let refreshTimer = null;

  function setMessage(text, tone = '') {
    const el = $('azInlineTrackingMessage');
    if (!el) return;
    el.className = 'az-inline-track-message' + (tone ? ' ' + tone : '');
    el.textContent = text || '';
    el.hidden = !text;
  }

  async function callRpc(name, payload) {
    const url = (window.AZIM_SUPABASE_URL || '') + '/rest/v1/rpc/' + name;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: window.AZIM_SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + window.AZIM_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    let body = null;
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(body?.message || body?.hint || 'درخواست ناموفق بود.');
    return body;
  }

  function returnButton(item, data) {
    const reqs = Array.isArray(item.return_requests) ? item.return_requests : [];
    const latest = reqs[0];
    const active = ['pending','approved','received'].includes(latest?.status);
    if (!data.return_available || active || Number(item.returnable_quantity || 0) <= 0) return '';

    return '<button type="button" class="az-inline-action az-inline-return-btn" data-return-item="' +
      esc(item.id) + '">↩️ درخواست مرجوعی</button>';
  }

  function render(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const trackingUrl = safeExternalUrl(data.tracking_url);
    const currentStatus = statusLabels[data.status] || data.status || 'نامشخص';
    const currentShipping = shippingLabels[data.shipping_status] || data.shipping_status || '—';
    const payment = paymentLabels[data.payment_status] || data.payment_status || '—';

    const tracking = data.tracking_code
      ? '<div class="az-inline-track-shipment">' +
          '<div><span>کد رهگیری</span><strong dir="ltr">' + esc(data.tracking_code) + '</strong>' +
          (data.shipping_carrier ? '<small>شرکت ارسال: ' + esc(data.shipping_carrier) + '</small>' : '') +
          (trackingUrl ? '<a href="' + esc(trackingUrl) + '" target="_blank" rel="noopener noreferrer nofollow">🔗 پیگیری مرسوله</a>' : '') +
          '</div>' +
          '<button type="button" class="az-inline-copy" data-copy="' + esc(data.tracking_code) + '">کپی</button>' +
        '</div>'
      : '';

    const deadline = data.return_available && data.return_deadline_at
      ? '<div class="az-inline-note">مهلت درخواست مرجوعی: <b>' + esc(faDate(data.return_deadline_at)) + '</b></div>'
      : '';

    const paymentRetry = data.can_retry_payment === true
      ? '<button type="button" class="az-inline-action" id="azInlineRetryPayment">💳 ادامه پرداخت همین سفارش</button>'
      : '';

    const cancelAction = data.can_cancel && data.cancel_request_status !== 'pending'
      ? '<button type="button" class="az-inline-action danger" id="azInlineCancel">❌ درخواست لغو سفارش</button>'
      : (data.cancel_request_status === 'pending'
        ? '<span class="az-inline-badge">درخواست لغو در حال بررسی است</span>' : '');

    const itemHtml = items.length
      ? items.map((item) => {
          const reqs = Array.isArray(item.return_requests) ? item.return_requests : [];
          const latest = reqs[0];
          const variant = item?.variant && typeof item.variant === 'object'
            ? (item.variant.label || item.variant.size || item.variant.name || '')
            : String(item?.variant || '');
          const returnState = latest
            ? '<span class="az-inline-badge">مرجوعی: ' + esc(returnLabels[latest.status] || latest.status || '—') +
              (latest.refund_status === 'pending' ? ' · عودت وجه در انتظار' : '') + '</span>'
            : '';
          return '<article class="az-inline-item">' +
            '<div class="az-inline-item-main">' +
              '<strong>' + esc(item.product_name || 'محصول') + '</strong>' +
              '<span>تعداد: ' + esc(item.quantity || 0) +
              (variant ? ' · ' + esc(variant) : '') +
              ' · قابل مرجوعی: ' + esc(item.returnable_quantity || 0) + '</span>' +
            '</div>' +
            '<div class="az-inline-item-side">' + money(item.line_total) + '</div>' +
            (returnState ? '<div class="az-inline-item-status">' + returnState + '</div>' : '') +
            (returnButton(item, data) ? '<div class="az-inline-item-actions">' + returnButton(item, data) + '</div>' : '') +
          '</article>';
        }).join('')
      : '<div class="az-inline-empty">جزئیات اقلام سفارش در دسترس نیست.</div>';

    root.querySelector('.az-inline-result').innerHTML =
      '<div class="az-inline-result-head">' +
        '<div><span>سفارش</span><strong dir="ltr">' + esc(data.order_code) + '</strong></div>' +
        '<span class="az-inline-status">' + esc(currentStatus) + '</span>' +
      '</div>' +
      '<div class="az-inline-summary">' +
        '<div><span>پرداخت</span><b>' + esc(payment) + '</b></div>' +
        '<div><span>ارسال</span><b>' + esc(currentShipping) + '</b></div>' +
        '<div><span>مبلغ</span><b>' + money(data.total) + '</b></div>' +
        '<div><span>ثبت سفارش</span><b>' + esc(faDate(data.created_at)) + '</b></div>' +
      '</div>' +
      tracking +
      deadline +
      '<div class="az-inline-items"><h3>اقلام سفارش</h3>' + itemHtml + '</div>' +
      '<div class="az-inline-actions">' + cancelAction + paymentRetry + '</div>' +
      '<div id="azInlineActionBox" class="az-inline-action-box" hidden></div>';

    root.querySelector('.az-inline-result').hidden = false;

    root.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(button.getAttribute('data-copy') || '');
          button.textContent = 'کپی شد';
          setTimeout(() => { button.textContent = 'کپی'; }, 1200);
        } catch (_) {}
      });
    });

    root.querySelectorAll('[data-return-item]').forEach((button) => {
      button.addEventListener('click', () => openReturnForm(items.find((x) => String(x.id) === String(button.dataset.returnItem))));
    });

    $('azInlineCancel')?.addEventListener('click', openCancelForm);
    $('azInlineRetryPayment')?.addEventListener('click', () => retryPayment());
  }

  function showResultBox(message) {
    const box = root.querySelector('.az-inline-result');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<div class="az-inline-empty">' + esc(message) + '</div>';
  }

  function openActionBox(html) {
    const box = $('azInlineActionBox');
    if (!box) return null;
    box.hidden = false;
    box.innerHTML = html;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return box;
  }

  async function retryPayment() {
    try {
      setMessage('در حال اتصال دوباره به درگاه…', 'loading');
      const res = await fetch((window.AZIM_SUPABASE_URL || '') + '/functions/v1/azim-payment-gateway', {
        method: 'POST',
        headers: {
          apikey: window.AZIM_SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + window.AZIM_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'start', order_code: currentCode, mobile: currentMobile })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.error || 'شروع دوباره پرداخت ناموفق بود.');
      try {
        localStorage.setItem('azim_pending_payment', JSON.stringify({
          order_code: currentCode,
          transaction_id: body.transaction_id,
          status: 'pending'
        }));
      } catch (_) {}
      window.location.href = body.redirect_url;
    } catch (error) {
      setMessage(error?.message || 'شروع دوباره پرداخت ناموفق بود.', 'error');
    }
  }

  function openCancelForm() {
    const box = openActionBox(
      '<h3>درخواست لغو سفارش</h3>' +
      '<p>لغو فقط تا قبل از ارسال بسته ممکن است و درخواست ابتدا توسط فروشگاه بررسی می‌شود.</p>' +
      '<textarea id="azInlineCancelReason" maxlength="300" placeholder="دلیل لغو سفارش"></textarea>' +
      '<div class="az-inline-form-actions">' +
        '<button type="button" class="az-inline-action" id="azInlineSubmitCancel">ثبت درخواست لغو</button>' +
        '<button type="button" class="az-inline-action secondary" id="azInlineCloseAction">بستن</button>' +
      '</div>'
    );
    if (!box) return;
    $('azInlineCloseAction').onclick = closeActionBox;
    $('azInlineSubmitCancel').onclick = async () => {
      const reason = String($('azInlineCancelReason')?.value || '').trim();
      if (reason.length < 2) return setMessage('دلیل لغو را وارد کنید.', 'error');
      try {
        setMessage('در حال ثبت درخواست لغو…', 'loading');
        const result = await callRpc('azim_request_order_cancel', {
          p_order_code: currentCode,
          p_mobile: currentMobile,
          p_reason: reason
        });
        if (!result?.ok) throw new Error(result?.message || 'ثبت درخواست لغو ناموفق بود.');
        closeActionBox();
        await lookup(true);
        setMessage(result.message || 'درخواست لغو ثبت شد.', 'success');
      } catch (error) {
        setMessage(error?.message || 'ثبت درخواست لغو ناموفق بود.', 'error');
      }
    };
  }

  function openReturnForm(item) {
    if (!item) return;
    const max = Math.max(1, Number(item.returnable_quantity || 1));
    const box = openActionBox(
      '<h3>↩️ درخواست مرجوعی: ' + esc(item.product_name || 'محصول') + '</h3>' +
      '<p>این درخواست فقط برای همین قلم سفارش ثبت می‌شود.</p>' +
      '<label>تعداد</label>' +
      '<input id="azInlineReturnQty" type="number" min="1" max="' + max + '" value="1">' +
      '<label>دلیل مرجوعی</label>' +
      '<select id="azInlineReturnReason">' +
        '<option value="">انتخاب کنید</option>' +
        '<option>کالا معیوب است</option>' +
        '<option>کالای اشتباه ارسال شده</option>' +
        '<option>کالا با سفارش مغایرت دارد</option>' +
        '<option>کالا آسیب‌دیده به دستم رسیده</option>' +
        '<option>سایر</option>' +
      '</select>' +
      '<label>توضیحات بیشتر</label>' +
      '<textarea id="azInlineReturnDetails" maxlength="1000" placeholder="توضیح کوتاه برای بررسی فروشگاه"></textarea>' +
      '<div class="az-inline-form-actions">' +
        '<button type="button" class="az-inline-action" id="azInlineSubmitReturn">ثبت درخواست مرجوعی</button>' +
        '<button type="button" class="az-inline-action secondary" id="azInlineCloseAction">بستن</button>' +
      '</div>'
    );
    if (!box) return;
    $('azInlineCloseAction').onclick = closeActionBox;
    $('azInlineSubmitReturn').onclick = async () => {
      const quantity = Number($('azInlineReturnQty')?.value || 0);
      const reason = String($('azInlineReturnReason')?.value || '').trim();
      const details = String($('azInlineReturnDetails')?.value || '').trim();
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) return setMessage('تعداد مرجوعی نامعتبر است.', 'error');
      if (reason.length < 2) return setMessage('دلیل مرجوعی را انتخاب کنید.', 'error');
      try {
        setMessage('در حال ثبت درخواست مرجوعی…', 'loading');
        const result = await callRpc('azim_request_order_return', {
          p_order_code: currentCode,
          p_mobile: currentMobile,
          p_order_item_id: item.id,
          p_quantity: quantity,
          p_reason: reason,
          p_details: details || null
        });
        if (!result?.ok) throw new Error(result?.message || 'ثبت درخواست مرجوعی ناموفق بود.');
        closeActionBox();
        await lookup(true);
        setMessage(result.message || 'درخواست مرجوعی ثبت شد.', 'success');
      } catch (error) {
        setMessage(error?.message || 'ثبت درخواست مرجوعی ناموفق بود.', 'error');
      }
    };
  }

  function closeActionBox() {
    const box = $('azInlineActionBox');
    if (!box) return;
    box.hidden = true;
    box.innerHTML = '';
  }

  async function lookup(isRefresh = false) {
    const code = normalizeCode($('azInlineOrderCode')?.value);
    const mobile = normalizeMobile($('azInlineOrderMobile')?.value);

    if (!code) return setMessage('کد سفارش را وارد کنید.', 'error');
    if (!/^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{5}$/.test(code) && !/^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}$/.test(code)) {
      return setMessage('کد سفارش معتبر نیست.', 'error');
    }
    if (!/^09[0-9]{9}$/.test(mobile)) return setMessage('شماره موبایل معتبر وارد کنید.', 'error');

    currentCode = code;
    currentMobile = mobile;
    setMessage(isRefresh ? 'در حال بروزرسانی وضعیت…' : 'در حال دریافت وضعیت سفارش…', 'loading');

    const button = $('azInlineTrackBtn');
    if (button) button.disabled = true;

    try {
      const data = await callRpc('azim_order_status', {
        p_order_code: code,
        p_mobile: mobile
      });

      if (!data?.found) {
        showResultBox(data?.message || 'سفارشی با این مشخصات پیدا نشد.');
        return setMessage(data?.message || 'سفارش پیدا نشد.', 'error');
      }

      render(data);
      setMessage('آخرین وضعیت سفارش نمایش داده شد.', 'success');
    } catch (error) {
      showResultBox(error?.message || 'دریافت وضعیت سفارش ناموفق بود.');
      setMessage(error?.message || 'دریافت وضعیت سفارش ناموفق بود.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    if (!currentCode || !currentMobile) return;
    refreshTimer = setInterval(() => lookup(true), 60000);
  }

  $('azInlineTrackForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await lookup(false);
    scheduleRefresh();
  });

  root.querySelectorAll('[data-inline-code]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.getAttribute('data-inline-code') || '';
      const input = $('azInlineOrderCode');
      if (input) {
        input.value = value;
        input.focus();
      }
    });
  });
})();