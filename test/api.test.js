'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');

let server;
let baseUrl;
let tmpDir;

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nokia-snake-test-'));
  server = createServer({ dataDir: tmpDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function jsonReq(pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json();
  return { status: res.status, body };
}

test('serves HTML without any speed slider', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Nokia 3310/);
  assert.match(html, /Progressive speed/);
  assert.match(html, /Top Players/);
  assert.doesNotMatch(html, /type="range"/);

  const boardRes = await fetch(`${baseUrl}/leaderboard`);
  assert.equal(boardRes.status, 200);
});

test('registers player nickname and protects against hijacking', async () => {
  const p1 = await jsonReq('/api/players', {
    method: 'POST',
    body: JSON.stringify({ name: 'Kaito', playerKey: 'kaito-secret-key-1234' }),
  });
  assert.equal(p1.status, 200);
  assert.equal(p1.body.name, 'Kaito');

  // Same key succeeds
  const p1Again = await jsonReq('/api/players', {
    method: 'POST',
    body: JSON.stringify({ name: 'Kaito', playerKey: 'kaito-secret-key-1234' }),
  });
  assert.equal(p1Again.status, 200);

  // Different key gets 409
  const hijack = await jsonReq('/api/players', {
    method: 'POST',
    body: JSON.stringify({ name: 'kaito', playerKey: 'other-secret-key-9999' }),
  });
  assert.equal(hijack.status, 409);
  assert.equal(hijack.body.code, 'NAME_TAKEN');
});

