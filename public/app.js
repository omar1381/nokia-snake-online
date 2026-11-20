(() => {
  'use strict';

  const MAZE_NAMES = ['No maze', 'Box', 'Tunnel', 'Mill', 'Rails', 'Apartment'];
  const STORAGE_NAME_KEY = 'nokia_snake_online_nickname_v1';
  const STORAGE_SECRET_KEY = 'nokia_snake_online_player_key_v1';
  const STORAGE_LOCAL_SCORES_KEY = 'nokia_snake_local_scores_v1';

  // DOM references
  const playView = document.getElementById('playView');
  const boardView = document.getElementById('boardView');
  const tabPlay = document.getElementById('tabPlay');
  const tabBoard = document.getElementById('tabBoard');
  const brandLink = document.getElementById('brandLink');
  const openFullBoardBtn = document.getElementById('openFullBoardBtn');
  const playNowBtn = document.getElementById('playNowBtn');

  const nicknameForm = document.getElementById('nicknameForm');
  const nicknameInput = document.getElementById('nicknameInput');
  const onlineStatus = document.getElementById('onlineStatus');
  const playerBestStat = document.getElementById('playerBestStat');
  const playerRankStat = document.getElementById('playerRankStat');
  const miniLeaderboard = document.getElementById('miniLeaderboard');

  const updatedAgoEl = document.getElementById('updatedAgo');
  const kpiRecord = document.getElementById('kpiRecord');
  const kpiRecordBy = document.getElementById('kpiRecordBy');
  const kpiPlayers = document.getElementById('kpiPlayers');
  const kpiGames = document.getElementById('kpiGames');
  const kpiToday = document.getElementById('kpiToday');
  const kpiHours = document.getElementById('kpiHours');
  const podiumGrid = document.getElementById('podiumGrid');
  const rankingsCount = document.getElementById('rankingsCount');
  const rankingsBody = document.getElementById('rankingsBody');
  const recentGamesList = document.getElementById('recentGamesList');
  const mazeFilter = document.getElementById('mazeFilter');
  const searchInput = document.getElementById('searchInput');
  const periodButtons = document.querySelectorAll('.period-btn');

  // Static hosting (e.g. GitHub Pages) automatically uses local browser storage
  let useLocalMode =
    window.location.protocol === 'file:' ||
    window.location.hostname.endsWith('.github.io');

  // State
  let currentView =
    window.location.pathname === '/leaderboard' || window.location.hash === '#leaderboard'
      ? 'board'
      : 'play';
  let playerName = localStorage.getItem(STORAGE_NAME_KEY) || '';
  let playerKey = getOrCreatePlayerKey();
  let activeRunId = null;
  let activeRunPromise = null;
  let lastUpdatedAt = Date.now();

  const filters = {
    period: 'all',
    maze: 'all',
    search: '',
  };

  function getOrCreatePlayerKey() {
    let key = localStorage.getItem(STORAGE_SECRET_KEY);
    if (!key || key.length < 16) {
      const bytes = new Uint8Array(18);
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(STORAGE_SECRET_KEY, key);
    }
    return key;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatRelative(ts) {
    const diffSec = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function setStatus(html, tone = '') {
    onlineStatus.className = `status-box${tone ? ` ${tone}` : ''}`;
    onlineStatus.innerHTML = html;
  }

  function updatePlayerSummaryUI(summary) {
    if (!summary) {
      playerBestStat.textContent = '–';
      playerRankStat.textContent = '–';
      return;
    }
    playerBestStat.textContent = summary.bestScore != null ? String(summary.bestScore) : '–';
    playerRankStat.textContent = summary.globalRank != null ? `#${summary.globalRank}` : '–';
  }

  // Local fallback store for static deployments (e.g. GitHub Pages)
  const localStore = (() => {
    function loadScores() {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_LOCAL_SCORES_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function saveScores(scores) {
      localStorage.setItem(STORAGE_LOCAL_SCORES_KEY, JSON.stringify(scores));
    }

    function computeRankings(scores) {
      const byPlayer = new Map();
      for (const s of scores) {
        const k = s.name.toLowerCase();
        const existing = byPlayer.get(k);
        if (!existing) {
          byPlayer.set(k, { ...s, games: 1 });
        } else {
          existing.games += 1;
          const isBetter =
            s.score > existing.score ||
            (s.score === existing.score && s.topSpeed > existing.topSpeed) ||
            (s.score === existing.score && s.topSpeed === existing.topSpeed && s.createdAt < existing.createdAt);
          if (isBetter) {
            Object.assign(existing, s);
          }
        }
      }
      return Array.from(byPlayer.values())
        .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.topSpeed !== a.topSpeed ? b.topSpeed - a.topSpeed : a.createdAt - b.createdAt))
        .map((row, idx) => ({ rank: idx + 1, ...row }));
    }

    function getPlayerSummary(name) {
      const all = computeRankings(loadScores());
      const found = all.find((r) => r.name.toLowerCase() === name.toLowerCase());
      if (!found) return { name, bestScore: null, globalRank: null, gamesPlayed: 0 };
      return { name: found.name, bestScore: found.score, globalRank: found.rank, gamesPlayed: found.games };
    }

    function registerPlayer(rawName) {
      const name = String(rawName || '').trim().replace(/\s+/g, ' ');
      if (name.length < 2 || name.length > 20) {
        throw new Error('Nickname must be between 2 and 20 characters.');
      }
      if (!/^[A-Za-z0-9 _.-]+$/.test(name)) {
        throw new Error('Use letters, numbers, spaces, dots, hyphens, or underscores.');
      }
      return getPlayerSummary(name);
    }

    function submitScore(payload) {
      const scores = loadScores();
      const lower = payload.name.toLowerCase();
      const prevBestAll = scores.reduce((m, s) => Math.max(m, s.score), 0);
      const prevPlayerBest = scores
        .filter((s) => s.name.toLowerCase() === lower)
        .reduce((m, s) => Math.max(m, s.score), 0);

      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name: payload.name,
        score: payload.score,
        startSpeed: 1,
        topSpeed: payload.topSpeed,
        maze: payload.maze,
        foods: payload.foods,
        length: payload.length,
        durationMs: Math.round(payload.durationMs || 0),
        createdAt: Date.now(),
      };
      scores.push(entry);
      saveScores(scores);

      const summary = getPlayerSummary(entry.name);
      return {
        entry,
        bestScore: summary.bestScore,
        globalRank: summary.globalRank,
        gamesPlayed: summary.gamesPlayed,
        isPersonalBest: entry.score > prevPlayerBest,
        isWorldRecord: entry.score > prevBestAll,
      };
    }

    function getLeaderboard({ period = 'all', maze = 'all', search = '', limit = 100 } = {}) {
      const scores = loadScores();
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

      const allRankings = computeRankings(scores);
      const top = allRankings[0] || null;
      const totalDurationMs = scores.reduce((sum, s) => sum + (Number(s.durationMs) || 0), 0);

      let filtered = scores;
      if (period === 'today') filtered = filtered.filter((s) => s.createdAt >= dayAgo);
      else if (period === 'week') filtered = filtered.filter((s) => s.createdAt >= weekAgo);
      if (maze !== 'all' && maze !== '') {
        const mIdx = Number(maze);
        if (Number.isInteger(mIdx)) filtered = filtered.filter((s) => s.maze === mIdx);
      }

      const fullRankings = computeRankings(filtered);
      const q = String(search || '').trim().toLowerCase();
      const searched = q ? fullRankings.filter((r) => r.name.toLowerCase().includes(q)) : fullRankings;

      return {
        stats: {
          worldRecord: top
            ? { score: top.score, name: top.name, maze: top.maze, topSpeed: top.topSpeed, durationMs: top.durationMs }
            : null,
          totalPlayers: allRankings.length,
          totalGames: scores.length,
          gamesToday: scores.filter((s) => s.createdAt >= dayAgo).length,
          hoursPlayed: Math.round((totalDurationMs / 3600000) * 10) / 10,
        },
        rankings: searched.slice(0, Number(limit) || 100),
        totalMatching: searched.length,
        totalPlayersInFilter: fullRankings.length,
        recentGames: [...scores].sort((a, b) => b.createdAt - a.createdAt).slice(0, 15),
        updatedAt: now,
      };
    }

    return { registerPlayer, getPlayerSummary, submitScore, getLeaderboard };
  })();

  async function apiJson(url, options = {}) {
    if (useLocalMode) {
      return localApiDispatch(url, options);
    }
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  }

  function localApiDispatch(url, options = {}) {
    const parsed = new URL(url, window.location.origin);
    const body = options.body ? JSON.parse(options.body) : {};
    if (parsed.pathname === '/api/players') {
      return Promise.resolve(localStore.registerPlayer(body.name));
    }
    if (parsed.pathname === '/api/players/me') {
      const name = parsed.searchParams.get('name') || '';
      return Promise.resolve(name ? localStore.getPlayerSummary(name) : { name: null, bestScore: null, globalRank: null, gamesPlayed: 0 });
    }
    if (parsed.pathname === '/api/runs/start') {
      return Promise.resolve({ runId: `local-${Date.now()}`, startedAt: Date.now(), startSpeed: 1 });
    }
    if (parsed.pathname === '/api/scores') {
      return Promise.resolve(localStore.submitScore(body));
    }
    if (parsed.pathname === '/api/leaderboard') {
      return Promise.resolve(
        localStore.getLeaderboard({
          period: parsed.searchParams.get('period') || 'all',
          maze: parsed.searchParams.get('maze') || 'all',
          search: parsed.searchParams.get('search') || '',
          limit: parsed.searchParams.get('limit') || '100',
        })
      );
    }
    return Promise.resolve({});
  }

  // =========================================================================
  // VIEW SWITCHING
  // =========================================================================
  function setView(view, pushHistory = true) {
    currentView = view === 'board' ? 'board' : 'play';
    const isBoard = currentView === 'board';

    playView.classList.toggle('hidden', isBoard);
    boardView.classList.toggle('hidden', !isBoard);
    tabPlay.classList.toggle('active', !isBoard);
    tabBoard.classList.toggle('active', isBoard);

    if (window.NokiaSnakeGame) {
      window.NokiaSnakeGame.setViewActive(!isBoard);
    }

    if (pushHistory) {
      if (useLocalMode) {
        const targetHash = isBoard ? '#leaderboard' : '#play';
        if (window.location.hash !== targetHash) {
          window.history.pushState({ view: currentView }, '', targetHash);
        }
      } else {
        const targetPath = isBoard ? '/leaderboard' : '/';
        if (window.location.pathname !== targetPath) {
          window.history.pushState({ view: currentView }, '', targetPath);
        }
      }
    }

    if (isBoard) {
      refreshLeaderboard();
    }
  }

  tabPlay.addEventListener('click', () => setView('play'));
  tabBoard.addEventListener('click', () => setView('board'));
  openFullBoardBtn.addEventListener('click', () => setView('board'));
  playNowBtn.addEventListener('click', () => setView('play'));
  brandLink.addEventListener('click', (e) => {
    e.preventDefault();
    setView('play');
  });

  window.addEventListener('popstate', () => {
    const isBoard = window.location.pathname === '/leaderboard' || window.location.hash === '#leaderboard';
    setView(isBoard ? 'board' : 'play', false);
  });

  // =========================================================================
  // PLAYER PROFILE & SCORE SUBMISSION
  // =========================================================================
  async function saveNickname(raw) {
    const cleaned = raw.trim();
    if (!cleaned) {
      setStatus('Enter a nickname (2–20 characters) to post scores.', 'error');
      return;
    }
    try {
      const summary = await apiJson('/api/players', {
        method: 'POST',
        body: JSON.stringify({ name: cleaned, playerKey }),
      });
      playerName = summary.name;
      nicknameInput.value = playerName;
      localStorage.setItem(STORAGE_NAME_KEY, playerName);
      updatePlayerSummaryUI(summary);
      setStatus(`Playing as <strong>${escapeHtml(playerName)}</strong>. Press New Game!`, 'ok');
      refreshLeaderboard();
    } catch (err) {
      setStatus(escapeHtml(err.message), 'error');
    }
  }

  nicknameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    nicknameInput.blur();
    saveNickname(nicknameInput.value);
  });

  async function refreshMySummary() {
    if (!playerName) {
      updatePlayerSummaryUI(null);
      return;
    }
    try {
      const summary = await apiJson(`/api/players/me?name=${encodeURIComponent(playerName)}`);
      updatePlayerSummaryUI(summary);
    } catch {
      // ignore transient errors
    }
  }

  // Wire game lifecycle callbacks
  if (window.NokiaSnakeGame) {
    window.NokiaSnakeGame.setCallbacks({
      onGameStart({ maze }) {
        activeRunId = null;
        if (playerName) {
          setStatus(`Playing as <strong>${escapeHtml(playerName)}</strong> &middot; ${MAZE_NAMES[maze]}`, 'ok');
        } else {
          setStatus('Playing unranked. Save a nickname to post scores automatically.');
        }

        activeRunPromise = apiJson('/api/runs/start', {
          method: 'POST',
          body: JSON.stringify({ maze }),
        })
          .then((res) => {
            activeRunId = res.runId;
            return res.runId;
          })
          .catch(() => {
            activeRunId = null;
            return null;
          });
      },

      async onGameOver(run) {
        if (!playerName) {
          if (run.score > 0) {
            setStatus(`Scored <strong>${run.score}</strong>! Save a nickname above to rank on the leaderboard.`);
          } else {
            setStatus('Pick a nickname, then press New Game.');
          }
          return;
        }

        if (run.score <= 0) {
          setStatus('No points this time. Eat some apples to get on the board!');
          return;
        }

        setStatus(`Posting score <strong>${run.score}</strong>...`);
        const runId = activeRunId || (activeRunPromise ? await activeRunPromise : null);
        activeRunId = null;
        activeRunPromise = null;

        if (!runId) {
          setStatus('Could not start a validated session. Try starting a new game.', 'error');
          return;
        }

        try {
          const result = await apiJson('/api/scores', {
            method: 'POST',
            body: JSON.stringify({
              runId,
              name: playerName,
              playerKey,
              score: run.score,
              foods: run.foods,
              length: run.length,
              topSpeed: run.topSpeed,
              maze: run.maze,
              durationMs: run.durationMs,
            }),
          });

          updatePlayerSummaryUI({
            bestScore: result.bestScore,
            globalRank: result.globalRank,
          });

          if (result.isWorldRecord) {
            setStatus(`NEW WORLD RECORD! <strong>${run.score}</strong> (#1 overall)`, 'ok');
          } else if (result.isPersonalBest) {
            setStatus(`New personal best: <strong>${run.score}</strong> &middot; Global rank #${result.globalRank}`, 'ok');
          } else {
            setStatus(`Posted <strong>${run.score}</strong> (speed 1&rarr;${run.topSpeed}). Best: ${result.bestScore} (#${result.globalRank})`, 'ok');
          }

          refreshLeaderboard();
        } catch (err) {
          setStatus(`Could not post score: ${escapeHtml(err.message)}`, 'error');
        }
      },
    });
  }

  // =========================================================================
  // LEADERBOARD RENDERING
  // =========================================================================
  function rankBadgeHtml(rank) {
    const cls = rank === 1 ? ' r1' : rank === 2 ? ' r2' : rank === 3 ? ' r3' : '';
    return `<span class="rank-badge${cls}">${rank}</span>`;
  }

  function renderMiniBoard(rankings) {
    const top5 = (rankings || []).slice(0, 5);
    if (top5.length === 0) {
      miniLeaderboard.innerHTML = '<li class="mini-empty">No scores yet. Be the first!</li>';
      return;
    }
    miniLeaderboard.innerHTML = top5
      .map((row) => `
        <li class="mini-row">
          <span class="mini-left">
            ${rankBadgeHtml(row.rank)}
            <span class="mini-name">${escapeHtml(row.name)}</span>
          </span>
          <span class="mini-score">${row.score}</span>
        </li>
      `)
      .join('');
  }

  function renderPodium(rankings) {
    const top3 = (rankings || []).slice(0, 3);
    if (top3.length === 0) {
      podiumGrid.innerHTML = '';
      podiumGrid.classList.add('hidden');
      return;
    }
    podiumGrid.classList.remove('hidden');

    // Classic podium order: #2 left, #1 center, #3 right (when 2+ players exist)
    const ordered = top3.length >= 2
      ? [top3[1], top3[0], top3[2]].filter(Boolean)
      : [top3[0]];

    podiumGrid.innerHTML = ordered
      .map((row) => {
        const isFirst = row.rank === 1;
        return `
          <div class="podium-card${isFirst ? ' first' : ''}">
            ${rankBadgeHtml(row.rank)}
            <div class="podium-name">${escapeHtml(row.name)}</div>
            <div class="podium-score">${row.score}</div>
            <div class="podium-meta">
              ${escapeHtml(MAZE_NAMES[row.maze] || 'No maze')} &middot; speed 1&rarr;${row.topSpeed} &middot; ${formatDuration(row.durationMs)}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderRankingsTable(data) {
    const rows = data.rankings || [];
    rankingsCount.textContent = `${data.totalMatching} of ${data.totalPlayersInFilter} player${data.totalPlayersInFilter === 1 ? '' : 's'}`;

    if (rows.length === 0) {
      rankingsBody.innerHTML = '<tr><td colspan="9" class="table-empty">No matching players yet.</td></tr>';
      return;
    }

    const meLower = playerName.toLowerCase();
    rankingsBody.innerHTML = rows
      .map((r) => {
        const isMe = meLower && r.name.toLowerCase() === meLower;
        return `
          <tr class="${isMe ? 'is-me' : ''}">
            <td>${rankBadgeHtml(r.rank)}</td>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td class="num mono"><strong>${r.score}</strong></td>
            <td><span class="maze-tag">${escapeHtml(MAZE_NAMES[r.maze] || 'No maze')}</span></td>
            <td class="num mono"><span class="speed-arrow">1 &rarr; <strong>${r.topSpeed}</strong></span></td>
            <td class="num mono">${r.length}</td>
            <td class="num mono">${formatDuration(r.durationMs)}</td>
            <td class="num mono">${r.games}</td>
            <td class="num" style="color: var(--muted);">${formatRelative(r.createdAt)}</td>
          </tr>
        `;
      })
      .join('');
  }

  function renderRecentGames(recent) {
    const items = recent || [];
    if (items.length === 0) {
      recentGamesList.innerHTML = '<li class="mini-empty">No games played yet.</li>';
      return;
    }
    recentGamesList.innerHTML = items
      .map((g) => `
        <li class="recent-item">
          <div class="recent-top">
            <span class="recent-name">${escapeHtml(g.name)}</span>
            <span class="recent-score">${g.score}</span>
          </div>
          <div class="recent-meta">
            ${escapeHtml(MAZE_NAMES[g.maze] || 'No maze')} &middot; reached speed ${g.topSpeed} &middot; ${formatRelative(g.createdAt)}
          </div>
        </li>
      `)
      .join('');
  }

  function renderKPIs(stats) {
    if (!stats) return;
    if (stats.worldRecord) {
      kpiRecord.textContent = String(stats.worldRecord.score);
      kpiRecordBy.textContent = `by ${stats.worldRecord.name}`;
    } else {
      kpiRecord.textContent = '–';
      kpiRecordBy.textContent = 'No runs yet';
    }
    kpiPlayers.textContent = String(stats.totalPlayers || 0);
    kpiGames.textContent = String(stats.totalGames || 0);
    kpiToday.textContent = String(stats.gamesToday || 0);
    kpiHours.textContent = String(stats.hoursPlayed || 0);
  }

  async function refreshLeaderboard() {
    try {
      const qs = new URLSearchParams({
        period: filters.period,
        maze: filters.maze,
        search: filters.search,
      });

      // Fetch filtered board + all-time top 5 for sidebar/podium consistency
      const [filteredData, allTimeData] = await Promise.all([
        apiJson(`/api/leaderboard?${qs.toString()}`),
        filters.period === 'all' && filters.maze === 'all' && !filters.search
          ? Promise.resolve(null)
          : apiJson('/api/leaderboard?period=all&maze=all&limit=5'),
      ]);

      const miniSource = allTimeData || filteredData;
      renderMiniBoard(miniSource.rankings);
      renderKPIs(filteredData.stats);
      renderPodium(filteredData.rankings);
      renderRankingsTable(filteredData);
      renderRecentGames(filteredData.recentGames);

      lastUpdatedAt = Date.now();
      updateAgoLabel();
    } catch {
      // Keep existing UI on transient error
    }
  }

  function updateAgoLabel() {
    const secs = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
    updatedAgoEl.textContent = `Updated ${secs}s ago`;
  }

  setInterval(updateAgoLabel, 1000);

  // Filters
  periodButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.period = btn.dataset.period;
      periodButtons.forEach((b) => b.classList.toggle('active', b === btn));
      refreshLeaderboard();
    });
  });

  mazeFilter.addEventListener('change', () => {
    filters.maze = mazeFilter.value;
    refreshLeaderboard();
  });

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.search = searchInput.value.trim();
      refreshLeaderboard();
    }, 150);
  });

  // Live SSE updates
  function connectEvents() {
    if (useLocalMode || typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/events');
    es.addEventListener('score', () => {
      refreshLeaderboard();
      refreshMySummary();
    });
    es.onerror = () => {
      // EventSource automatically reconnects
    };
  }

  // Initialize
  if (playerName) {
    nicknameInput.value = playerName;
    setStatus(`Playing as <strong>${escapeHtml(playerName)}</strong>. Press New Game!`, 'ok');
    refreshMySummary();
  }

  setView(currentView, false);
  refreshLeaderboard();
  connectEvents();
})();
