(() => {
  'use strict';
  if (window.__AZIM_LIVE_CONTENT_V1) return;
  window.__AZIM_LIVE_CONTENT_V1 = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  async function loadContent() {
    if (!window.AZIM_SUPABASE_URL || !window.AZIM_SUPABASE_ANON_KEY) return {};
    try {
      const url = window.AZIM_SUPABASE_URL +
        '/rest/v1/site_content?select=section_key,payload,is_active&is_active=eq.true&limit=50';
      const r = await fetch(url, {
        headers: {
          apikey: window.AZIM_SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + window.AZIM_SUPABASE_ANON_KEY
        }
      });
      if (!r.ok) return {};
      const rows = await r.json();
      return Object.fromEntries((rows || []).map(x => [x.section_key, x.payload || {}]));
    } catch (_) {
      return {};
    }
  }

  function setText(el, value) {
    if (el && value != null && String(value).trim() !== '') el.textContent = String(value);
  }

  function applyHome(c) {
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
          } else {
            h1.textContent = hero.highlight ? hero.title + ' ' + hero.highlight : hero.title;
          }
        }
        if (span && hero.highlight) span.textContent = hero.highlight;
      }
      setText(heroRoot.querySelector('p'), hero.description);
      if (Array.isArray(hero.trust_badges)) {
        heroRoot.querySelectorAll('.trust-badge').forEach((el, i) => {
          if (hero.trust_badges[i]) {
            const textNode = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
            if (textNode) textNode.textContent = ' ' + hero.trust_badges[i];
          }
        });
      }
    }

    const choice = c.home_choice || {};
    const choiceRoot = document.querySelector('#azim-choice-guide');
    if (choiceRoot) {
      setText(choiceRoot.querySelector('.sectionHead .eyebrow'), choice.eyebrow);
      setText(choiceRoot.querySelector('.sectionHead .title'), choice.title);
      setText(choiceRoot.querySelector('.sectionHead .lead'), choice.lead);
    }

    const why = c.home_why || {};
    const whyRoot = document.querySelector('#azim-why-us');
    if (whyRoot) {
      setText(whyRoot.querySelector('.sectionHead .eyebrow'), why.eyebrow);
      setText(whyRoot.querySelector('.sectionHead .title'), why.title);
      setText(whyRoot.querySelector('.sectionHead .lead'), why.lead);
    }
  }

  function applyContact(c) {
    const p = c.contact_page || {};
    if (p.title) document.title = p.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && p.description) desc.setAttribute('content', p.description);
    const emailEls = document.querySelectorAll('[data-contact-email]');
    emailEls.forEach(el => setText(el, p.email));
  }

  function applyAI(c) {
    const p = c.ai_settings || {};
    const chat = document.getElementById('chat');
    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const typing = document.getElementById('typing');
    const status = document.querySelector('.status');
    const quick = document.querySelector('.quick');

    if (p.enabled === false) {
      if (status) {
        status.textContent = 'آفلاین';
        status.style.color = '#ff8b8b';
      }
      if (form) {
        form.style.opacity = '.55';
        form.dataset.disabled = '1';
      }
      if (input) {
        input.disabled = true;
        input.placeholder = 'دستیار هوشمند موقتاً غیرفعال است.';
      }
      if (quick) quick.innerHTML = '<span style="font-size:10px;color:#888;padding:8px 2px">دستیار فعلاً توسط مدیریت غیرفعال شده است.</span>';
      if (typing) typing.style.display = 'none';
      return;
    }

    if (chat && p.greeting) {
      const first = chat.querySelector('.msg.bot');
      if (first) first.textContent = p.greeting;
    }

    if (quick && Array.isArray(p.quick_prompts) && p.quick_prompts.length) {
      quick.innerHTML = p.quick_prompts.map(q => '<button type="button" data-q="' +
        String(q).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') +
        '">' + String(q).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</button>').join('');
      const formScript = window.__AZIM_AI_REWIRE;
      if (typeof formScript === 'function') formScript();
    }
  }

  ready(async () => {
    const c = await loadContent();
    if (document.querySelector('#home')) applyHome(c);
    if (document.querySelector('#card-channel-phone')) applyContact(c);
    if (document.querySelector('#chat') && document.querySelector('#form')) applyAI(c);
  });
})();