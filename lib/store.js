'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAZE_NAMES = ['No maze', 'Box', 'Tunnel', 'Mill', 'Rails', 'Apartment'];
const APPLES_PER_SPEED_UP = 4;
const APPLES_PER_GROWTH = 2;
const START_SPEED = 1;
const INITIAL_SNAKE_LENGTH = 5;
const RUN_TTL_MS = 2 * 60 * 60 * 1000;

class StoreError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

function normalizeName(raw) {
  if (typeof raw !== 'string') {
    throw new StoreError(400, 'INVALID_NAME', 'Nickname is required.');
  }
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 20) {
    throw new StoreError(400, 'INVALID_NAME', 'Nickname must be between 2 and 20 characters.');
  }
  if (!/^[A-Za-z0-9 _.-]+$/.test(name)) {
    throw new StoreError(400, 'INVALID_NAME', 'Use letters, numbers, spaces, dots, hyphens, or underscores.');
  }
  return name;
}

function validatePlayerKey(key) {
  if (typeof key !== 'string' || key.trim().length < 8 || key.length > 128) {
    throw new StoreError(400, 'INVALID_KEY', 'Invalid player key.');
  }
  return key.trim();
}

function expectedTopSpeed(foods) {
  return START_SPEED + Math.floor(foods / APPLES_PER_SPEED_UP);
}

function expectedLength(foods) {
  return INITIAL_SNAKE_LENGTH + Math.floor(foods / APPLES_PER_GROWTH);
}

function maxPlausibleScore(foods) {
  let applePts = 0;
  for (let i = 0; i < foods; i++) {
    applePts += START_SPEED + Math.floor(i / APPLES_PER_SPEED_UP);
  }
  const bonusCount = Math.floor(foods / 5);
  let bonusPts = 0;
  for (let b = 1; b <= bonusCount; b++) {
    const spd = START_SPEED + Math.floor((b * 5) / APPLES_PER_SPEED_UP);
    // Max ticksLeft on bonus spawn is 20 + Math.floor(spd / 3) * 2 (generously padded by +6)
    const maxTicks = 26 + Math.floor(spd / 3) * 2;
    bonusPts += maxTicks * Math.ceil(spd / 2) + spd * 2;
  }
  return applePts + bonusPts;
}

const { createSupabaseStore } = require('./supabase-store');

function validateScorePayload(payload, activeRuns) {
  if (!payload || typeof payload !== 'object') {
    throw new StoreError(400, 'INVALID_BODY', 'Request body is required.');
  }

  const name = normalizeName(payload.name);
  const key = validatePlayerKey(payload.playerKey);
  const lower = name.toLowerCase();
  const keyHash = hashKey(key);

  const runId = typeof payload.runId === 'string' ? payload.runId : '';
  const run = activeRuns.get(runId);
  if (!run || run.used) {
    throw new StoreError(400, 'INVALID_RUN', 'Game session is missing or already submitted.');
  }

  const score = Number(payload.score);
  const foods = Number(payload.foods);
  const length = Number(payload.length);
  const topSpeed = Number(payload.topSpeed);
  const maze = Number(payload.maze);
  const durationMs = Number(payload.durationMs);

  if (!Number.isInteger(score) || score <= 0 || score > 200000) {
    throw new StoreError(400, 'INVALID_SCORE', 'Score must be a positive integer.');
  }
  if (!Number.isInteger(foods) || foods < 1 || foods > 5000) {
    throw new StoreError(400, 'INVALID_FOODS', 'Invalid apples count.');
  }
  if (!Number.isInteger(maze) || maze !== run.maze) {
    throw new StoreError(400, 'INVALID_MAZE', 'Maze does not match active game session.');
  }
  if (!Number.isInteger(length) || length !== expectedLength(foods)) {
    throw new StoreError(400, 'INVALID_LENGTH', 'Snake length does not match apples eaten.');
  }
  if (!Number.isInteger(topSpeed) || topSpeed !== expectedTopSpeed(foods)) {
    throw new StoreError(400, 'INVALID_SPEED', 'Top speed does not match progressive speed ramp.');
  }
  if (!Number.isFinite(durationMs) || durationMs < 250 || durationMs > 24 * 60 * 60 * 1000) {
    throw new StoreError(400, 'INVALID_DURATION', 'Invalid game duration.');
  }
  if (score > maxPlausibleScore(foods)) {
    throw new StoreError(400, 'SCORE_OUT_OF_RANGE', 'Submitted score exceeds maximum possible for apples eaten.');
  }

  return { name, lower, keyHash, runId, run, score, foods, length, topSpeed, maze, durationMs };
}

