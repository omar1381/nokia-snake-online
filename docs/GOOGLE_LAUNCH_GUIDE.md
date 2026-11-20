# Google Guide — Search, Analytics & Ads (Web)

Live game: `https://omar1381.github.io/nokia-snake-online/`
Privacy Policy: `https://omar1381.github.io/nokia-snake-online/privacy.html`
Sitemap: `https://omar1381.github.io/nokia-snake-online/sitemap.xml`

All Google settings live in **one file**: [`public/google-config.js`](../public/google-config.js).
Empty values = feature switched off (no scripts load, no empty ad boxes).

---

## Step 1 — Google Analytics 4 (free, works on github.io)

1. Go to **https://analytics.google.com** → **Admin** (gear icon, bottom left).
2. If you already have a property: **Data streams** → open your **Web** stream.
   If not: **Create → Property** → name `Snake II` → **Web** stream → URL `omar1381.github.io/nokia-snake-online`.
3. Copy the **Measurement ID** (looks like `G-ABC123XYZ9`).
4. Paste it in `public/google-config.js` → `gaMeasurementId: 'G-ABC123XYZ9'` → push to `main`.

Events sent automatically (Reports → Engagement → Events):

| Event | When | Extra info |
|---|---|---|
| `page_view` | Someone opens the site | automatic |
| `level_start` | A game starts | `level_name` (maze) |
| `level_end` | A game ends | `score`, `foods`, `top_speed`, `duration_sec`, `success` |
| `post_score` | Score saved to leaderboard | `score`, `rank`, `personal_best`, `world_record` |
| `sign_up` | Nickname saved | — |
| `share` | Share button pressed | `method`, `content_type` |
| `view_change` | Play ⇄ Top Players | `view` |

---

## Step 2 — Show the site on Google Search (Search Console)

1. Open **https://search.google.com/search-console** → **Add property** → **URL prefix** →
   `https://omar1381.github.io/nokia-snake-online/`
2. Verify ownership — easiest options:
   - **Google Analytics** (after Step 1 is live, with the same Google account) → click **Verify**. Done.
   - or **HTML tag** → copy the `<meta name="google-site-verification" ...>` line → paste it in
     `public/index.html` under the "Google Search Console" comment → push → **Verify**.
3. Left menu → **Sitemaps** → type `sitemap.xml` → **Submit**.
4. Top bar **URL inspection** → paste the game URL → **Request indexing**.

Indexing usually takes a few days to ~2 weeks. Searching `site:omar1381.github.io` shows what Google has indexed.
To rank for "Nokia snake online", share the link (Reddit r/WebGames, Facebook groups, X, WhatsApp) — backlinks and real visits matter most.

---

## Step 3 — Earn money with ads

### ⚠️ Important: AdSense and `github.io`
Google AdSense **does not approve `*.github.io` addresses** — it needs a site you own at the root (e.g. `nokiasnake.com`),
and `ads.txt` must be at the domain root. So for AdSense you need a **custom domain** (about \$2–\$12 / year).

### Option A — Google AdSense with a custom domain (recommended)
1. **Buy a domain** (Cloudflare Registrar, Porkbun or Namecheap), e.g. `nokiasnake2.com`.
2. **Point it to GitHub Pages:**
   - At the domain DNS, add 4 `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     and a `CNAME` record `www` → `omar1381.github.io`.
   - GitHub repo → **Settings → Pages → Custom domain** → enter the domain → **Save** → tick **Enforce HTTPS**.
   - Tell the assistant the domain, so canonical URL, sitemap, robots.txt and share links get updated.
3. **Apply to AdSense:** https://adsense.google.com → **Get started** → add your domain.
   AdSense shows a publisher ID `ca-pub-XXXXXXXXXXXXXXXX`.
4. Paste it in `public/google-config.js` → `adsenseClient: 'ca-pub-...'`, and put the real line in
   `public/ads.txt` (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`). Push → in AdSense click **Request review**.
5. After approval: AdSense → **Ads → By ad unit → Display ads** → create 2 units (e.g. `Play banner`, `Board banner`)
   → copy each `data-ad-slot` number into `adSlots.play` and `adSlots.board`. Push.
6. AdSense → **Privacy & messaging** → create the **GDPR consent message** (required for EU/UK visitors).
7. If you turn on **Auto ads**, disable **Vignette** and **Anchor** ads (or exclude the game area) so ads never cover the phone while playing.

Ad placements in the game are already built: one banner under the side cards on the Play page and one under the rankings on the Top Players page.
They are labelled "Advertisement", never overlap the Nokia phone/LCD, and load after the page is ready so gameplay stays smooth.

### Option B — Earn without buying a domain
- **Game portals** (they show ads and share revenue, plus bring players): CrazyGames (developer.crazygames.com), GameDistribution, Poki (by invitation), itch.io (donations / pay-what-you-want).
- **Ad networks that accept github.io** (e.g. Adsterra, Monetag): approve fast, but lower-quality ads. Use only **banner** formats — never pop-unders or redirects, they ruin the game and hurt Google ranking.

---

## Checklist
- [ ] GA4 Measurement ID in `google-config.js`
- [ ] Search Console verified + `sitemap.xml` submitted + indexing requested
- [ ] Custom domain connected to GitHub Pages (for AdSense)
- [ ] AdSense publisher ID in `google-config.js` + `ads.txt` updated + review requested
- [ ] Ad unit slot IDs added after approval + GDPR consent message enabled
