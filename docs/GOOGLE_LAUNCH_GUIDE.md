# Google Guide — Search & Analytics (Web)

Live game: `https://omar1381.github.io/nokia-snake-online/`
Privacy Policy: `https://omar1381.github.io/nokia-snake-online/privacy.html`
Sitemap: `https://omar1381.github.io/nokia-snake-online/sitemap.xml`

---

## Step 1 — Google Analytics 4 (Active: `G-CZQNFNC282`)

The Google tag is installed directly in `<head>` of `public/index.html`, and gameplay events are sent via `public/google-tools.js` (`public/google-config.js`):

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

## Step 2 — Google Search Console

1. Open **https://search.google.com/search-console** → **Add property** → **URL prefix** → `https://omar1381.github.io/nokia-snake-online/`.
2. Verify ownership with the **Google Analytics** option (using the same Google account).
3. In the top bar (**Inspect any URL**), paste `https://omar1381.github.io/nokia-snake-online/` → **Test live URL** → **Request indexing**.
4. Optionally submit `sitemap.xml` under **Sitemaps** (note: `github.io` sites sometimes show a temporary "Couldn't fetch" delay — **Request indexing** in URL Inspection handles discovery directly).