function computeRankings(scoresList) {
  const byPlayer = new Map();
  for (const s of scoresList) {
    const key = s.name.toLowerCase();
    const existing = byPlayer.get(key);
    if (!existing) {
      byPlayer.set(key, {
        name: s.name,
        score: s.score,
        maze: s.maze,
        topSpeed: s.topSpeed,
        length: s.length,
        foods: s.foods,
        durationMs: s.durationMs,
        createdAt: s.createdAt,
        games: 1,
      });
    } else {
      existing.games += 1;
      const isBetter =
        s.score > existing.score ||
        (s.score === existing.score && s.topSpeed > existing.topSpeed) ||
        (s.score === existing.score && s.topSpeed === existing.topSpeed && s.createdAt < existing.createdAt);
      if (isBetter) {
        existing.name = s.name;
        existing.score = s.score;
        existing.maze = s.maze;
        existing.topSpeed = s.topSpeed;
        existing.length = s.length;
        existing.foods = s.foods;
        existing.durationMs = s.durationMs;
        existing.createdAt = s.createdAt;
      }
    }
  }

  const sorted = Array.from(byPlayer.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.topSpeed !== a.topSpeed) return b.topSpeed - a.topSpeed;
    return a.createdAt - b.createdAt;
  });

  return sorted.map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}

function buildLeaderboard(scoresList, { period = 'all', maze = 'all', search = '', limit = 100 } = {}) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // All-time global KPIs
  const allRankings = computeRankings(scoresList);
  const topEntry = allRankings[0] || null;
  const totalDurationMs = scoresList.reduce((sum, s) => sum + (Number(s.durationMs) || 0), 0);
  const gamesToday = scoresList.filter((s) => s.createdAt >= dayAgo).length;

  const stats = {
    worldRecord: topEntry
      ? {
          score: topEntry.score,
          name: topEntry.name,
          maze: topEntry.maze,
          topSpeed: topEntry.topSpeed,
          durationMs: topEntry.durationMs,
        }
      : null,
    totalPlayers: allRankings.length,
    totalGames: scoresList.length,
    gamesToday,
    hoursPlayed: Math.round((totalDurationMs / 3600000) * 10) / 10,
  };

  // Filtered scores for Rankings table
  let filtered = scoresList;
  if (period === 'today') {
    filtered = filtered.filter((s) => s.createdAt >= dayAgo);
  } else if (period === 'week') {
    filtered = filtered.filter((s) => s.createdAt >= weekAgo);
  }

  if (maze !== 'all' && maze !== '' && maze !== null && maze !== undefined) {
    const mIdx = Number(maze);
    if (Number.isInteger(mIdx) && mIdx >= 0 && mIdx < MAZE_NAMES.length) {
      filtered = filtered.filter((s) => s.maze === mIdx);
    }
  }

  const fullRankings = computeRankings(filtered);
  const q = typeof search === 'string' ? search.trim().toLowerCase() : '';
  const searched = q
    ? fullRankings.filter((r) => r.name.toLowerCase().includes(q))
    : fullRankings;

  const clampedLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const rankings = searched.slice(0, clampedLimit);

  const recentGames = [...scoresList]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 15);

  return {
    stats,
    rankings,
    totalMatching: searched.length,
    totalPlayersInFilter: fullRankings.length,
    recentGames,
    updatedAt: now,
  };
}

