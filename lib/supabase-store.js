'use strict';

const crypto = require('crypto');

const PAGE_SIZE = 1000;

function rowToScore(row) {
  return {
    id: row.id,
    name: row.name,
    score: Number(row.score),
    startSpeed: Number(row.start_speed),
    topSpeed: Number(row.top_speed),
    maze: Number(row.maze),
    foods: Number(row.foods),
    length: Number(row.length),
    durationMs: Number(row.duration_ms),
    createdAt: Number(row.created_at),
  };
}

function createSupabaseStore({ supabaseUrl, supabaseKey, helpers, fetchImpl }) {
  const {
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
  } = helpers;

  const baseUrl = String(supabaseUrl).replace(/\/+$/, '');
  const apiKey = String(supabaseKey).trim();
  const doFetch = fetchImpl || globalThis.fetch;
  const activeRuns = new Map();

  const MAX_ACTIVE_RUNS = 10000;

  function pruneRuns() {
    const cutoff = Date.now() - RUN_TTL_MS;
    for (const [id, run] of activeRuns.entries()) {
      if (run.startedAt < cutoff) activeRuns.delete(id);
    }
    while (activeRuns.size >= MAX_ACTIVE_RUNS) {
      const oldestKey = activeRuns.keys().next().value;
      if (oldestKey === undefined) break;
      activeRuns.delete(oldestKey);
    }
  }

  async function request(endpoint, { method = 'GET', body, headers = {} } = {}) {
    const reqHeaders = {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...headers,
    };
    if (body !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    let res;
    try {
      res = await doFetch(`${baseUrl}/rest/v1/${endpoint}`, {
        method,
        headers: reqHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new StoreError(502, 'DB_UNAVAILABLE', `Database request failed: ${err.message}`);
    }

    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    return { ok: res.ok, status: res.status, data: parsed };
  }

  async function fetchPlayer(lower) {
    const res = await request(
      `players?name_lower=eq.${encodeURIComponent(lower)}&select=name_lower,name,key_hash,created_at&limit=1`
    );
    if (!res.ok) {
      throw new StoreError(502, 'DB_ERROR', 'Failed to read player from database.');
    }
    return Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
  }

  async function fetchAllScores() {
    const all = [];
    let offset = 0;

    while (true) {
      const res = await request(
        'scores?select=id,name,score,start_speed,top_speed,maze,foods,length,duration_ms,created_at&order=created_at.asc',
        {
          headers: {
            'Range-Unit': 'items',
            Range: `${offset}-${offset + PAGE_SIZE - 1}`,
          },
        }
      );

      if (!res.ok) {
        // 416 Range Not Satisfiable means offset is past the end (0 remaining rows)
        if (res.status === 416) break;
        throw new StoreError(502, 'DB_ERROR', 'Failed to read scores from database.');
      }

      const rows = Array.isArray(res.data) ? res.data : [];
      for (const row of rows) {
        all.push(rowToScore(row));
      }
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return all;
  }

  async function ensurePlayer(name, keyHash) {
    const lower = name.toLowerCase();
    const existing = await fetchPlayer(lower);

    if (existing) {
      if (existing.key_hash !== keyHash) {
        throw new StoreError(409, 'NAME_TAKEN', 'That nickname is already claimed by another player.');
      }
      if (existing.name !== name) {
        const patch = await request(`players?name_lower=eq.${encodeURIComponent(lower)}`, {
          method: 'PATCH',
          body: { name },
          headers: { Prefer: 'return=minimal' },
        });
        if (!patch.ok) {
          throw new StoreError(502, 'DB_ERROR', 'Failed to update player nickname.');
        }
      }
      return name;
    }

    const insert = await request('players', {
      method: 'POST',
      body: {
        name_lower: lower,
        name,
        key_hash: keyHash,
        created_at: Date.now(),
      },
      headers: { Prefer: 'return=minimal' },
    });

    if (!insert.ok) {
      // Handle concurrent registration race condition
      if (insert.status === 409) {
        const raced = await fetchPlayer(lower);
        if (raced && raced.key_hash === keyHash) {
          return raced.name;
        }
        throw new StoreError(409, 'NAME_TAKEN', 'That nickname is already claimed by another player.');
      }
      throw new StoreError(502, 'DB_ERROR', 'Failed to save player in database.');
    }

    return name;
  }

  function summaryFromScores(scores, name) {
    const allRankings = computeRankings(scores);
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

  async function getPlayerSummary(name) {
    const scores = await fetchAllScores();
    return summaryFromScores(scores, name);
  }

  async function registerPlayer(rawName, rawKey) {
    const name = normalizeName(rawName);
    const key = validatePlayerKey(rawKey);
    const keyHash = hashKey(key);

    const savedName = await ensurePlayer(name, keyHash);
    return getPlayerSummary(savedName);
  }

  async function startRun(mazeIdx) {
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

  async function submitScore(payload) {
    const validated = validateScorePayload(payload, activeRuns);
    const { name, lower, keyHash, runId, run, score, foods, length, topSpeed, maze, durationMs } = validated;

    const existingPlayer = await fetchPlayer(lower);
    let canonicalName = name;
    if (existingPlayer) {
      if (existingPlayer.key_hash !== keyHash) {
        throw new StoreError(409, 'NAME_TAKEN', 'That nickname is already claimed by another player.');
      }
      canonicalName = existingPlayer.name;
    } else {
      canonicalName = await ensurePlayer(name, keyHash);
    }

    const existingScores = await fetchAllScores();
    const prevBestAll = existingScores.reduce((m, s) => Math.max(m, s.score), 0);
    const prevPlayerBest = existingScores
      .filter((s) => s.name.toLowerCase() === lower)
      .reduce((m, s) => Math.max(m, s.score), 0);

    const entry = {
      id: crypto.randomBytes(8).toString('hex'),
      name: canonicalName,
      score,
      startSpeed: START_SPEED,
      topSpeed,
      maze,
      foods,
      length,
      durationMs: Math.round(durationMs),
      createdAt: Date.now(),
    };

    const insert = await request('scores', {
      method: 'POST',
      body: {
        id: entry.id,
        name: entry.name,
        name_lower: lower,
        score: entry.score,
        start_speed: entry.startSpeed,
        top_speed: entry.topSpeed,
        maze: entry.maze,
        foods: entry.foods,
        length: entry.length,
        duration_ms: entry.durationMs,
        created_at: entry.createdAt,
      },
      headers: { Prefer: 'return=minimal' },
    });

    if (!insert.ok) {
      throw new StoreError(502, 'DB_ERROR', 'Failed to save score in database.');
    }

    run.used = true;
    activeRuns.delete(runId);

    const allScores = [...existingScores, entry];
    const summary = summaryFromScores(allScores, entry.name);
    return {
      entry,
      bestScore: summary.bestScore,
      globalRank: summary.globalRank,
      gamesPlayed: summary.gamesPlayed,
      isPersonalBest: score > prevPlayerBest,
      isWorldRecord: score > prevBestAll,
    };
  }

  async function getLeaderboard(options = {}) {
    const scores = await fetchAllScores();
    return buildLeaderboard(scores, options);
  }

  return {
    storageMode: 'supabase',
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

module.exports = { createSupabaseStore };
