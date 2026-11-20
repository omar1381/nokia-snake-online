# Nokia 3310 — Snake II Online

An authentic Nokia 3310 Snake II web game with **progressive speed** (no speed slider) and a live **Top Players** leaderboard.

## Features

- **Authentic Nokia 3310 Hardware & 84×48 LCD**: Pixel-accurate monochrome TN-LCD framebuffer, green LED backlight toggle, 4 Xpress-on covers (Midnight Blue, Arctic Silver, Sahara Yellow, Volcano Red), clickable tactile keypad, and Web Audio API piezo buzzer sound effects.
- **Classic Snake II Gameplay**: 6 mazes (`No maze`, `Box`, `Tunnel`, `Mill`, `Rails`, `Apartment`), open-mouth food approach, bulging belly segments, 1-tick collision grace period, and timed bonus critters every 5 apples.
- **Fair Progressive Speed (No Speed Slider)**: Every player starts at **Speed 1**. Speed increases by +1 every **4 apples**, and each apple awards points equal to your current speed.
- **Live Top Players Dashboard**: Real-time updates via Server-Sent Events (SSE), world record & global KPIs, Top 3 podium, timeframe/maze/search filters, recent games feed, and browser-key-protected player nicknames.
- **Zero External Dependencies**: Pure Node.js HTTP server (`>= 18`) and vanilla HTML/CSS/JS with JSON file persistence.

## Quick Start

```bash
npm start
```

Open `http://localhost:3000` to play, or `http://localhost:3000/leaderboard` for the Top Players dashboard.

### Configuration

- `PORT` — HTTP port (default: `3000`)
- `HOST` — Bind address (default: `0.0.0.0`)
- `DATA_DIR` — Directory for `db.json` persistence (default: `./data`)

## Controls

| Action | Keys |
| --- | --- |
| Steer | Arrow keys, `WASD`, or `2 4 6 8` |
| Select / Pause | `Enter`, `Space`, or `5` |
| Back / Menu | `Esc` or `C` |
| Backlight | `B` or `*` |
| Sound | `M` or `#` |

You can also click the on-screen Nokia 3310 keypad or swipe directly on the LCD on touch devices.

## API Endpoints

- `GET /api/health` — Server health check
- `POST /api/players` — Claim or verify a player nickname (`{ name, playerKey }`)
- `GET /api/players/me?name=<nickname>` — Player best score and global rank
- `POST /api/runs/start` — Start a validated game session (`{ maze }`)
- `POST /api/scores` — Submit a finished run score (validated against progressive speed rules)
- `GET /api/leaderboard?period=all|week|today&maze=all|0..5&search=<q>` — Rankings, global stats, and recent games
- `GET /api/events` — Server-Sent Events stream for live score updates

## Testing

```bash
npm test
```