function createFileStore(dataDir) {
  const dir = dataDir || path.join(__dirname, '..', 'data');
  const dbPath = path.join(dir, 'db.json');
  const activeRuns = new Map();

  let db = { scores: [], players: {} };

  function ensureDir() {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  function load() {
    ensureDir();
    if (!fs.existsSync(dbPath)) {
      save();
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      db = {
        scores: Array.isArray(parsed.scores) ? parsed.scores : [],
        players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
      };
    } catch {
      db = { scores: [], players: {} };
      save();
    }
  }

  function save() {
    ensureDir();
    const tmp = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, dbPath);
  }

  function pruneRuns() {
    const cutoff = Date.now() - RUN_TTL_MS;
    for (const [id, run] of activeRuns.entries()) {
      if (run.startedAt < cutoff) activeRuns.delete(id);
    }
  }

  function getPlayerSummary(name) {
    const allRankings = computeRankings(db.scores);
    const lower = name.toLowerCase();
    const found = allRankings.find((r) => r.name.toLowerCase() === lower);
    if (!found) {
      return { name, bestScore: null, globalRank: null, gamesPlayed: 0 };
    }
    return {
      name: found.name,
      bestScore: found.score,
      globalRank: found.rank,
      gamesPlayed: found.games,
    };
  }

  function registerPlayer(rawName, rawKey) {
    const name = normalizeName(rawName);
    const key = validatePlayerKey(rawKey);
    const lower = name.toLowerCase();
    const keyHash = hashKey(key);

    const existing = db.players[lower];
    if (existing) {
      if (existing.keyHash !== keyHash) {
        throw new StoreError(409, 'NAME_TAKEN', 'That nickname is already claimed by another player.');
      }
      if (existing.name !== name) {
        existing.name = name;
        save();
      }
    } else {
      db.players[lower] = {
        name,
        keyHash,
        createdAt: Date.now(),
      };
      save();
    }

    return getPlayerSummary(name);
  }

  function startRun(mazeIdx) {
    pruneRuns();
    const maze = Number(mazeIdx);
    if (!Number.isInteger(maze) || maze < 0 || maze >= MAZE_NAMES.length) {
      throw new StoreError(400, 'INVALID_MAZE', 'Invalid maze selection.');
    }
    const runId = crypto.randomBytes(16).toString('hex');
    const startedAt = Date.now();
    activeRuns.set(runId, { runId, maze, startedAt, used: false });
    return { runId, startedAt, startSpeed: START_SPEED };
  }

  function submitScore(payload) {
    const validated = validateScorePayload(payload, activeRuns);
    const { name, lower, keyHash, runId, run, score, foods, length, topSpeed, maze, durationMs } = validated;

    // Verify or claim nickname
    const existingPlayer = db.players[lower];
    if (existingPlayer) {
      if (existingPlayer.keyHash !== keyHash) {
        throw new StoreError(409, 'NAME_TAKEN', 'That nickname is already claimed by another player.');
      }
    } else {
      db.players[lower] = {
        name,
        keyHash,
        createdAt: Date.now(),
      };
    }

    const prevBestAll = db.scores.reduce((m, s) => Math.max(m, s.score), 0);
    const prevPlayerBest = db.scores
      .filter((s) => s.name.toLowerCase() === lower)
      .reduce((m, s) => Math.max(m, s.score), 0);

    run.used = true;
    activeRuns.delete(runId);

    const entry = {
      id: crypto.randomBytes(8).toString('hex'),
      name: db.players[lower].name,
      score,
      startSpeed: START_SPEED,
      topSpeed,
      maze,
      foods,
      length,
      durationMs: Math.round(durationMs),
      createdAt: Date.now(),
    };

    db.scores.push(entry);
    save();

    const summary = getPlayerSummary(entry.name);
    return {
      entry,
      bestScore: summary.bestScore,
      globalRank: summary.globalRank,
      gamesPlayed: summary.gamesPlayed,
      isPersonalBest: score > prevPlayerBest,
      isWorldRecord: score > prevBestAll,
    };
  }

  function getLeaderboard(options = {}) {
    return buildLeaderboard(db.scores, options);
  }

  load();

  return {
    storageMode: 'file',
    registerPlayer,
    getPlayerSummary,
    startRun,
    submitScore,
    getLeaderboard,
    MAZE_NAMES,
    START_SPEED,
    APPLES_PER_SPEED_UP,
  };
}

function createStore(optionsOrDataDir) {
  const opts =
    typeof optionsOrDataDir === 'string'
      ? { dataDir: optionsOrDataDir }
      : optionsOrDataDir || {};

  if (opts.supabaseUrl && opts.supabaseKey) {
    return createSupabaseStore({
      supabaseUrl: opts.supabaseUrl,
      supabaseKey: opts.supabaseKey,
      fetchImpl: opts.fetchImpl,
      helpers: {
        StoreError,
        MAZE_NAMES,
        START_SPEED,
        APPLES_PER_SPEED_UP,
        RUN_TTL_MS,
        hashKey,
        normalizeName,
        validatePlayerKey,
        validateScorePayload,
        computeRankings,
        buildLeaderboard,
      },
    });
  }

  return createFileStore(opts.dataDir);
}

module.exports = {
  createStore,
  StoreError,
  MAZE_NAMES,
  START_SPEED,
  APPLES_PER_SPEED_UP,
  expectedTopSpeed,
  maxPlausibleScore,
};
