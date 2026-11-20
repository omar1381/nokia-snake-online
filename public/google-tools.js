// Lightweight, async-only loader for Google Analytics 4 and Google AdSense.
// - Does nothing until IDs are set in google-config.js.
// - Scripts load after the page is ready, so gameplay is never blocked.
// - Exposes window.trackEvent(name, params) — a safe no-op when GA4 is off or blocked.
(function () {
  'use strict';

  const cfg = window.GOOGLE_CONFIG || {};
  const GA_ID = /^G-[A-Z0-9]{4,}$/i.test(cfg.gaMeasurementId || '') ? cfg.gaMeasurementId : '';
  const AD_CLIENT = /^ca-pub-\d{10,20}$/.test(cfg.adsenseClient || '') ? cfg.adsenseClient : '';
  const slots = cfg.adSlots || {};

  function loadScript(src, attrs) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    Object.keys(attrs || {}).forEach((k) => s.setAttribute(k, attrs[k]));
    document.head.appendChild(s);
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

  // ---------------- Google AdSense ----------------
  const pushed = new Set();

  function fillSlot(container) {
    if (!container || pushed.has(container.id)) return;
    // Only request an ad once the container is actually visible (has width)
    if (container.offsetParent === null || container.clientWidth === 0) return;
    pushed.add(container.id);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {
      /* ad blocked or not approved yet — ignore */
    }
  }

  function setupAds() {
    if (!AD_CLIENT) return;

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

    const tryFill = () => active.forEach(fillSlot);
    tryFill();
    // The board banner lives in a hidden view at first — fill it when the view opens.
    window.addEventListener('snake:viewchange', tryFill);
  }

  if (document.readyState === 'complete') {
    setupAds();
  } else {
    window.addEventListener('load', setupAds, { once: true });
  }
})();
