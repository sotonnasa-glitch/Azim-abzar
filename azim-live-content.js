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

  function latinDigits(v){return String(v??'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));}

  function sanitizeProductCounts(v) {
    if (v == null) return v;
    return String(v)
      .replace(/(?:کاتالوگ\s*)?۹۰۸\s*محصول(?:\s*در\s*کاتالوگ)?/gi, 'کاتالوگ جامع ابزار')
      .replace(/(?:کاتالوگ\s*)?908\s*محصول(?:\s*در\s*کاتالوگ)?/gi, 'کاتالوگ جامع ابزار')
      .replace(/۹۰۸\s*قلم/gi, 'انواع')
      .replace(/908\s*قلم/gi, 'انواع')
      .replace(/۹۰۸/g, '')
      .replace(/908/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
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
      setText(heroRoot.querySelector('p'), sanitizeProductCounts(hero.description));
      if (Array.isArray(hero.trust_badges)) {
        const cleanBadges = hero.trust_badges.map(sanitizeProductCounts).filter(t => t && !/۹۰۸\s*محصول/i.test(String(t)));
        heroRoot.querySelectorAll('.trust-badge').forEach((el, i) => {
          if (cleanBadges[i]) {
            const textNode = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
            if (textNode) textNode.textContent = ' ' + cleanBadges[i];
            el.style.display = '';
          } else {
            el.style.display = 'none';
          }
        });
      }
      const links = heroRoot.querySelectorAll('.actions a.btn');
      [hero.primary_cta,hero.contact_cta].forEach((v,i) => {
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
    if (h.meta?.title) document.title = h.meta.title;
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && h.meta?.description) descMeta.setAttribute('content', h.meta.description);
    const legacyMeta = fallback.home_meta || {};
    const legacyHero = fallback.home_hero || {};
    const header = h.header || {};
    setText(document.querySelector('.brand strong'), header.brand);
    setText(document.querySelector('.brand small'), header.tagline);
    const navMap = [
      ['#nav-btn-home',header.nav_home],['#nav-btn-catalog',header.nav_products],['#nav-btn-contact',header.nav_contact]
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
      setText(heroRoot.querySelector('p'),sanitizeProductCounts(hero.description));
      if(Array.isArray(hero.trust)) {
        const cleanTrust = hero.trust.map(sanitizeProductCounts).filter(t => t && !/۹۰۸\s*محصول/i.test(String(t)));
        heroRoot.querySelectorAll('.trust-badge').forEach((el,i)=>{
          if(cleanTrust[i]) {
            const textNode=Array.from(el.childNodes).find(n=>n.nodeType===3 && n.textContent.trim());
            if(textNode) textNode.textContent=' '+cleanTrust[i];
            el.style.display = '';
          } else {
            el.style.display = 'none';
          }
        });
      }
      const links=heroRoot.querySelectorAll('.actions a.btn');
      [hero.primary_cta,hero.contact_cta].forEach((v,i)=>{
        if(links[i] && v){
          const target=links[i].querySelector('.az-arrow')?.previousSibling?.previousSibling || links[i].querySelector('span:nth-of-type(2)');
          setText(target,v);
        }
      });
    }

    const hud=h.hud||{};
    setText(document.querySelector('.az-hud-label'),hud.label);
    setText(document.querySelector('.az-hud-badge'),hud.badge);
    if (hud.value && !/۹۰۸|908/.test(String(hud.value))) {
      setText(document.querySelector('#az-gauge-num'),hud.value);
    } else {
      setText(document.querySelector('#az-gauge-num'),'کامل');
    }
    if (hud.unit && !/۹۰۸|908/.test(String(hud.unit))) {
      setText(document.querySelector('.az-gauge-unit'),hud.unit);
    } else {
      setText(document.querySelector('.az-gauge-unit'),'کاتالوگ تخصصی ابزار');
    }
    document.querySelectorAll('.az-hud-tag').forEach((el,i)=>{if(hud.specs?.[i]) setText(el,sanitizeProductCounts(hud.specs[i]));});
    document.querySelectorAll('.az-floating-chip').forEach((el,i)=>{
      const pair=hud.chips?.[i];
      if(pair){
        setText(el.querySelector('strong'),sanitizeProductCounts(pair[0]));
        setText(el.querySelector('small'),sanitizeProductCounts(pair[1]));
      }
    });

    const ticker=(h.ticker||[]).filter(v=>!/(دستیار|هوش مصنوعی|\bAI\b)/i.test(String(v))).map(sanitizeProductCounts);
    if(ticker.length){
      document.querySelectorAll('.az-ticker-track .az-ticker-item').forEach((el,i)=>setText(el,ticker[i%ticker.length],true));
    }

    const choice=h.choice||{};
    const cr=document.querySelector('#azim-choice-guide');
    if(cr){
      setText(cr.querySelector('.sectionHead .eyebrow'),choice.eyebrow);
      setText(cr.querySelector('.sectionHead .title'),choice.title);
      setText(cr.querySelector('.sectionHead .lead'),sanitizeProductCounts(choice.lead));
      const cards=cr.querySelectorAll('.az-choice');
      (choice.cards||[]).filter(v=>!/(دستیار|هوش مصنوعی|\bAI\b)/i.test(JSON.stringify(v))).forEach((v,i)=>{
        const card=cards[i]; if(!card||!v) return;
        setText(card.querySelector('.az-choice-num'),v[0]);
        setText(card.querySelector('strong'),sanitizeProductCounts(v[1]));
        setText(card.querySelector('small'),sanitizeProductCounts(v[2]));
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
      const homeFooterLinks=(ft.links||[]).filter(v=>!/(دستیار|هوش مصنوعی|\bAI\b)/i.test(String(v))); homeFooter.querySelectorAll('div a').forEach((a,i)=>{if(homeFooterLinks[i]) setText(a,homeFooterLinks[i]);});
    }

    const metaTitle=legacyMeta.title || document.title;
    if(metaTitle && !h.header?.brand) document.title=metaTitle;
  }

  function applyContactCopy(copy, fallback) {
    const p=copy.contact||{};
    if (p.meta?.title) document.title = p.meta.title;
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && p.meta?.description) descMeta.setAttribute('content', p.meta.description);
    const header=p.header||{};
    setText(document.querySelector('#header-brand strong'),header.brand);
    setText(document.querySelector('#header-brand small'),header.tagline);
    setText(document.querySelector('#btn-back-prev span:last-child'),header.back);

    const hero=p.hero||fallback.contact_page||{};
    const contactH1=document.querySelector('.hero-title');
    if(contactH1 && hero.title){const brand='عظیم ابزار', idx=String(hero.title).lastIndexOf(brand), gold=contactH1.querySelector('span'); if(gold && idx>=0){contactH1.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=''}); if(contactH1.firstChild)contactH1.firstChild.textContent=String(hero.title).slice(0,idx).trimEnd()+' '; else contactH1.insertBefore(document.createTextNode(String(hero.title).slice(0,idx).trimEnd()+' '),gold); gold.textContent=brand;} else contactH1.textContent=String(hero.title);}
    setText(document.querySelector('.hero-desc'),hero.description);
    setText(document.querySelector('.hero-action-phone span'),hero.call_cta);
    setText(document.querySelector('.hero-action-online span'),hero.form_cta);

    const ch=p.channels_head||{};
    setText(document.querySelector('.panel-head-title > span'),ch.title);
    setText(document.querySelector('.panel-head p'),ch.description);

    const phone=p.phone||{};
    const pc=document.querySelector('#card-channel-phone');
    if(pc){setText(pc.querySelector('.channel-title'),phone.title);setText(pc.querySelector('.channel-pill'),phone.pill);setText(pc.querySelector('.channel-value'),phone.value);setText(pc.querySelector('.channel-sub'),phone.sub);setText(pc.querySelector('button[onclick*="copyValue"] span'),phone.copy);setText(pc.querySelector('a.channel-action-btn span'),phone.call);if(phone.value){const digits=latinDigits(phone.value).replace(/[^\d+]/g,'');pc.querySelectorAll('a[href^="tel:"]').forEach(a=>a.setAttribute('href','tel:'+(digits.startsWith('+')?digits:(digits.replace(/^0+/,'')?'+98'+digits.replace(/^0+/,''):digits))));const b=pc.querySelector('button[onclick*="copyValue"]');if(b)b.setAttribute('onclick','copyValue('+JSON.stringify(latinDigits(phone.value).replace(/[^\d+]/g,''))+', '+JSON.stringify('شماره تماس فروشگاه کپی شد')+')');}}
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
    if(ac){
      setText(ac.querySelector('.channel-title'),address.title);
      setText(ac.querySelector('.channel-pill'),address.pill);
      setText(ac.querySelector('.channel-value'),address.value);
      setText(ac.querySelector('.channel-sub'),address.sub);
      setText(ac.querySelector('.channel-actions .location-primary span'),address.neshan_url ? 'مسیریابی با نشان' : address.button);
      setText(ac.querySelector('.channel-actions .location-secondary span'),address.balad_url ? 'مسیریابی با بلد' : 'بلد');
      const n=ac.querySelector('.location-primary'); const bl=ac.querySelector('.location-secondary');
      if(n && address.neshan_url) n.href=address.neshan_url;
      if(bl && address.balad_url) bl.href=address.balad_url;
      if(bl && !address.balad_url) bl.style.display='none';
    }
    
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
    if(br){
      setText(br.querySelector('.store-address-title'),bottom.title);
      setText(br.querySelector('.store-address-badge'),bottom.badge);
      setText(br.querySelector('.store-address-text'),bottom.address);
      const ms=br.querySelectorAll('.store-address-meta > span:not(.sep)');
      [bottom.meta1,bottom.meta2,bottom.phone].forEach((v,i)=>{if(ms[i]) setText(ms[i],v)});
      setText(br.querySelector('.location-primary span'),bottom.map || 'مسیریابی با نشان');
      const n=br.querySelector('.location-primary');
      const bl=br.querySelector('.location-secondary');
      if(n && address.neshan_url) n.href=address.neshan_url;
      if(bl && address.balad_url) bl.href=address.balad_url;
      if(bl && !address.balad_url) bl.style.display='none';
    }
    const ft=p.footer||{};
    const f=document.querySelector('.footer');
    if(f){setText(f.querySelector('.footer-inner > span'),ft.text);const footerLinks=(ft.links||[]).filter(v=>!/(دستیار|هوش مصنوعی|\bAI\b)/i.test(String(v))); f.querySelectorAll('.footer-links a').forEach((a,i)=>{if(footerLinks[i]) setText(a,footerLinks[i]);});}
  }

  function applySharedFooter(copy) {
    const f = copy?.footer || {};
    const footer = document.querySelector('.az-main-footer');
    if (!footer) return;

    const set = (sel, value) => {
      const el = footer.querySelector(sel);
      if (el && value != null && String(value).trim() !== '') el.textContent = String(value);
    };

    set('.az-fbrand-text strong', f.brand);
    set('.az-fbrand-text small', f.tagline);
    set('.az-footer-desc', f.description);
    set('.az-footer-badge-online span:last-child', f.online_badge);

    const cols = footer.querySelectorAll('.az-footer-main .az-footer-col');
    const categoryCol = cols[1];
    const quickCol = cols[2];
    const contactCol = cols[3];

    if (categoryCol) {
      setNodeText(categoryCol.querySelector('.az-footer-heading'), f.categories_heading);
      const links = categoryCol.querySelectorAll('.az-footer-list a');
      const cats = Array.isArray(f.categories) ? f.categories : [];
      cats.forEach((value, i) => { if (links[i]) links[i].textContent = String(value); });
      setNodeText(links[cats.length], f.catalog_cta);
    }

    if (quickCol) {
      setNodeText(quickCol.querySelector('.az-footer-heading'), f.quick_heading);
      const links = quickCol.querySelectorAll('.az-footer-list a');
      const quick = Array.isArray(f.quick_links) ? f.quick_links : [];
      quick.forEach((value, i) => { if (links[i]) links[i].textContent = String(value); });
    }

    if (contactCol) {
      setNodeText(contactCol.querySelector('.az-footer-heading'), f.contact_heading);
      const rows = contactCol.querySelectorAll('.az-footer-contact-items .az-contact-row');
      if (rows[0] && f.address) {
        const span = rows[0].querySelector('span');
        if (span) span.textContent = String(f.address);
      }
      if (rows[1] && f.phone) {
        const span = rows[1].querySelector('span');
        const a = span?.querySelector('a');
        if (a) {
          a.textContent = String(f.phone);
          const digits = String(f.phone).replace(/[^0-9+]/g,'');
          if (digits) a.href = 'tel:' + digits;
          span.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.includes('مشاوره و استعلام تلفنی:')) n.textContent = 'مشاوره و استعلام تلفنی: '; });
        } else if (span) {
          span.textContent = 'مشاوره و استعلام تلفنی: ' + String(f.phone);
        }
      }
      if (rows[2] && f.hours) {
        const span = rows[2].querySelector('span');
        if (span) span.textContent = String(f.hours);
      }
    }

    set('.az-footer-bottom .az-fbottom-inner > span:first-child', f.bottom_text);
    const bottomStrong = footer.querySelector('.az-footer-bottom .az-fbottom-inner > span:first-child strong');
    if (bottomStrong && f.brand) bottomStrong.textContent = f.brand;
    set('.az-footer-bottom .az-fbottom-sub', f.bottom_subtext);
  }

  function setNodeText(el, value) {
    if (el && value != null && String(value).trim() !== '') el.textContent = String(value);
  }

  function applyAI(c) {
    const p=c.ai_settings||{};
    const chat=document.getElementById('chat') || document.getElementById('chatMessages'),form=document.getElementById('form') || document.getElementById('chatForm'),input=document.getElementById('input') || document.getElementById('chatInput'),typing=document.getElementById('typing'),status=document.querySelector('.status') || document.querySelector('.brand-status'),quick=document.querySelector('.quick') || document.querySelector('.quick-prompts-bar'),sendBtn=document.getElementById('sendBtn');
    if(p.enabled===false){
      if(status){
        const statusText = status.querySelector('span:last-child');
        if(statusText) statusText.textContent='دستیار موقتاً آفلاین'; else status.textContent='آفلاین';
        status.style.color='#ff8b8b';
      }
      if(form){form.style.opacity='.55';form.dataset.disabled='1';}
      if(input){input.disabled=true;input.placeholder='دستیار هوشمند موقتاً غیرفعال است.';}
      if(sendBtn) sendBtn.disabled=true;
      if(quick) quick.innerHTML='<span style="font-size:10px;color:#888;padding:8px 2px">دستیار فعلاً توسط مدیریت غیرفعال شده است.</span>';
      if(typing) typing.style.display='none'; return;
    }
    if(chat&&p.greeting){
      const first=chat.querySelector('.msg.bot') || chat.querySelector('.ai-intro-text');
      if(first) first.textContent=p.greeting;
    }
    if(quick&&Array.isArray(p.quick_prompts)&&p.quick_prompts.length){
      quick.innerHTML=p.quick_prompts.map(q=>'<button type="button" class="quick-prompt-chip" data-prompt="'+esc(q)+'">'+esc(q)+'</button>').join('');
      if(typeof window.__AZIM_AI_REWIRE==='function') window.__AZIM_AI_REWIRE();
    }
  }

  ready(async()=>{
    const c=await loadContent();
    const copy=c.site_copy||{};
    if(document.querySelector('#home')){applyHomeLegacy(c);applyHomeCopy(copy,c);}
    applySharedFooter(copy);
    if(document.querySelector('#card-channel-phone')){applyContactCopy(copy,c);}
    if((document.querySelector('#chat')&&document.querySelector('#form')) || (document.querySelector('#chatMessages')&&document.querySelector('#chatForm'))) applyAI(c);
  });
})();