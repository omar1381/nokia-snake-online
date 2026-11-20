# Nokia 3310 — Snake II Online

Play live: **[https://omar1381.github.io/nokia-snake-online/](https://omar1381.github.io/nokia-snake-online/)**

An authentic Nokia 3310 Snake II web & mobile game with **smooth 60/120 FPS gliding**, **progressive speed** (no speed slider), and a live **Top Players** leaderboard.

## Features

- **Authentic Nokia 3310 Hardware & 84×48 LCD**: Green monochrome TN-LCD display with backlight toggle, 4 Xpress-on covers (Midnight Blue, Arctic Silver, Sahara Yellow, Volcano Red), tactile clickable keypad, and Web Audio API piezo buzzer sound effects. Preferences are remembered automatically.
- **Smooth Zero-Lag Movement**: Continuous 60/120 FPS forward-interpolated gliding with crisp 90° corners, seamless wrap-around edges, open-mouth food swallowing, bulging belly segments, 1-tick collision grace period, and automatic pause when switching tabs or locking your phone.
- **Balanced Progressive Speed & Growth**: Everyone starts at **Speed 1** (`255ms`/cell). Speed increases every **4 apples** (`~5.5%` faster per tier down to `76ms`), each apple awards points equal to your current speed, your snake elongates by **+1 every 2 apples**, and timed bonus critters appear every **5 apples**.
- **6 Classic Mazes**: `No maze`, `Box`, `Tunnel`, `Mill`, `Rails`, and `Apartment` (with full-board clear Victory detection).
- **Live Online Top Players Leaderboard**: Shared global rankings powered by Firebase Realtime Database on GitHub Pages (with optional Node.js + Supabase or JSON file backend), Top 3 podium, timeframe/maze/search filters, recent games feed, pending-score auto-posting, retry on network hiccups, and browser-key-protected nicknames.
- **Mobile & PWA Ready**: Instant `pointerdown` keypad taps, chained LCD thumb swipes, iOS-friendly inputs, installable Home Screen Web App Manifest, and full SEO (`robots.txt`, `sitemap.xml`, Open Graph preview, JSON-LD `VideoGame` schema).
- **Zero External Dependencies**: Pure Node.js (`>= 18`) and vanilla HTML/CSS/JS.

## Controls

| Action | Keys / Touch |
| --- | --- |
| Steer | Arrow keys, `WASD`, `2 4 6 8`, swipe on LCD, or tap keypad |
| Select / Pause | `Enter`, `Space`, `P`, `5`, or tap center Navi button |
| Back / Menu | `Esc`, `C`, or tap `C` button |
| Backlight | `B`, `*`, or tap `*` button |
| Sound | `M`, `#`, or tap `#` button |

## Deployment & Storage Modes

1. **GitHub Pages + Firebase Realtime Database (Live Production)**
   - Pushing to `main` runs `npm test` and auto-deploys `public/` via [.github/workflows/pages.yml](.github/workflows/pages.yml).
   - Set `window.FIREBASE_DB_URL` in [public/firebase-config.js](public/firebase-config.js) and publish [firebase/database.rules.json](firebase/database.rules.json) in the Firebase Realtime Database **Rules** tab.
2. **Self-Hosted Node.js Server (Local JSON or Supabase PostgreSQL)**
   ```bash
   npm start
   ```
   Open `http://localhost:3000` (or `http://localhost:3000/leaderboard`).
   - `PORT` — HTTP port (default: `3000`)
   - `HOST` — Bind address (default: `0.0.0.0`)
   - `DATA_DIR` — Local `db.json` directory when Supabase is not configured (default: `./data`)
   - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` — Optional Supabase PostgreSQL persistence (apply [supabase/schema.sql](supabase/schema.sql) once in Supabase SQL Editor).

## Google Analytics, Search & Ads

Paste your IDs in `public/google-config.js` (GA4 `G-...`, AdSense `ca-pub-...`, ad slot IDs). Empty values keep everything off.
Step-by-step instructions: [docs/GOOGLE_LAUNCH_GUIDE.md](docs/GOOGLE_LAUNCH_GUIDE.md).

## API Endpoints (Node.js Server)

- `GET /api/health` — Server health check & active storage mode
- `POST /api/players` — Claim or verify a player nickname (`{ name, playerKey }`)
- `GET /api/players/me?name=<nickname>` — Player best score and global rank
- `POST /api/runs/start` — Start a validated game session (`{ maze }`)
- `POST /api/scores` — Submit a finished run score (validated against speed & growth rules)
- `GET /api/leaderboard?period=all|week|today&maze=all|0..5&search=<q>` — Rankings, global stats, and recent games
- `GET /api/events` — Server-Sent Events stream for live score updates

## Testing

```bash
npm test
```