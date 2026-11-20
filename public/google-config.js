// Google Analytics (GA4) + Advertising configuration (Adsterra / Google AdSense).
// Leave a value empty ('') to keep that feature switched off — nothing loads and no empty ad boxes appear.
//
// gaMeasurementId : GA4 "Measurement ID" from https://analytics.google.com  (looks like 'G-ABC123XYZ9')
// adsenseClient   : Optional AdSense publisher ID (requires a custom domain, looks like 'ca-pub-...')
// adSlots         : Optional AdSense ad unit slot IDs
// adsterra        : Active Adsterra display banner units (isolated in srcdoc iframes)
window.GOOGLE_CONFIG = {
  gaMeasurementId: 'G-CZQNFNC282',
  adsenseClient: '',
  adSlots: {
    play: '',   // AdSense banner under the game area (never covers the phone/LCD)
    board: '',  // AdSense banner inside the Top Players page
  },
  adsterra: {
    play: {
      key: '56e2816bafdeaff197557127db6d00c1',
      src: 'https://bauval.org/22/56e2816bafdeaff197557127db6d00c1',
      width: 300,
      height: 250,
    },
    board: {
      key: 'c1fc32364c6976c15a7cdb81b335c3f9',
      src: 'https://bauval.org/22/c1fc32364c6976c15a7cdb81b335c3f9',
      width: 728,
      height: 90,
    },
  },
};
