'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { createStore, StoreError } = require('./lib/store');

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new StoreError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new StoreError(400, 'INVALID_JSON', 'Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function createServer({ dataDir, supabaseUrl, supabaseKey, fetchImpl } = {}) {
  const store = createStore({ dataDir, supabaseUrl, supabaseKey, fetchImpl });
  const sseClients = new Set();

  function broadcast(eventName, data) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(payload);
      } catch {
        sseClients.delete(res);
      }
    }
  }

  // Heartbeat keeps SSE connections alive through proxies
  const heartbeat = setInterval(() => {
    for (const res of sseClients) {
      try {
        res.write(': ping\n\n');
      } catch {
        sseClients.delete(res);
      }
    }
  }, 25000);
  heartbeat.unref();

  function serveStatic(reqPath, res, headOnly = false) {
    const normalized = reqPath === '/' || reqPath === '/leaderboard' ? '/index.html' : reqPath;
    let decoded;
    try {
      decoded = decodeURIComponent(normalized);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }
    const safeRel = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.resolve(PUBLIC_DIR, safeRel.replace(/^[/\\]+/, ''));

    if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(headOnly ? undefined : 'Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      });
      if (headOnly) {
        res.end();
        return;
      }
      fs.createReadStream(filePath).pipe(res);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      let url;
      try {
        url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      } catch {
        return sendJson(res, 400, { code: 'INVALID_URL', message: 'Malformed request URL.' });
      }
      const pathname = url.pathname;

      // Health check
      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, storage: store.storageMode, time: Date.now() });
      }

      // Live SSE stream
      if (req.method === 'GET' && pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        });
        res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }

      // Register / verify player nickname
      if (req.method === 'POST' && pathname === '/api/players') {
        const body = await readJsonBody(req);
        const summary = await store.registerPlayer(body.name, body.playerKey);
        return sendJson(res, 200, summary);
      }

      // Player summary lookup
      if (req.method === 'GET' && pathname === '/api/players/me') {
        const name = url.searchParams.get('name') || '';
        if (!name.trim()) {
          return sendJson(res, 200, { name: null, bestScore: null, globalRank: null, gamesPlayed: 0 });
        }
        return sendJson(res, 200, await store.getPlayerSummary(name.trim()));
      }

      // Start a validated game run
      if (req.method === 'POST' && pathname === '/api/runs/start') {
        const body = await readJsonBody(req);
        const run = await store.startRun(body.maze ?? 0);
        return sendJson(res, 201, run);
      }

      // Submit a finished game score
      if (req.method === 'POST' && pathname === '/api/scores') {
        const body = await readJsonBody(req);
        const result = await store.submitScore(body);
        broadcast('score', {
          entry: result.entry,
          isWorldRecord: result.isWorldRecord,
        });
        return sendJson(res, 201, result);
      }

      // Leaderboard + stats + recent games
      if (req.method === 'GET' && pathname === '/api/leaderboard') {
        const period = url.searchParams.get('period') || 'all';
        const maze = url.searchParams.get('maze') || 'all';
        const search = url.searchParams.get('search') || '';
        const limit = url.searchParams.get('limit') || '100';
        const data = await store.getLeaderboard({ period, maze, search, limit });
        return sendJson(res, 200, data);
      }

      if (pathname.startsWith('/api/')) {
        return sendJson(res, 404, { code: 'NOT_FOUND', message: 'API route not found.' });
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        return serveStatic(pathname, res, req.method === 'HEAD');
      }

      res.writeHead(405);
      res.end('Method Not Allowed');
    } catch (err) {
      if (err instanceof StoreError) {
        return sendJson(res, err.status, { code: err.code, message: err.message });
      }
      console.error('[server error]', err);
      return sendJson(res, 500, { code: 'INTERNAL_ERROR', message: 'Internal server error.' });
    }
  });

  server.on('close', () => {
    clearInterval(heartbeat);
    for (const res of sseClients) {
      try {
        res.end();
      } catch {}
    }
    sseClients.clear();
  });

  return server;
}

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const server = createServer({
    dataDir: process.env.DATA_DIR,
    supabaseUrl,
    supabaseKey,
  });
  server.listen(PORT, HOST, () => {
    const mode = supabaseUrl && supabaseKey ? 'supabase' : 'file';
    console.log(`Nokia 3310 Snake II Online running at http://localhost:${PORT} (storage: ${mode})`);
  });
}

module.exports = { createServer };
