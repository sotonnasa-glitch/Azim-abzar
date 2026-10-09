(function(){
  "use strict";
  if(window.__AZIM_NOTIFICATION_ADMIN__) return;
  window.__AZIM_NOTIFICATION_ADMIN__=true;

  const EVENT_INFO={
    order_created:["ثبت سفارش","بعد از ایجاد سفارش"],
    payment_paid:["پرداخت موفق","بعد از تأیید پرداخت"],
    payment_failed:["پرداخت ناموفق","وقتی پرداخت رد شود"],
    order_confirmed:["تأیید سفارش","وقتی سفارش تأیید شود"],
    order_processing:["شروع پردازش","وقتی سفارش وارد پردازش شود"],
    order_shipped:["ارسال سفارش","وقتی سفارش ارسال/رهگیری شد"],
    order_delivered:["تحویل سفارش","وقتی سفارش تحویل شود"],
    order_cancelled:["لغو سفارش","وقتی سفارش لغو شود"],
    return_requested:["ثبت مرجوعی","وقتی درخواست مرجوعی ثبت شود"],
    return_approved:["تأیید مرجوعی","وقتی مرجوعی تأیید شود"],
    return_rejected:["رد مرجوعی","وقتی مرجوعی رد شود"],
    refund_paid:["استرداد وجه","وقتی وضعیت استرداد تکمیل شود"]
  };
  const DEFAULTS={
    order_created:"عظیم ابزار | سفارش {{order_code}} ثبت شد. مبلغ: {{total}} تومان.",
    payment_paid:"عظیم ابزار | پرداخت سفارش {{order_code}} با موفقیت انجام شد.",
    payment_failed:"عظیم ابزار | پرداخت سفارش {{order_code}} ناموفق بود. در صورت نیاز دوباره تلاش کنید.",
    order_confirmed:"عظیم ابزار | سفارش {{order_code}} تأیید شد.",
    order_processing:"عظیم ابزار | سفارش {{order_code}} در حال پردازش است.",
    order_shipped:"عظیم ابزار | سفارش {{order_code}} ارسال شد. کد رهگیری: {{tracking_code}}",
    order_delivered:"عظیم ابزار | سفارش {{order_code}} تحویل شد.",
    order_cancelled:"عظیم ابزار | سفارش {{order_code}} لغو شد.",
    return_requested:"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} ثبت شد.",
    return_approved:"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} تأیید شد.",
    return_rejected:"عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} تأیید نشد.",
    refund_paid:"عظیم ابزار | مبلغ مرجوعی سفارش {{order_code}} ثبت و برای استرداد آماده شد."
  };
  let client=null, latest=null, lastBoot=false;

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function $(id){return document.getElementById(id);}
  function toast(msg){ if(typeof window.toast==="function") window.toast(msg); else alert(msg); }

  function css(){
    if($("az-notification-admin-style"))return;
    const s=document.createElement("style");s.id="az-notification-admin-style";
    s.textContent=`
      .az-notify-shell{display:grid;gap:14px}
      .az-notify-hero{padding:24px;border-radius:22px;border:1px solid rgba(245,185,0,.28);background:radial-gradient(circle at 88% 10%,rgba(245,185,0,.16),transparent 30%),linear-gradient(135deg,#141915,#0d110f);display:flex;justify-content:space-between;gap:20px;align-items:center}
      .az-notify-hero h2{margin:5px 0 6px;font-size:27px}.az-notify-hero p{margin:0;color:#8d978f;line-height:1.9;font-size:11px;max-width:780px}
      .az-notify-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .az-notify-card{border:1px solid #28322c;border-radius:18px;background:#0f1411;padding:17px}
      .az-notify-card h3{margin:0 0 5px;font-size:16px}.az-notify-card p{margin:0 0 13px;color:#78827a;font-size:10px;line-height:1.8}
      .az-notify-status{display:flex;align-items:center;gap:7px;font-size:10px;margin-bottom:12px}
      .az-notify-dot{width:9px;height:9px;border-radius:50%;background:#4b554e}.az-notify-dot.ok{background:#2ed573;box-shadow:0 0 12px rgba(46,213,115,.35)}
      .az-notify-events{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .az-notify-event{display:grid;grid-template-columns:auto 1fr;gap:9px;padding:10px;border:1px solid #202923;border-radius:12px;background:#101611}
      .az-notify-event small{display:block;color:#69736c;font-size:8px;margin-top:3px}
      .az-notify-template-grid{display:grid;gap:10px}
      .az-notify-template{display:grid;grid-template-columns:170px 1fr;gap:10px;align-items:start}
      .az-notify-template label{font-size:10px;padding-top:11px}.az-notify-template textarea{min-height:64px;resize:vertical}
      .az-notify-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
      .az-notify-actions .btn{min-height:38px}
      .az-notify-muted{font-size:9px;color:#69736c;line-height:1.8}
      .az-notify-test{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
      @media(max-width:820px){.az-notify-grid{grid-template-columns:1fr}.az-notify-hero{align-items:flex-start;flex-direction:column}.az-notify-events{grid-template-columns:1fr}.az-notify-template{grid-template-columns:1fr}.az-notify-template label{padding-top:0}.az-notify-test{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  async function ensureClient(){
    if(client)return client;
    if(!window.supabase||!window.AZIM_SUPABASE_URL||!window.AZIM_SUPABASE_ANON_KEY)return null;
    client=window.supabase.createClient(window.AZIM_SUPABASE_URL,window.AZIM_SUPABASE_ANON_KEY);
    return client;
  }

  async function edge(action,payload={}){
    const db=await ensureClient();
    if(!db)throw new Error("اتصال Supabase در دسترس نیست.");
    const sr=await db.auth.getSession();
    const token=sr?.data?.session?.access_token||"";
    if(!token)throw new Error("نشست مدیر منقضی شده است.");
    const r=await fetch(window.AZIM_SUPABASE_URL+"/functions/v1/azim-notification-config",{
      method:"POST",headers:{apikey:window.AZIM_SUPABASE_ANON_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify({action,...payload})
    });
    const body=await r.json().catch(()=>({}));
    if(!r.ok||body?.ok===false)throw new Error(body?.error||"عملیات اعلان ناموفق بود.");
    return body;
  }

  function activeConfig(){
    const s=latest?.settings||{};
    return {
      sms_enabled:!!s.sms_enabled,
      sms_sender:s.sms_sender||"",
      email_enabled:!!s.email_enabled,
      email_from:s.email_from||"",
      events:{...(s.events||{})},
      templates:{
        sms:{...(s.templates?.sms||{})},
        email:{...(s.templates?.email||{})}
      },
      email_subjects:{...(s.email_subjects||{})}
    };
  }

  async function load(){
    const panel=$("notificationAdminPanel");
    if(!panel)return;
    panel.innerHTML='<div class="panel"><div class="empty">در حال بارگذاری تنظیمات اعلان…</div></div>';
    try{ latest=await edge("get"); render(); }
    catch(e){panel.innerHTML='<div class="panel"><div class="empty">خطا: '+esc(e.message||e)+'</div></div>';}
  }

  function render(){
    const panel=$("notificationAdminPanel");if(!panel)return;
    const s=activeConfig(), configured=latest?.configured||{};
    const ev=s.events||{};
    panel.innerHTML=`
      <div class="az-notify-shell">
        <div class="az-notify-hero">
          <div><div class="az-section-kicker">NOTIFICATION CONTROL CENTER</div><h2>پیامک و ایمیل مشتری</h2><p>صاحب سایت کلید سرویس خودش را در اینجا ثبت می‌کند. کلیدها داخل مرورگر یا GitHub ذخیره نمی‌شوند. پیام‌های سفارش، پرداخت، ارسال، لغو و مرجوعی از تغییرات واقعی دیتابیس سفارش ساخته می‌شوند.</p></div>
          <div class="badge ${(configured.sms||configured.email)?'ok':'warn'}">${(configured.sms||configured.email)?'سرویس متصل':'نیازمند تنظیم'}</div>
        </div>

        <div class="az-notify-grid">
          <div class="az-notify-card">
            <h3>📱 پیامک — کاوه‌نگار <span class="az-notify-muted">(Kavenegar)</span></h3>
            <p>برای مشتری‌های ایرانی. اعتبار و هزینه پیامک از حساب خود صاحب سایت کسر می‌شود.</p>
            <div class="az-notify-status"><span class="az-notify-dot ${configured.sms?'ok':''}"></span><b>${configured.sms?'کلید API ذخیره شده':'کلید API تنظیم نشده'}</b></div>
            <div class="grid2">
              <div class="field"><label>فعال‌سازی پیامک</label><label style="display:flex;gap:8px;align-items:center;margin-top:9px"><input id="notifySmsEnabled" type="checkbox" ${s.sms_enabled?'checked':''}> <span>ارسال خودکار پیامک</span></label></div>
              <div class="field"><label>شماره فرستنده (اختیاری)</label><input id="notifySmsSender" class="input" dir="ltr" value="${esc(s.sms_sender)}" placeholder="خط ارسال کاوه‌نگار"></div>
              <div class="field full"><label>API Key <span class="az-notify-muted"> ${configured.sms?'(کلید فعلی حفظ می‌شود؛ برای تغییر، کلید جدید وارد کن)':''}</span></label><input id="notifySmsKey" class="input" type="password" dir="ltr" autocomplete="new-password" placeholder="${configured.sms?'کلید ذخیره شده':'API Key کاوه‌نگار'}"></div>
            </div>
            <div class="az-notify-test"><div class="field"><label>شماره تست</label><input id="notifySmsTest" class="input" dir="ltr" placeholder="0912xxxxxxx"></div><button id="notifySmsTestBtn" class="btn secondary" type="button">ارسال تست</button></div>
          </div>

          <div class="az-notify-card">
            <h3>✉️ ایمیل — Resend</h3>
            <p>برای رسید، وضعیت سفارش و پیام‌های تراکنشی. آدرس From باید در Resend مجاز باشد.</p>
            <div class="az-notify-status"><span class="az-notify-dot ${configured.email?'ok':''}"></span><b>${configured.email?'کلید API ذخیره شده':'کلید API تنظیم نشده'}</b></div>
            <div class="grid2">
              <div class="field"><label>فعال‌سازی ایمیل</label><label style="display:flex;gap:8px;align-items:center;margin-top:9px"><input id="notifyEmailEnabled" type="checkbox" ${s.email_enabled?'checked':''}> <span>ارسال خودکار ایمیل</span></label></div>
              <div class="field"><label>From</label><input id="notifyEmailFrom" class="input" dir="ltr" value="${esc(s.email_from)}" placeholder="sales@example.com"></div>
              <div class="field full"><label>API Key <span class="az-notify-muted"> ${configured.email?'(کلید فعلی حفظ می‌شود؛ برای تغییر، کلید جدید وارد کن)':''}</span></label><input id="notifyEmailKey" class="input" type="password" dir="ltr" autocomplete="new-password" placeholder="${configured.email?'کلید ذخیره شده':'API Key Resend'}"></div>
            </div>
            <div class="az-notify-test"><div class="field"><label>ایمیل تست</label><input id="notifyEmailTest" class="input" dir="ltr" placeholder="you@example.com"></div><button id="notifyEmailTestBtn" class="btn secondary" type="button">ارسال تست</button></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>کدام رویدادها پیام بفرستند؟</h2><span class="muted">بدون دست‌زدن به منطق سفارش</span></div>
          <div class="az-notify-events">
            ${Object.entries(EVENT_INFO).map(([k,v])=>`<label class="az-notify-event"><input type="checkbox" data-notify-event="${k}" ${ev[k]!==false?'checked':''}><span><b>${esc(v[0])}</b><small>${esc(v[1])}</small></span></label>`).join("")}
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>متن پیامک</h2><span class="muted">متغیرها: {{customer_name}} {{order_code}} {{total}} {{tracking_code}} {{refund_amount}}</span></div>
          <div class="az-notify-template-grid">
            ${Object.keys(EVENT_INFO).map(k=>`<div class="az-notify-template"><label>${esc(EVENT_INFO[k][0])}</label><textarea class="input" data-sms-template="${k}">${esc(s.templates.sms[k]||DEFAULTS[k]||"")}</textarea></div>`).join("")}
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>متن ایمیل و عنوان</h2><span class="muted">ایمیل با همان داده واقعی سفارش ساخته می‌شود.</span></div>
          <div class="az-notify-template-grid">
            ${Object.keys(EVENT_INFO).map(k=>`<div class="az-notify-template"><label>${esc(EVENT_INFO[k][0])}</label><div style="display:grid;gap:7px"><input class="input" data-email-subject="${k}" value="${esc(s.email_subjects[k]||"")}"><textarea class="input" data-email-template="${k}">${esc(s.templates.email[k]||"")}</textarea></div></div>`).join("")}
          </div>
        </div>

        <div class="panel">
          <div class="az-notify-actions">
            <button id="notifySaveBtn" class="btn" type="button">💾 ذخیره تنظیمات اعلان</button>
            <span class="az-notify-muted">ذخیره تنظیمات فقط برای owner/admin و بعد از MFA انجام می‌شود.</span>
          </div>
          <div id="notifyStatus" class="mfa-status"></div>
        </div>
      </div>`;
    bind();
  }

  function readPayload(){
    const events={};
    document.querySelectorAll("[data-notify-event]").forEach(x=>events[x.dataset.notifyEvent]=x.checked);
    const sms={}, email={}, subjects={};
    document.querySelectorAll("[data-sms-template]").forEach(x=>sms[x.dataset.smsTemplate]=x.value);
    document.querySelectorAll("[data-email-template]").forEach(x=>email[x.dataset.emailTemplate]=x.value);
    document.querySelectorAll("[data-email-subject]").forEach(x=>subjects[x.dataset.emailSubject]=x.value);
    return {
      sms_enabled:$("notifySmsEnabled").checked,
      sms_sender:$("notifySmsSender").value.trim(),
      sms_api_key:$("notifySmsKey").value.trim(),
      email_enabled:$("notifyEmailEnabled").checked,
      email_from:$("notifyEmailFrom").value.trim(),
      email_api_key:$("notifyEmailKey").value.trim(),
      events,
      templates:{sms,email},
      email_subjects:subjects
    };
  }

  async function save(){
    const status=$("notifyStatus");const btn=$("notifySaveBtn");
    btn.disabled=true;status.textContent="در حال ذخیره…";
    try{
      const result=await edge("save",readPayload());
      latest.settings=result.settings;
      latest.configured=result.configured;
      status.textContent="✅ تنظیمات اعلان ذخیره شد.";
      toast("تنظیمات پیامک و ایمیل ذخیره شد.");
      render();
    }catch(e){status.textContent="❌ "+(e.message||e);toast("ذخیره تنظیمات اعلان ناموفق بود.");}
    finally{btn.disabled=false;}
  }

  async function test(channel){
    const input=channel==="sms"?$("notifySmsTest"):$("notifyEmailTest");
    const value=input.value.trim();
    if(!value){toast(channel==="sms"?"شماره تست را وارد کن.":"ایمیل تست را وارد کن.");return;}
    try{
      toast("در حال ارسال پیام تست…");
      const result=await edge(channel==="sms"?"test_sms":"test_email",{
        receptor:value,
        message:channel==="sms"?"این پیام تستی از عظیم ابزار است.":"این یک ایمیل تستی از سامانه اعلان عظیم ابزار است.",
        subject:"تست اعلان | عظیم ابزار"
      });
      toast("✅ پیام تست ارسال شد.");
      console.info("Azim notification test:",result);
    }catch(e){toast("❌ "+(e.message||e));}
  }

  function bind(){
    $("notifySaveBtn")?.addEventListener("click",save);
    $("notifySmsTestBtn")?.addEventListener("click",()=>test("sms"));
    $("notifyEmailTestBtn")?.addEventListener("click",()=>test("email"));
  }

  function ensureView(){
    const main=document.querySelector(".main"), nav=document.querySelector(".nav");
    if(!main||!nav||!document.querySelector('[data-view="orders"]'))return;
    // Create the navigation control and its view independently. Returning early
    // when only one already exists could leave the settings tab permanently missing.
    if(!$('notificationNavBtn')){
      const b=document.createElement("button");b.id="notificationNavBtn";b.dataset.view="notifications";b.innerHTML="🔔 پیامک و ایمیل";
      const t=nav.querySelector('[data-view="orders"]');t?.after(b);
      b.addEventListener("click",activate);
    }
    if(!$("view-notifications")){
      const s=document.createElement("section");s.id="view-notifications";s.className="view";s.innerHTML='<div id="notificationAdminPanel"></div>';
      const before=$("view-security");before?.before(s)||main.appendChild(s);
    }
    css();
  }

  async function eligible(){
    const db=await ensureClient();if(!db)return false;
    const u=await db.auth.getUser();const user=u.data?.user;if(!user)return false;
    const r=await db.from("admin_users").select("role,is_active").eq("user_id",user.id).maybeSingle();
    return !!r.data?.is_active&&["owner","admin"].includes(String(r.data.role));
  }

  async function reconcile(){
    try{
      const ok=await eligible();
      if(ok){
        ensureView();
        // Re-query after ensureView(): it may have just created the button.
        const button=$("notificationNavBtn");
        if(button){button.style.display="";button.removeAttribute("aria-hidden");}
        lastBoot=true;
      }else{
        const button=$("notificationNavBtn");
        if(button){button.style.display="none";button.setAttribute("aria-hidden","true");}
      }
    }catch{}
  }

  async function activate(e){
    e?.preventDefault?.();e?.stopPropagation?.();
    if(!(await eligible())){toast("دسترسی این بخش فقط برای owner/admin است.");return;}
    ensureView();
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    document.querySelectorAll(".nav button").forEach(v=>v.classList.remove("active"));
    $("view-notifications").classList.add("active");
    $("notificationNavBtn").classList.add("active");
    $("pageTitle").textContent="پیامک و ایمیل";
    $("pageSub").textContent="اتصال اعلان‌های سفارش به سرویس پیامک و ایمیل صاحب سایت";
    await load();
  }

  const bootTimer=setInterval(reconcile,1200);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",reconcile,{once:true});else reconcile();
  window.addEventListener("beforeunload",()=>clearInterval(bootTimer));
})();