test('validates runs, progressive speed, and updates Top Players leaderboard', async () => {
  // Start run for Kaito (maze 0)
  const run1 = await jsonReq('/api/runs/start', {
    method: 'POST',
    body: JSON.stringify({ maze: 0 }),
  });
  assert.equal(run1.status, 201);
  assert.equal(run1.body.startSpeed, 1);

  // 8 apples -> speed 1 (4 apples = 4) + speed 2 (4 apples = 8) = 12, topSpeed = 1 + floor(8/4) = 3, length = 5 + floor(8/2) = 9
  const sub1 = await jsonReq('/api/scores', {
    method: 'POST',
    body: JSON.stringify({
      runId: run1.body.runId,
      name: 'Kaito',
      playerKey: 'kaito-secret-key-1234',
      score: 12,
      foods: 8,
      length: 9,
      topSpeed: 3,
      maze: 0,
      durationMs: 14500,
    }),
  });
  assert.equal(sub1.status, 201);
  assert.equal(sub1.body.isWorldRecord, true);
  assert.equal(sub1.body.globalRank, 1);

  // Reusing same runId must fail
  const replay = await jsonReq('/api/scores', {
    method: 'POST',
    body: JSON.stringify({
      runId: run1.body.runId,
      name: 'Kaito',
      playerKey: 'kaito-secret-key-1234',
      score: 12,
      foods: 8,
      length: 9,
      topSpeed: 3,
      maze: 0,
      durationMs: 14500,
    }),
  });
  assert.equal(replay.status, 400);
  assert.equal(replay.body.code, 'INVALID_RUN');

  // Fabricated speed or score must fail
  const runBad = await jsonReq('/api/runs/start', {
    method: 'POST',
    body: JSON.stringify({ maze: 1 }),
  });
  const badSpeed = await jsonReq('/api/scores', {
    method: 'POST',
    body: JSON.stringify({
      runId: runBad.body.runId,
      name: 'Cheater',
      playerKey: 'cheater-key-12345678',
      score: 50,
      foods: 4,
      length: 7,
      topSpeed: 9,
      maze: 1,
      durationMs: 5000,
    }),
  });
  assert.equal(badSpeed.status, 400);
  assert.equal(badSpeed.body.code, 'INVALID_SPEED');

  // Second player submits higher score in Box maze (maze 1)
  const run2 = await jsonReq('/api/runs/start', {
    method: 'POST',
    body: JSON.stringify({ maze: 1 }),
  });
  // 16 apples -> speeds 1,2,3,4 (4 each) = 4+8+12+16 = 40, plus 1 bonus critter -> e.g. 68, topSpeed = 5, length = 5 + floor(16/2) = 13
  const sub2 = await jsonReq('/api/scores', {
    method: 'POST',
    body: JSON.stringify({
      runId: run2.body.runId,
      name: 'NokiaQueen',
      playerKey: 'queen-secret-key-1234',
      score: 68,
      foods: 16,
      length: 13,
      topSpeed: 5,
      maze: 1,
      durationMs: 32000,
    }),
  });
  assert.equal(sub2.status, 201);
  assert.equal(sub2.body.isWorldRecord, true);
  assert.equal(sub2.body.globalRank, 1);

  // Check leaderboard ordering & filters
  const lb = await jsonReq('/api/leaderboard');
  assert.equal(lb.status, 200);
  assert.equal(lb.body.stats.worldRecord.name, 'NokiaQueen');
  assert.equal(lb.body.stats.worldRecord.score, 68);
  assert.equal(lb.body.stats.totalPlayers, 2);
  assert.equal(lb.body.stats.totalGames, 2);
  assert.equal(lb.body.rankings[0].name, 'NokiaQueen');
  assert.equal(lb.body.rankings[1].name, 'Kaito');

  // Filter by maze 0
  const maze0 = await jsonReq('/api/leaderboard?maze=0');
  assert.equal(maze0.body.rankings.length, 1);
  assert.equal(maze0.body.rankings[0].name, 'Kaito');

  // Search preserves rank
  const search = await jsonReq('/api/leaderboard?search=kaito');
  assert.equal(search.body.rankings.length, 1);
  assert.equal(search.body.rankings[0].rank, 2);

  // Health reports file storage mode
  const health = await jsonReq('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.storage, 'file');
});

test('supports Supabase REST backend and persists scores across restarts', async () => {
  const playersTable = new Map();
  const scoresTable = [];

  // Lightweight in-memory PostgREST mock for Supabase /rest/v1/players and /rest/v1/scores
  const mockSupabaseFetch = async (urlStr, opts = {}) => {
    const u = new URL(urlStr);
    const method = (opts.method || 'GET').toUpperCase();
    const headers = opts.headers || {};

    assert.equal(headers.apikey, 'test-service-role-key');
    assert.equal(headers.Authorization, 'Bearer test-service-role-key');

    const jsonRes = (status, data) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (data === undefined ? '' : JSON.stringify(data)),
    });

    if (u.pathname === '/rest/v1/players') {
      if (method === 'GET') {
        const eq = u.searchParams.get('name_lower') || '';
        const lower = eq.replace(/^eq\./, '');
        const row = playersTable.get(lower);
        return jsonRes(200, row ? [row] : []);
      }
      if (method === 'POST') {
        const row = JSON.parse(opts.body);
        if (playersTable.has(row.name_lower)) {
          return jsonRes(409, { code: '23505', message: 'duplicate key' });
        }
        playersTable.set(row.name_lower, row);
        return jsonRes(201, undefined);
      }
      if (method === 'PATCH') {
        const eq = u.searchParams.get('name_lower') || '';
        const lower = eq.replace(/^eq\./, '');
        const existing = playersTable.get(lower);
        if (existing) {
          Object.assign(existing, JSON.parse(opts.body));
        }
        return jsonRes(204, undefined);
      }
    }

    if (u.pathname === '/rest/v1/scores') {
      if (method === 'GET') {
        const range = headers.Range || '0-999';
        const [start, end] = range.split('-').map(Number);
        const sorted = [...scoresTable].sort((a, b) => a.created_at - b.created_at);
        return jsonRes(200, sorted.slice(start, end + 1));
      }
      if (method === 'POST') {
        scoresTable.push(JSON.parse(opts.body));
        return jsonRes(201, undefined);
      }
    }

    return jsonRes(404, { message: 'not found' });
  };

  async function withSupaServer(fn) {
    const srv = createServer({
      supabaseUrl: 'https://demo.supabase.co',
      supabaseKey: 'test-service-role-key',
      fetchImpl: mockSupabaseFetch,
    });
    await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${srv.address().port}`;
    const req = async (p, o = {}) => {
      const r = await fetch(`${url}${p}`, {
        headers: { 'Content-Type': 'application/json', ...(o.headers || {}) },
        ...o,
      });
      return { status: r.status, body: await r.json() };
    };
    try {
      await fn(req);
    } finally {
      await new Promise((resolve) => srv.close(resolve));
    }
  }

  // First server instance: register player & submit score
  await withSupaServer(async (req) => {
    const health = await req('/api/health');
    assert.equal(health.body.storage, 'supabase');

    const reg = await req('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name: 'Omar', playerKey: 'omar-secret-key-12345' }),
    });
    assert.equal(reg.status, 200);
    assert.equal(reg.body.name, 'Omar');

    // Hijack attempt blocked
    const hijack = await req('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name: 'omar', playerKey: 'wrong-secret-key-9999' }),
    });
    assert.equal(hijack.status, 409);

    const run = await req('/api/runs/start', {
      method: 'POST',
      body: JSON.stringify({ maze: 2 }),
    });
    assert.equal(run.status, 201);

    const sub = await req('/api/scores', {
      method: 'POST',
      body: JSON.stringify({
        runId: run.body.runId,
        name: 'Omar',
        playerKey: 'omar-secret-key-12345',
        score: 12,
        foods: 8,
        length: 9,
        topSpeed: 3,
        maze: 2,
        durationMs: 18000,
      }),
    });
    assert.equal(sub.status, 201);
    assert.equal(sub.body.isWorldRecord, true);
    assert.equal(sub.body.globalRank, 1);
  });

  // Second fresh server instance (simulates Render restart): scores persist!
  await withSupaServer(async (req) => {
    const lb = await req('/api/leaderboard');
    assert.equal(lb.status, 200);
    assert.equal(lb.body.stats.totalPlayers, 1);
    assert.equal(lb.body.stats.worldRecord.name, 'Omar');
    assert.equal(lb.body.stats.worldRecord.score, 12);

    const me = await req('/api/players/me?name=Omar');
    assert.equal(me.status, 200);
    assert.equal(me.body.bestScore, 12);
    assert.equal(me.body.globalRank, 1);
  });
});

test('serves PWA assets, handles HEAD requests, blocks path traversal, and enforces growth rate', async () => {
  const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifestRes.status, 200);
  assert.match(manifestRes.headers.get('content-type') || '', /manifest\+json/);
  assert.equal(manifestRes.headers.get('x-content-type-options'), 'nosniff');
  const manifestJson = await manifestRes.json();
  assert.ok(manifestJson.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png'));
  assert.ok(manifestJson.icons.some((i) => i.sizes === '512x512' && i.type === 'image/png'));

  const swRes = await fetch(`${baseUrl}/sw.js`);
  assert.equal(swRes.status, 200);
  assert.match(await swRes.text(), /CACHE_NAME/);

  const privacyRes = await fetch(`${baseUrl}/privacy.html`);
  assert.equal(privacyRes.status, 200);
  assert.match(await privacyRes.text(), /Privacy Policy/);

  const icon192 = await fetch(`${baseUrl}/icon-192.png`);
  assert.equal(icon192.status, 200);
  const icon512 = await fetch(`${baseUrl}/icon-512.png`);
  assert.equal(icon512.status, 200);

  const iconRes = await fetch(`${baseUrl}/favicon.svg`);
  assert.equal(iconRes.status, 200);
  assert.match(iconRes.headers.get('content-type') || '', /image\/svg\+xml/);

  const robotsRes = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robotsRes.status, 200);
  assert.match(await robotsRes.text(), /Sitemap:/);

  const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapRes.status, 200);
  assert.match(sitemapRes.headers.get('content-type') || '', /xml/);

  const ogRes = await fetch(`${baseUrl}/og-image.png`);
  assert.equal(ogRes.status, 200);
  assert.match(ogRes.headers.get('content-type') || '', /image\/png/);

  const headRes = await fetch(`${baseUrl}/`, { method: 'HEAD' });
  assert.equal(headRes.status, 200);
  assert.equal(await headRes.text(), '');

  const traversalRes = await fetch(`${baseUrl}/%2e%2e/package.json`);
  assert.ok(traversalRes.status === 403 || traversalRes.status === 404);

  const badEncodingRes = await fetch(`${baseUrl}/%E0%A4%A`);
  assert.equal(badEncodingRes.status, 400);

  // Reject length that does not match 5 + floor(foods / 2)
  const run = await jsonReq('/api/runs/start', {
    method: 'POST',
    body: JSON.stringify({ maze: 0 }),
  });
  const wrongLen = await jsonReq('/api/scores', {
    method: 'POST',
    body: JSON.stringify({
      runId: run.body.runId,
      name: 'Kaito',
      playerKey: 'kaito-secret-key-1234',
      score: 12,
      foods: 8,
      length: 13, // old +1/apple length must be rejected now
      topSpeed: 3,
      maze: 0,
      durationMs: 12000,
    }),
  });
  assert.equal(wrongLen.status, 400);
  assert.equal(wrongLen.body.code, 'INVALID_LENGTH');
});

test('ships Google Analytics and Adsterra/AdSense banner integration cleanly', async () => {
  const html = await (await fetch(`${baseUrl}/`)).text();
  assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-CZQNFNC282/);
  assert.match(html, /google-config\.js/);
  assert.match(html, /google-tools\.js/);
  assert.match(html, /<h1[^>]*>[^<]*Nokia 3310[^<]*<\/h1>/);
  assert.match(html, /id="adSlotPlay" class="ad-slot hidden"/);
  assert.match(html, /id="adSlotBoard" class="ad-slot hidden"/);

  const cfgRes = await fetch(`${baseUrl}/google-config.js`);
  assert.equal(cfgRes.status, 200);
  const cfg = await cfgRes.text();
  assert.match(cfg, /gaMeasurementId:\s*'G-CZQNFNC282'/);
  assert.match(cfg, /adsenseClient/);
  assert.match(cfg, /56e2816bafdeaff197557127db6d00c1/);
  assert.match(cfg, /c1fc32364c6976c15a7cdb81b335c3f9/);

  const toolsRes = await fetch(`${baseUrl}/google-tools.js`);
  assert.equal(toolsRes.status, 200);
  const tools = await toolsRes.text();
  assert.match(tools, /googletagmanager\.com\/gtag\/js/);
  assert.match(tools, /pagead2\.googlesyndication\.com/);
  assert.match(tools, /frame\.srcdoc/);

  const adsRes = await fetch(`${baseUrl}/ads.txt`);
  assert.equal(adsRes.status, 200);

  const privacy = await (await fetch(`${baseUrl}/privacy.html`)).text();
  assert.match(privacy, /Google Analytics/);
  assert.match(privacy, /Adsterra/);
  assert.match(privacy, /Google AdSense/);
  assert.match(privacy, /adssettings\.google\.com/);

  const sw = await (await fetch(`${baseUrl}/sw.js`)).text();
  assert.match(sw, /google-tools\.js/);
});
