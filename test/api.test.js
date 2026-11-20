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

  // 8 apples -> speed 1 (4 apples = 4) + speed 2 (4 apples = 8) = 12, topSpeed = 1 + floor(8/4) = 3, length = 13
  const sub1 = await jsonReq('/api/scores', {
    method: 'POST',
    body: JSON.stringify({
      runId: run1.body.runId,
      name: 'Kaito',
      playerKey: 'kaito-secret-key-1234',
      score: 12,
      foods: 8,
      length: 13,
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
      length: 13,
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
      length: 9,
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
  // 16 apples -> speeds 1,2,3,4 (4 each) = 4+8+12+16 = 40, plus 1 bonus critter -> e.g. 68, topSpeed = 5, length = 21
  const sub2 = await jsonReq('/api/scores', {
    method: 'POST',
    body: JSON.stringify({
      runId: run2.body.runId,
      name: 'NokiaQueen',
      playerKey: 'queen-secret-key-1234',
      score: 68,
      foods: 16,
      length: 21,
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
});
