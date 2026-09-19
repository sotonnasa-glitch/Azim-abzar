(() => {
  'use strict';
  if (window.__AZIM_LIVE_CONTENT_V2) return;
  window.__AZIM_LIVE_CONTENT_V2 = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function setText(el, value, allowEmpty = false) {
    if (!el || value == null) return;
    if (!allowEmpty && String(value).trim() === '') return;
    el.textContent = String(value);
  }

  function setAttr(el, attr, value) {
    if (el && value != null && String(value).trim() !== '') el.setAttribute(attr, String(value));
  }

  async function loadContent() {
    if (!window.AZIM_SUPABASE_URL || !window.AZIM_SUPABASE_ANON_KEY) return {};
    try {
      const url = window.AZIM_SUPABASE_URL + '/rest/v1/site_content?select=section_key,payload,is_active&is_active=eq.true&limit=50';
      const r = await fetch(url, { headers: {
        apikey: window.AZIM_SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + window.AZIM_SUPABASE_ANON_KEY
      }, cache: 'no-store' });
      if (!r.ok) return {};
      const rows = await r.json();
      return Object.fromEntries((rows || []).map(x => [x.section_key, x.payload || {}]));
    } catch (_) { return {}; }
  }

  function applyHomeLegacy(c) {
    const meta = c.home_meta || {};
    if (meta.title) document.title = meta.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && meta.description) desc.setAttribute('content', meta.description);
    const hero = c.home_hero || {};
    const heroRoot = document.querySelector('#home .hero .copy');
    if (heroRoot) {
      setText(heroRoot.querySelector('.eyebrow'), hero.eyebrow);
      const h1 = heroRoot.querySelector('h1');
      if (h1) {
        const span = h1.querySelector('span');
        if (hero.title) {
          if (span) {
            h1.childNodes.forEach(n => { if (n.nodeType === 3) n.textContent = ''; });
            if (h1.firstChild) h1.firstChild.textContent = hero.title;
            else h1.insertBefore(document.createTextNode(hero.title), span);
          } else h1.textContent = hero.highlight ? hero.title + ' ' + hero.highlight : hero.title;
        }
        if (span && hero.highlight) span.textContent = hero.highlight;
      }
      setText(heroRoot.querySelector('p'), hero.description);
      if (Array.isArray(hero.trust_badges)) heroRoot.querySelectorAll('.trust-badge').forEach((el,i) => {
        if (hero.trust_badges[i]) {
          const textNode = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
          if (textNode) textNode.textContent = ' ' + hero.trust_badges[i];
        }
      });
      const links = heroRoot.querySelectorAll('.actions a.btn');
      [hero.primary_cta,hero.secondary_ai_cta,hero.contact_cta].forEach((v,i) => {
        if (links[i] && v) {
          const target = links[i].querySelector('.az-arrow')?.previousSibling?.previousSibling || links[i].querySelector('span:nth-of-type(2)');
          setText(target, v);
        }
      });
    }
    const choice = c.home_choice || {};
    const cr = document.querySelector('#azim-choice-guide');
    if (cr) {
      setText(cr.querySelector('.sectionHead .eyebrow'), choice.eyebrow);
      setText(cr.querySelector('.sectionHead .title'), choice.title);
      setText(cr.querySelector('.sectionHead .lead'), choice.lead);
    }
    const why = c.home_why || {};
    const wr = document.querySelector('#azim-why-us');
    if (wr) {
      setText(wr.querySelector('.sectionHead .eyebrow'), why.eyebrow);
      setText(wr.querySelector('.sectionHead .title'), why.title);
      setText(wr.querySelector('.sectionHead .lead'), why.lead);
    }
  }

  function applyHomeCopy(copy, fallback) {
    const h = copy.home || {};
    const legacyMeta = fallback.home_meta || {};
    const legacyHero = fallback.home_hero || {};
    const header = h.header || {};
    setText(document.querySelector('.brand strong'), header.brand);
    setText(document.querySelector('.brand small'), header.tagline);
    const navMap = [
      ['#nav-btn-home',header.nav_home],['#nav-btn-catalog',header.nav_products],['#nav-btn-ai',header.nav_ai],['#nav-btn-contact',header.nav_contact]
    ];
    navMap.forEach(([sel,v]) => { const a=document.querySelector(sel); if (a && v) setText(a.querySelector(':scope > span:last-child'),v); });

    const tops = h.topbar || [];
    document.querySelectorAll('.top .top-content .top-right > span').forEach((el,i) => {
      if (tops[i]) el.innerHTML = i===0 ? '<span class="live-dot" aria-hidden="true"></span> ' + esc(tops[i]) : esc(tops[i]);
    });

    const hero = h.hero || legacyHero;
    const heroRoot = document.querySelector('#home .hero .copy');
    if (heroRoot) {
      setText(heroRoot.querySelector('.eyebrow'),hero.eyebrow);
      const h1=heroRoot.querySelector('h1');
      if(h1){
        const span=h1.querySelector('span');
        if(span && hero.highlight!=null){
          Array.from(h1.childNodes).filter(n=>n.nodeType===3).forEach(n=>n.textContent='');
          if (h1.firstChild) h1.firstChild.textContent=hero.title||'';
          else h1.insertBefore(document.createTextNode(hero.title||''),span);
          setText(span,hero.highlight,true);
        } else if(hero.title) setText(h1,hero.title);
      }
      setText(heroRoot.querySelector('p'),hero.description);
      if(Array.isArray(hero.trust)) heroRoot.querySelectorAll('.trust-badge').forEach((el,i)=>{
        if(hero.trust[i]) {
          const textNode=Array.from(el.childNodes).find(n=>n.nodeType===3 && n.textContent.trim());
          if(textNode) textNode.textContent=' '+hero.trust[i];
        }
      });
      const links=heroRoot.querySelectorAll('.actions a.btn');
      [hero.primary_cta,hero.secondary_ai_cta,hero.contact_cta].forEach((v,i)=>{
        if(links[i] && v){
          const target=links[i].querySelector('.az-arrow')?.previousSibling?.previousSibling || links[i].querySelector('span:nth-of-type(2)');
          setText(target,v);
        }
      });
    }

    const hud=h.hud||{};
    setText(document.querySelector('.az-hud-label'),hud.label);
    setText(document.querySelector('.az-hud-badge'),hud.badge);
    setText(document.querySelector('#az-gauge-num'),hud.value);
    setText(document.querySelector('.az-gauge-unit'),hud.unit);
    document.querySelectorAll('.az-hud-tag').forEach((el,i)=>{if(hud.specs?.[i]) setText(el,hud.specs[i]);});
    document.querySelectorAll('.az-floating-chip').forEach((el,i)=>{
      const pair=hud.chips?.[i];
      if(pair){setText(el.querySelector('strong'),pair[0]);setText(el.querySelector('small'),pair[1]);}
    });

    const ticker=h.ticker||[];
    if(ticker.length){
      document.querySelectorAll('.az-ticker-track .az-ticker-item').forEach((el,i)=>setText(el,ticker[i%ticker.length],true));
    }

    const choice=h.choice||{};
    const cr=document.querySelector('#azim-choice-guide');
    if(cr){
      setText(cr.querySelector('.sectionHead .eyebrow'),choice.eyebrow);
      setText(cr.querySelector('.sectionHead .title'),choice.title);
      setText(cr.querySelector('.sectionHead .lead'),choice.lead);
      const cards=cr.querySelectorAll('.az-choice');
      (choice.cards||[]).forEach((v,i)=>{
        const card=cards[i]; if(!card||!v) return;
        setText(card.querySelector('.az-choice-num'),v[0]);
        setText(card.querySelector('strong'),v[1]);
        setText(card.querySelector('small'),v[2]);
        setText(card.querySelector('b'),v[3]);
      });
    }

    const why=h.why||{};
    const wr=document.querySelector('#azim-why-us');
    if(wr){
      setText(wr.querySelector('.sectionHead .eyebrow'),why.eyebrow);
      setText(wr.querySelector('.sectionHead .title'),why.title);
      setText(wr.querySelector('.sectionHead .lead'),why.lead);
      wr.querySelectorAll('.az-feat-card').forEach((card,i)=>{
        const v=why.items?.[i]; if(v){setText(card.querySelector('h3'),v[0]);setText(card.querySelector('p'),v[1]);}
      });
    }

    const ft=h.footer||{};
    const homeFooter=document.querySelector('#home ~ footer, body > footer');
    if(homeFooter){
      setText(homeFooter.querySelector('.wrap > span'),ft.text);
      homeFooter.querySelectorAll('div a').forEach((a,i)=>{if(ft.links?.[i]) setText(a,ft.links[i]);});
    }

    const metaTitle=legacyMeta.title || document.title;
    if(metaTitle && !h.header?.brand) document.title=metaTitle;
  }

  function applyContactCopy(copy, fallback) {
    const p=copy.contact||{};
    const header=p.header||{};
    setText(document.querySelector('#header-brand strong'),header.brand);
    setText(document.querySelector('#header-brand small'),header.tagline);
    setText(document.querySelector('#btn-back-prev span:last-child'),header.back);

    const hero=p.hero||fallback.contact_page||{};
    setText(document.querySelector('.hero-title'),hero.title);
    setText(document.querySelector('.hero-desc'),hero.description);
    setText(document.querySelector('.hero-action-phone span'),hero.call_cta);
    setText(document.querySelector('.hero-action-online span'),hero.form_cta);

    const ch=p.channels_head||{};
    setText(document.querySelector('.panel-head-title > span'),ch.title);
    setText(document.querySelector('.panel-head p'),ch.description);

    const phone=p.phone||{};
    const pc=document.querySelector('#card-channel-phone');
    if(pc){setText(pc.querySelector('.channel-title'),phone.title);setText(pc.querySelector('.channel-pill'),phone.pill);setText(pc.querySelector('.channel-value'),phone.value);setText(pc.querySelector('.channel-sub'),phone.sub);setText(pc.querySelector('button[onclick*="copyValue"] span'),phone.copy);setText(pc.querySelector('a.channel-action-btn span'),phone.call);if(phone.value){const digits=String(phone.value).replace(/[^\d+]/g,'');pc.querySelectorAll('a[href^="tel:"]').forEach(a=>a.setAttribute('href','tel:'+digits.replace(/^0+/,'+98')));}}
    const support=p.support||{};
    const sc=document.querySelector('#card-channel-support');
    if(sc){setText(sc.querySelector('.channel-title'),support.title);setText(sc.querySelector('.channel-pill'),support.pill);setText(sc.querySelector('.channel-value'),support.value);setText(sc.querySelector('.channel-sub'),support.sub);setText(sc.querySelector('.channel-actions span'),support.button);}
    const email=p.email||fallback.contact_page||{};
    const ec=document.querySelector('#card-channel-email');
    if(ec){
      setText(ec.querySelector('.channel-title'),email.title);
      setText(ec.querySelector('.channel-pill'),email.pill);
      setText(ec.querySelector('.channel-value'),email.value);
      setText(ec.querySelector('.channel-sub'),email.sub);
      setText(ec.querySelector('button[onclick*="copyValue"] span'),email.copy);
      setText(ec.querySelector('a.channel-action-btn span'),email.send);
      if(email.value){setAttr(ec.querySelector('a[href^="mailto:"]'),'href','mailto:'+email.value);const b=ec.querySelector('button[onclick*="copyValue"]');if(b)b.setAttribute('onclick',"copyValue("+JSON.stringify(String(email.value))+", "+JSON.stringify("ایمیل فروشگاه کپی شد")+")");}
      document.querySelectorAll('[data-contact-email]').forEach(el=>setText(el,email.value));
    }
    const address=p.address||{};
    const ac=document.querySelector('#card-channel-address');
    if(ac){setText(ac.querySelector('.channel-title'),address.title);setText(ac.querySelector('.channel-pill'),address.pill);setText(ac.querySelector('.channel-value'),address.value);setText(ac.querySelector('.channel-sub'),address.sub);setText(ac.querySelector('.channel-actions span'),address.button);}
    
    const hours=p.hours||{};
    const hc=document.querySelector('.hours-card');
    if(hc){setText(hc.querySelector('.hours-header h3'),hours.title);setText(hc.querySelector('.status-badge span:last-child'),hours.status);hc.querySelectorAll('.hours-row').forEach((row,i)=>{const v=hours.rows?.[i];if(v){setText(row.querySelector('span'),v[0]);setText(row.querySelector('b'),v[1]);}});}
    
    const form=p.form||{};
    const fh=document.querySelector('#contactForm')?.closest('.panel')?.querySelector('.panel-head');
    if(fh){setText(fh.querySelector('.panel-head-title > span'),form.title);setText(fh.querySelector('p'),form.description);}
    setText(document.querySelector('.quick-chips-label'),form.topicsLabel);
    document.querySelectorAll('.quick-chips .chip-btn').forEach((b,i)=>{if(form.topics?.[i]){setText(b,form.topics[i]);b.setAttribute('onclick','fillTopic('+JSON.stringify(form.topics[i])+')');}});
    const labelMap=[['#frm-fullname',form.fullnameLabel],['#frm-mobile',form.mobileLabel],['#frm-subject',form.subjectLabel],['#frm-business',form.businessLabel],['#frm-details',form.detailsLabel]];
    labelMap.forEach(([id,v])=>{const el=document.querySelector('label[for="'+id.slice(1)+'"]');if(el) setText(el,v);});
    setAttr(document.querySelector('#frm-fullname'),'placeholder',form.fullnamePlaceholder);
    setAttr(document.querySelector('#frm-mobile'),'placeholder',form.mobilePlaceholder);
    setAttr(document.querySelector('#frm-business'),'placeholder',form.businessPlaceholder);
    setAttr(document.querySelector('#frm-details'),'placeholder',form.detailsPlaceholder);
    const subject=document.querySelector('#frm-subject');
    if(subject && Array.isArray(form.subjectOptions) && form.subjectOptions.length) subject.innerHTML=form.subjectOptions.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
    setText(document.querySelector('.submit-btn-primary span'),form.submit);
    setText(document.querySelector('.submit-btn-wa span'),form.whatsapp);

    const trust=p.trust||[];
    document.querySelectorAll('.trust-strip .trust-box').forEach((box,i)=>{const v=trust[i];if(v){setText(box.querySelector('strong'),v[0]);setText(box.querySelector('span'),v[1]);}});

    const faq=p.faq||{};
    setText(document.querySelector('.faq-title'),faq.title);
    document.querySelectorAll('.faq-item').forEach((item,i)=>{const v=faq.items?.[i];if(v){setText(item.querySelector('.faq-question span'),v[0]);setText(item.querySelector('.faq-answer'),v[1]);}});

    const bottom=p.bottom||{};
    const br=document.querySelector('#bottom-store-address');
    if(br){setText(br.querySelector('.store-address-title'),bottom.title);setText(br.querySelector('.store-address-badge'),bottom.badge);setText(br.querySelector('.store-address-text'),bottom.address);const ms=br.querySelectorAll('.store-address-meta > span:not(.sep)');[bottom.meta1,bottom.meta2,bottom.phone].forEach((v,i)=>{if(ms[i]) setText(ms[i],v)});setText(br.querySelector('.store-address-btn span'),bottom.map);}
    const ft=p.footer||{};
    const f=document.querySelector('.footer');
    if(f){setText(f.querySelector('.footer-inner > span'),ft.text);f.querySelectorAll('.footer-links a').forEach((a,i)=>{if(ft.links?.[i]) setText(a,ft.links[i]);});}
  }

  function applyAI(c) {
    const p=c.ai_settings||{};
    const chat=document.getElementById('chat'),form=document.getElementById('form'),input=document.getElementById('input'),typing=document.getElementById('typing'),status=document.querySelector('.status'),quick=document.querySelector('.quick');
    if(p.enabled===false){
      if(status){status.textContent='آفلاین';status.style.color='#ff8b8b';}
      if(form){form.style.opacity='.55';form.dataset.disabled='1';}
      if(input){input.disabled=true;input.placeholder='دستیار هوشمند موقتاً غیرفعال است.';}
      if(quick) quick.innerHTML='<span style="font-size:10px;color:#888;padding:8px 2px">دستیار فعلاً توسط مدیریت غیرفعال شده است.</span>';
      if(typing) typing.style.display='none'; return;
    }
    if(chat&&p.greeting){const first=chat.querySelector('.msg.bot');if(first)first.textContent=p.greeting;}
    if(quick&&Array.isArray(p.quick_prompts)&&p.quick_prompts.length){
      quick.innerHTML=p.quick_prompts.map(q=>'<button type="button" data-q="'+esc(q)+'">'+esc(q)+'</button>').join('');
      if(typeof window.__AZIM_AI_REWIRE==='function') window.__AZIM_AI_REWIRE();
    }
  }

  ready(async()=>{
    const c=await loadContent();
    const copy=c.site_copy||{};
    if(document.querySelector('#home')){applyHomeLegacy(c);applyHomeCopy(copy,c);}
    if(document.querySelector('#card-channel-phone')){applyContactCopy(copy,c);}
    if(document.querySelector('#chat')&&document.querySelector('#form')) applyAI(c);
  });
})();