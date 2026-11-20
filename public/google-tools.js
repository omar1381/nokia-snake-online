// Lightweight Google Analytics 4 helper.
// Reuses the standard <head> Google tag (G-CZQNFNC282) and exposes window.trackEvent(name, params).
(function () {
  'use strict';

  const cfg = window.GOOGLE_CONFIG || {};
  const GA_ID = /^G-[A-Z0-9]{4,}$/i.test(cfg.gaMeasurementId || '') ? cfg.gaMeasurementId : '';

  if (GA_ID && typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }

  window.trackEvent = function trackEvent(name, params) {
    if (!GA_ID || typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', name, params || {});
    } catch (_) {
      /* never break gameplay because of analytics */
    }
  };
})();
