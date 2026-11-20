# Google Publish & Advertising Guide — Nokia 3310 Snake II Online

Everything on the web side is already built and live:
- **Live Game URL:** `https://omar1381.github.io/nokia-snake-online/`
- **Privacy Policy URL (required by Google Play & Ads):** `https://omar1381.github.io/nokia-snake-online/privacy.html`
- **Sitemap URL:** `https://omar1381.github.io/nokia-snake-online/sitemap.xml`
- **App Icons (Play Store / PWA):** `icon-512.png` (512×512), `icon-192.png` (192×192), `og-image.png` (1200×630)
- **Service Worker + Web App Manifest:** Registered automatically (`sw.js`, `manifest.webmanifest`)

---

## Step 1: Appear on Google Search (Free — 2 minutes)

1. Open **https://search.google.com/search-console** and sign in with your Google account.
2. Click **Add property** → **URL prefix** → enter:
   ```
   https://omar1381.github.io/nokia-snake-online/
   ```
3. Under **Verify ownership**, select **HTML tag** and copy the `<meta name="google-site-verification" content="..." />` line.
   - Add that tag inside `<head>` in `public/index.html` and push to `main` (or send it in chat and it will be added automatically).
4. Click **Verify** in Google Search Console.
5. In the left menu, click **Sitemaps** → enter `sitemap.xml` → click **Submit**.
6. In the top search bar (**Inspect any URL**), paste `https://omar1381.github.io/nokia-snake-online/` → click **Request Indexing**.

---

## Step 2: Publish on Google Play Store as an Android App (TWA — ~15 minutes)

Your web app is already **100% PWABuilder / Android TWA ready** (HTTPS, Service Worker, 192px & 512px PNG icons, Privacy Policy).

1. **Generate the Android `.aab` package (free):**
   - Go to **https://www.pwabuilder.com/**
   - Enter `https://omar1381.github.io/nokia-snake-online/` → click **Start**.
   - Click **Package For Stores** → **Android** → **Generate Package**.
   - Download the `.zip` file. Inside you'll find:
     - Your signed `.aab` file (to upload to Google Play)
     - `assetlinks.json` (put this at `public/.well-known/assetlinks.json` and push to `main` so the browser address bar disappears completely inside the Android app!)
2. **Create your Google Play Developer account** at **https://play.google.com/console** (one-time \$25 Google fee).
3. **Create App & Store Listing** — copy and paste these ready-made fields:
   - **App name:** `Snake II — Nokia 3310 Online`
   - **Short description (78 chars):**
     `Classic Nokia 3310 Snake II with smooth 60 FPS gliding & live global rankings!`
   - **Full description:**
     ```
     Relive the iconic Nokia 3310 Snake II — rebuilt for modern phones with buttery-smooth 60 FPS movement and a live global Top Players leaderboard!

     FEATURES:
     • Authentic Nokia 3310 monochrome green LCD with toggleable LED backlight & piezo buzzer sounds
     • 4 classic Xpress-on covers: Midnight Blue, Arctic Silver, Sahara Yellow & Volcano Red
     • 6 original mazes: No Maze, Box, Tunnel, Mill, Rails & Apartment
     • Fair progressive speed — everyone starts at Speed 1 and speeds up every 4 apples
     • Bonus critters every 5 apples for timed extra points
     • Live global Top Players leaderboard with Top 3 podium, filters & nickname protection
     • Play by swiping directly on the LCD screen or tapping the classic Nokia keypad
     • Works offline for practice and syncs scores automatically online
     ```
   - **Category:** `Games → Arcade`
   - **Privacy Policy URL:** `https://omar1381.github.io/nokia-snake-online/privacy.html`
   - **App Icon:** Upload `public/icon-512.png`
   - **Feature Graphic:** Upload `public/og-image.png` (or resize to 1024×500)
   - **Data Safety:** Declare only *App info / Player ID (nickname & game scores)*, not shared with third parties, encrypted in transit (HTTPS).

---

## Step 3: Advertise & Grow Players (Free + Google Ads)

### A. Free Organic Promotion (Start here — \$0)
- **Built-in Share Button:** Players can tap **Share** right after finishing a game (or **Share game with friends** in the footer) to challenge friends via WhatsApp, Instagram, iMessage, or X.
- **Launch post template** (for WhatsApp groups, TikTok/Reels bio, Reddit `r/WebGames`, `r/indiegames`, `r/retrogaming`, X/Twitter):
  > I built a playable Nokia 3310 Snake II with smooth 60 FPS movement, all 6 classic mazes, original piezo sounds, and a live global Top Players leaderboard — works right in your phone browser (no download needed)!
  > Try to beat #1: https://omar1381.github.io/nokia-snake-online/
- **Short-form video idea (TikTok / YouTube Shorts / Instagram Reels):** Record 15 seconds of your phone playing Snake II with the green Nokia 3310 cover + sound on, caption: *"Can you beat #1 on the live Nokia 3310 Snake II leaderboard? Link in bio!"*

### B. Google Ads Campaign (Paid — Optional)
1. Go to **https://ads.google.com** → **New Campaign** → Goal: **Website traffic** (or **App promotion** once live on Google Play).
2. **Landing Page URL:** `https://omar1381.github.io/nokia-snake-online/`
3. **Target Keywords:**
   - `nokia 3310 snake online`
   - `play snake 2 online free`
   - `classic nokia snake game`
   - `retro snake leaderboard`
4. **Ad Headlines (30 chars max):**
   - `Nokia 3310 Snake II Online`
   - `Play Classic Snake — Free`
   - `Live Global Top Players`
   - `No Download · Phone & PC`
5. **Ad Descriptions (90 chars max):**
   - `Play authentic Nokia 3310 Snake II right in your browser. 6 mazes & live global ranks!`
   - `Smooth 60 FPS gliding, original green LCD, and classic sounds. Can you reach #1?`
