// Lightweight, async-only loader for Google Analytics 4 and ads (AdSense / Adsterra).
// - Does nothing for unconfigured services (no empty ad boxes).
// - Defers ad loading until after window.load + browser idle so the game boots smoothly.
// - Adsterra banners run inside isolated srcdoc iframes so multiple banners never overwrite
//   each other's global atOptions and never interfere with the Nokia 3310 game DOM or focus.
// - Exposes window.trackEvent(name, params) — a safe no-op when GA4 is off or blocked.
(function () {
  'use strict';

  const cfg = window.GOOGLE_CONFIG || {};
  const GA_ID = /^G-[A-Z0-9]{4,}$/i.test(cfg.gaMeasurementId || '') ? cfg.gaMeasurementId : '';
  const AD_CLIENT = /^ca-pub-\d{10,20}$/.test(cfg.adsenseClient || '') ? cfg.adsenseClient : '';
  const slots = cfg.adSlots || {};
  const adsterra = cfg.adsterra || {};

  const HTTPS_SCRIPT_RE = /^https:\/\/[a-z0-9.-]+\/[a-zA-Z0-9/_.-]+$/;

  function loadScript(src, attrs, target) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    Object.keys(attrs || {}).forEach((k) => s.setAttribute(k, attrs[k]));
    (target || document.head).appendChild(s);
    return s;
  }

  // ---------------- Google Analytics 4 ----------------
  // Reuse the standard <head> Google tag (needed for GA4 detection & Search Console
  // verification) so we never double-load gtag.js or double-count page_view.
  if (GA_ID && typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID));
  }

  window.trackEvent = function trackEvent(name, params) {
    if (!GA_ID || typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', name, params || {});
    } catch (_) {
      /* never break the game because of analytics */
    }
  };

  // ---------------- Ads ----------------
  const pushed = new Set();

  function isValidAdsterraUnit(unit) {
    if (!unit || typeof unit !== 'object') return false;
    const keyOk = /^[a-f0-9]{16,64}$/i.test(String(unit.key || ''));
    const srcOk = HTTPS_SCRIPT_RE.test(String(unit.src || ''));
    const w = Number(unit.width);
    const h = Number(unit.height);
    return keyOk && srcOk && Number.isInteger(w) && Number.isInteger(h) && w >= 50 && w <= 1200 && h >= 50 && h <= 600;
  }

  function unitFitsViewport(unit) {
    // Allow 300px banners on all phones; hide wide 728px banners on narrow screens so they never overflow.
    if (unit.width <= 320) return true;
    return window.innerWidth >= unit.width + 56;
  }

  function buildAdsterraSrcdoc(unit) {
    const opts = JSON.stringify({
      key: unit.key,
      format: 'iframe',
      height: unit.height,
      width: unit.width,
      params: {},
    });
    return (
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style>' +
      '</head><body>' +
      '<script>atOptions=' + opts + ';<\/script>' +
      '<script src="' + unit.src + '"><\/script>' +
      '</body></html>'
    );
  }

  function mountAdsterra(wrap, unit) {
    if (!wrap) return;
    if (!unitFitsViewport(unit)) {
      wrap.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');

    if (pushed.has(wrap.id)) return;
    // Wait until the view containing this slot is actually visible and wide enough
    if (wrap.offsetParent === null) return;
    if (unit.width > 320 && wrap.clientWidth < unit.width) return;

    pushed.add(wrap.id);

    const ins = wrap.querySelector('ins.adsbygoogle');
    if (ins) ins.remove();

    const frame = document.createElement('iframe');
    frame.className = 'ad-frame';
    frame.title = 'Advertisement';
    frame.width = String(unit.width);
    frame.height = String(unit.height);
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('scrolling', 'no');
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.style.width = unit.width + 'px';
    frame.style.height = unit.height + 'px';
    frame.srcdoc = buildAdsterraSrcdoc(unit);
    wrap.appendChild(frame);
  }

  function fillAdSenseSlot(container) {
    if (!container || pushed.has(container.id)) return;
    if (container.offsetParent === null || container.clientWidth === 0) return;
    pushed.add(container.id);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {
      /* ad blocked or not approved yet — ignore */
    }
  }

  function setupAds() {
    if (AD_CLIENT) {
      loadScript(
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(AD_CLIENT),
        { crossorigin: 'anonymous' }
      );

      const map = { adSlotPlay: slots.play, adSlotBoard: slots.board };
      const active = [];
      Object.keys(map).forEach((id) => {
        const wrap = document.getElementById(id);
        const slotId = String(map[id] || '').trim();
        if (!wrap || !/^\d{6,}$/.test(slotId)) return;
        const ins = wrap.querySelector('ins.adsbygoogle');
        if (!ins) return;
        ins.setAttribute('data-ad-client', AD_CLIENT);
        ins.setAttribute('data-ad-slot', slotId);
        wrap.classList.remove('hidden');
        active.push(wrap);
      });

      const tryFill = () => active.forEach(fillAdSenseSlot);
      tryFill();
      window.addEventListener('snake:viewchange', tryFill);
      return;
    }

    // Adsterra display banners (isolated srcdoc iframes)
    const entries = [
      { id: 'adSlotPlay', unit: adsterra.play },
      { id: 'adSlotBoard', unit: adsterra.board },
    ].filter((e) => isValidAdsterraUnit(e.unit));

    if (entries.length) {
      entries.forEach(({ id, unit }) => {
        const wrap = document.getElementById(id);
        if (wrap && unit.width > 400) wrap.classList.add('ad-wide');
      });

      const tryMount = () => {
        entries.forEach(({ id, unit }) => {
          mountAdsterra(document.getElementById(id), unit);
        });
      };

      tryMount();
      window.addEventListener('snake:viewchange', tryMount);
      window.addEventListener('resize', tryMount);
    }

    // Optional page-level Adsterra scripts (Popunder / Social Bar), loaded async after idle
    const pageScripts = [adsterra.popunder, adsterra.socialBar].filter(
      (u) => typeof u === 'string' && HTTPS_SCRIPT_RE.test(u.trim())
    );
    pageScripts.forEach((src) => {
      loadScript(src.trim(), { 'data-cfasync': 'false' }, document.body || document.head);
    });
  }

  function scheduleAds() {
    // Let the Nokia 3310 LCD and initial UI finish painting cleanly before loading third-party ad scripts
    const run = () => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(setupAds, { timeout: 1500 });
      } else {
        setTimeout(setupAds, 900);
      }
    };
    if (document.readyState === 'complete') {
      run();
    } else {
      window.addEventListener('load', run, { once: true });
    }
  }

  scheduleAds();
})();
