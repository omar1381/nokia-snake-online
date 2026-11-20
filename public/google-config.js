// Google Analytics (GA4) + Google AdSense configuration.
// Leave a value empty ('') to keep that feature switched off — nothing loads and no empty ad boxes appear.
//
// gaMeasurementId : GA4 "Measurement ID" from https://analytics.google.com  (looks like 'G-ABC123XYZ9')
// adsenseClient   : AdSense publisher ID from https://adsense.google.com     (looks like 'ca-pub-1234567890123456')
// adSlots         : Optional ad unit IDs (AdSense → Ads → By ad unit → Display ads → copy data-ad-slot).
//                   If adsenseClient is set but slots are empty, only AdSense Auto ads are used.
window.GOOGLE_CONFIG = {
  gaMeasurementId: '',
  adsenseClient: '',
  adSlots: {
    play: '',   // Banner under the game area (never covers the phone/LCD)
    board: '',  // Banner inside the Top Players page
  },
};
