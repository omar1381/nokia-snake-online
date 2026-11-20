(() => {
  'use strict';

  // =========================================================================
  // 1. NOKIA 3310 84x48 FRAMEBUFFER & PIXEL RENDERER
  // =========================================================================
  const LCD_W = 84;
  const LCD_H = 48;
  const SCALE = 6; // 504x288 physical canvas -> crisp 5px pixel + 1px LCD gap
  const fb = new Uint8Array(LCD_W * LCD_H);

  const canvas = document.getElementById('lcd');
  const ctx = canvas.getContext('2d');
  const lcdGlass = document.getElementById('lcdGlass');

  let backlightOn = true;
  let soundOn = true;
  let isViewActive = true;

  function clearFB() {
    fb.fill(0);
  }

  function setPx(x, y, val = 1) {
    if (x < 0 || x >= LCD_W || y < 0 || y >= LCD_H) return;
    fb[y * LCD_W + x] = val ? 1 : 0;
  }

  function drawHLine(x, y, len, val = 1) {
    for (let i = 0; i < len; i++) setPx(x + i, y, val);
  }

  function drawVLine(x, y, len, val = 1) {
    for (let i = 0; i < len; i++) setPx(x, y + i, val);
  }

  function drawRect(x, y, w, h, fill = false, val = 1) {
    if (fill) {
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) setPx(xx, yy, val);
      }
    } else {
      drawHLine(x, y, w, val);
      drawHLine(x, y + h - 1, w, val);
      drawVLine(x, y, h, val);
      drawVLine(x + w - 1, y, h, val);
    }
  }

  const FONT_3X5 = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '001', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    'A': ['010', '101', '111', '101', '101'],
    'B': ['110', '101', '110', '101', '110'],
    'C': ['011', '100', '100', '100', '011'],
    'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'],
    'F': ['111', '100', '110', '100', '100'],
    'G': ['011', '100', '101', '101', '011'],
    'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'],
    'J': ['001', '001', '001', '101', '010'],
    'K': ['101', '101', '110', '101', '101'],
    'L': ['100', '100', '100', '100', '111'],
    'M': ['101', '111', '111', '101', '101'],
    'N': ['110', '101', '101', '101', '101'],
    'O': ['010', '101', '101', '101', '010'],
    'P': ['110', '101', '110', '100', '100'],
    'Q': ['010', '101', '101', '111', '011'],
    'R': ['110', '101', '110', '101', '101'],
    'S': ['011', '100', '010', '001', '110'],
    'T': ['111', '010', '010', '010', '010'],
    'U': ['101', '101', '101', '101', '111'],
    'V': ['101', '101', '101', '101', '010'],
    'W': ['101', '101', '111', '111', '101'],
    'X': ['101', '101', '010', '101', '101'],
    'Y': ['101', '101', '010', '010', '010'],
    'Z': ['111', '001', '010', '100', '111'],
    ':': ['0', '1', '0', '1', '0'],
    '.': ['0', '0', '0', '0', '1'],
    '-': ['000', '000', '111', '000', '000'],
    '!': ['1', '1', '1', '0', '1'],
    '/': ['001', '001', '010', '100', '100'],
    '>': ['100', '010', '001', '010', '100'],
    '<': ['001', '010', '100', '010', '001'],
    ' ': ['00', '00', '00', '00', '00'],
  };

  const FONT_5X7 = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    'J': ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'V': ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
    'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '!': ['010', '010', '010', '010', '010', '000', '010'],
    ':': ['00', '01', '00', '00', '01', '00', '00'],
    '-': ['0000', '0000', '0000', '1111', '0000', '0000', '0000'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
  };

  function measureText(str, font = FONT_3X5) {
    const up = str.toUpperCase();
    let w = 0;
    for (let i = 0; i < up.length; i++) {
      const g = font[up[i]] || font[' '];
      w += g[0].length + (i < up.length - 1 ? 1 : 0);
    }
    return w;
  }

  function drawText(str, x, y, val = 1, font = FONT_3X5) {
    const up = str.toUpperCase();
    let cx = x;
    for (let i = 0; i < up.length; i++) {
      const g = font[up[i]] || font[' '];
      for (let r = 0; r < g.length; r++) {
        for (let c = 0; c < g[r].length; c++) {
          if (g[r][c] === '1') setPx(cx + c, y + r, val);
        }
      }
      cx += g[0].length + 1;
    }
  }

  function drawTextCentered(str, y, val = 1, font = FONT_3X5) {
    const w = measureText(str, font);
    drawText(str, Math.floor((LCD_W - w) / 2), y, val, font);
  }

  function drawSprite(rows, x, y, val = 1) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '1') setPx(x + c, y + r, val);
      }
    }
  }

  function flushLCD() {
    const bgColor = backlightOn ? '#99c92b' : '#94aa6c';
    const ghostColor = backlightOn ? 'rgba(20, 42, 6, 0.065)' : 'rgba(22, 34, 14, 0.06)';
    const shadowColor = backlightOn ? 'rgba(18, 40, 6, 0.16)' : 'rgba(20, 32, 12, 0.15)';
    const inkColor = backlightOn ? '#142608' : '#1b2613';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = ghostColor;
    for (let y = 0; y < LCD_H; y++) {
      for (let x = 0; x < LCD_W; x++) {
        if (!fb[y * LCD_W + x]) {
          ctx.fillRect(x * SCALE, y * SCALE, SCALE - 1, SCALE - 1);
        }
      }
    }

    ctx.fillStyle = shadowColor;
    for (let y = 0; y < LCD_H; y++) {
      for (let x = 0; x < LCD_W; x++) {
        if (fb[y * LCD_W + x]) {
          ctx.fillRect(x * SCALE + 1, y * SCALE + 1, SCALE - 1, SCALE - 1);
        }
      }
    }

    ctx.fillStyle = inkColor;
    for (let y = 0; y < LCD_H; y++) {
      for (let x = 0; x < LCD_W; x++) {
        if (fb[y * LCD_W + x]) {
          ctx.fillRect(x * SCALE, y * SCALE, SCALE - 1, SCALE - 1);
        }
      }
    }
  }

  // =========================================================================
  // 2. AUTHENTIC NOKIA PIEZO BUZZER AUDIO (Web Audio API)
  // =========================================================================
  let audioCtx = null;

  function ensureAudio() {
    if (!soundOn) return null;
    if (!audioCtx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) audioCtx = new AudioCtor();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq, durationMs, delayMs = 0, volume = 0.08) {
    const ctxA = ensureAudio();
    if (!ctxA) return;
    const start = ctxA.currentTime + delayMs / 1000;
    const end = start + durationMs / 1000;
    const osc = ctxA.createOscillator();
    const gain = ctxA.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(ctxA.destination);
    osc.start(start);
    osc.stop(end + 0.01);
  }

  const SFX = {
    key() {
      playTone(1350, 22, 0, 0.04);
    },
    eat() {
      playTone(880, 40, 0, 0.075);
      playTone(1320, 55, 42, 0.075);
    },
    speedUp() {
      playTone(1174, 40, 0, 0.065);
      playTone(1568, 45, 45, 0.065);
      playTone(1975, 60, 95, 0.065);
    },
    bonusSpawn() {
      playTone(1046, 35, 0, 0.06);
      playTone(1568, 45, 45, 0.06);
    },
    bonusEat() {
      playTone(1046, 45, 0, 0.08);
      playTone(1318, 45, 48, 0.08);
      playTone(1568, 55, 96, 0.08);
      playTone(2093, 90, 152, 0.08);
    },
    crash() {
      playTone(340, 90, 0, 0.09);
      playTone(255, 110, 95, 0.09);
      playTone(170, 220, 210, 0.09);
    },
    highScore() {
      playTone(1318, 70, 0, 0.07);
      playTone(1174, 70, 75, 0.07);
      playTone(740, 120, 150, 0.07);
      playTone(830, 120, 275, 0.07);
      playTone(1108, 70, 400, 0.07);
      playTone(987, 70, 475, 0.07);
      playTone(1318, 160, 550, 0.07);
    },
  };

  // =========================================================================
  // 3. SNAKE II MAZES, PROGRESSIVE SPEED & SPRITES
  // =========================================================================
  const GRID_W = 20;
  const GRID_H = 10;
  const PLAY_OX = 2;
  const PLAY_OY = 7;

  const START_SPEED = 1;
  const APPLES_PER_SPEED_UP = 4;

  function stepMsForSpeed(spd) {
    // Smooth progressive speed ramp: starts brisk at 175ms, approaches 52ms at high speeds
    return Math.max(52, Math.round(175 * Math.pow(0.91, spd - 1)));
  }

  function buildMazes() {
    const noMaze = {
      name: 'No maze',
      hint: 'Wrap-around edges',
      solidBorder: false,
      walls: [],
      spawn: { x: 8, y: 5, dx: 1, dy: 0 },
    };

    const box = {
      name: 'Box',
      hint: 'Solid outer walls',
      solidBorder: true,
      walls: [],
      spawn: { x: 8, y: 5, dx: 1, dy: 0 },
    };

    const tunnelWalls = [];
    for (const x of [0, 1, 2, 17, 18, 19]) tunnelWalls.push([x, 0], [x, 9]);
    for (const y of [1, 8]) tunnelWalls.push([0, y], [19, y]);
    for (let x = 6; x <= 13; x++) tunnelWalls.push([x, 3], [x, 6]);
    const tunnel = {
      name: 'Tunnel',
      hint: 'Center corridor',
      solidBorder: false,
      walls: tunnelWalls,
      spawn: { x: 8, y: 5, dx: 1, dy: 0 },
    };

    const millWalls = [];
    for (let x = 2; x <= 8; x++) millWalls.push([x, 2]);
    for (let x = 11; x <= 17; x++) millWalls.push([x, 7]);
    for (let y = 1; y <= 5; y++) millWalls.push([15, y]);
    for (let y = 4; y <= 8; y++) millWalls.push([4, y]);
    const mill = {
      name: 'Mill',
      hint: 'Four-blade barriers',
      solidBorder: false,
      walls: millWalls,
      spawn: { x: 10, y: 4, dx: 1, dy: 0 },
    };

    const railsWalls = [];
    for (let x = 0; x < 20; x++) railsWalls.push([x, 0], [x, 9]);
    for (let x = 4; x <= 15; x++) railsWalls.push([x, 3], [x, 6]);
    const rails = {
      name: 'Rails',
      hint: 'Parallel tracks',
      solidBorder: false,
      walls: railsWalls,
      spawn: { x: 8, y: 5, dx: 1, dy: 0 },
    };

    const aptWalls = [];
    for (let x = 0; x < 20; x++) {
      if (x !== 9 && x !== 10) aptWalls.push([x, 0], [x, 9]);
    }
    for (let y = 1; y < 9; y++) {
      if (y !== 4 && y !== 5) aptWalls.push([0, y], [19, y]);
    }
    for (let y = 1; y <= 3; y++) aptWalls.push([10, y]);
    for (let y = 6; y <= 8; y++) aptWalls.push([10, y]);
    const apartment = {
      name: 'Apartment',
      hint: 'Chambers & doors',
      solidBorder: false,
      walls: aptWalls,
      spawn: { x: 7, y: 5, dx: 1, dy: 0 },
    };

    return [noMaze, box, tunnel, mill, rails, apartment];
  }

  const MAZES = buildMazes();

  const CRITTERS = [
    ['01011010', '00111100', '11111111', '01011010'],
    ['01000010', '11111111', '01111110', '10100101'],
    ['10111101', '01111110', '10111101', '01000010'],
    ['00110010', '01111111', '10111110', '00100100'],
    ['10011100', '11111110', '11111011', '10011100'],
  ];

  const BONUS_ICON = ['01010', '01110', '11111', '01110', '10101'];
  const FOOD_SPRITE = ['0100', '1010', '0100', '0000'];
  const WALL_SPRITE = ['1111', '1011', '1110', '1111'];

  // =========================================================================
  // 4. GAME STATE
  // =========================================================================
  const STORAGE_KEY = 'nokia3310_snake2_online_best_v1';
  let topScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;

  let screen = 'SPLASH'; // SPLASH | MENU | MAZE | TOP_SCORE | PLAYING | DYING | GAME_OVER
  let splashTimer = 0;

  let currentSpeed = START_SPEED;
  let mazeIdx = 0;
  let menuIndex = 0;
  let hasActiveGame = false;

  let snake = [];
  let dir = { dx: 1, dy: 0 };
  let dirQueue = [];
  let food = null;
  let bonus = null;
  let foodsEaten = 0;
  let score = 0;
  let isNewRecord = false;
  let wallSet = new Set();

  let graceActive = false;
  let dyingFlashCount = 0;
  let dyingTimer = 0;
  let stepAccumulator = 0;
  let activePlayMs = 0;
  let lastFrameTime = performance.now();

  let callbacks = {
    onGameStart: null,
    onGameOver: null,
  };

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function rebuildWallSet() {
    wallSet = new Set();
    for (const [wx, wy] of MAZES[mazeIdx].walls) {
      wallSet.add(keyOf(wx, wy));
    }
  }

  // Progressive speed only — no Level menu item
  function getMenuItems() {
    const items = [];
    if (hasActiveGame) items.push({ id: 'continue', label: 'Continue' });
    items.push(
      { id: 'new', label: 'New game' },
      { id: 'maze', label: 'Mazes' },
      { id: 'top', label: 'Top score' }
    );
    return items;
  }

  function startNewGame() {
    rebuildWallSet();
    const m = MAZES[mazeIdx];
    const { x, y, dx, dy } = m.spawn;
    snake = [];
    for (let i = 0; i < 5; i++) {
      snake.push({
        x: (x - dx * i + GRID_W) % GRID_W,
        y: (y - dy * i + GRID_H) % GRID_H,
        bulge: false,
      });
    }
    dir = { dx, dy };
    dirQueue = [];
    score = 0;
    foodsEaten = 0;
    currentSpeed = START_SPEED;
    bonus = null;
    graceActive = false;
    isNewRecord = false;
    hasActiveGame = true;
    stepAccumulator = 0;
    activePlayMs = 0;
    spawnFood();
    screen = 'PLAYING';
    syncSideUI();
    if (typeof callbacks.onGameStart === 'function') {
      callbacks.onGameStart({ maze: mazeIdx, startSpeed: START_SPEED });
    }
  }

  function isCellBlocked(x, y, ignoreTail = false) {
    if (wallSet.has(keyOf(x, y))) return true;
    const limit = ignoreTail ? snake.length - 1 : snake.length;
    for (let i = 0; i < limit; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    if (bonus && ((bonus.x === x && bonus.y === y) || (bonus.x + 1 === x && bonus.y === y))) {
      return true;
    }
    return false;
  }

  function spawnFood() {
    const free = [];
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (!isCellBlocked(x, y)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      food = null;
      return;
    }
    food = free[Math.floor(Math.random() * free.length)];
  }

  function spawnBonus() {
    const freePairs = [];
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W - 1; x++) {
        const f1 = food && food.x === x && food.y === y;
        const f2 = food && food.x === x + 1 && food.y === y;
        if (!f1 && !f2 && !isCellBlocked(x, y) && !isCellBlocked(x + 1, y)) {
          freePairs.push({ x, y });
        }
      }
    }
    if (freePairs.length === 0) return;
    const pick = freePairs[Math.floor(Math.random() * freePairs.length)];
    bonus = {
      x: pick.x,
      y: pick.y,
      ticksLeft: 20 + Math.floor(currentSpeed / 3) * 2,
      critterIdx: Math.floor(Math.random() * CRITTERS.length),
    };
    SFX.bonusSpawn();
  }

  function queueDirection(ndx, ndy) {
    if (graceActive) {
      if (dir.dx === -ndx && dir.dy === -ndy) return;
      dirQueue = [{ dx: ndx, dy: ndy }];
      return;
    }
    const ref = dirQueue.length > 0 ? dirQueue[dirQueue.length - 1] : dir;
    if (ref.dx === ndx && ref.dy === ndy) return;
    if (ref.dx === -ndx && ref.dy === -ndy) return;
    if (dirQueue.length < 2) {
      dirQueue.push({ dx: ndx, dy: ndy });
    } else {
      dirQueue[1] = { dx: ndx, dy: ndy };
    }
  }

  function computeNextHead(curDir) {
    let nx = snake[0].x + curDir.dx;
    let ny = snake[0].y + curDir.dy;
    const solidBorder = MAZES[mazeIdx].solidBorder;

    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) {
      if (solidBorder) return null;
      nx = (nx + GRID_W) % GRID_W;
      ny = (ny + GRID_H) % GRID_H;
    }
    return { x: nx, y: ny };
  }

  function stepGame() {
    const candidateDir = dirQueue.length > 0 ? dirQueue[0] : dir;
    const nextPos = computeNextHead(candidateDir);

    const hitsWall = !nextPos || wallSet.has(keyOf(nextPos.x, nextPos.y));
    let hitsSelf = false;
    if (nextPos) {
      for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i].x === nextPos.x && snake[i].y === nextPos.y) {
          hitsSelf = true;
          break;
        }
      }
    }

    if (hitsWall || hitsSelf) {
      if (!graceActive) {
        graceActive = true;
        return;
      }
      triggerGameOver();
      return;
    }

    if (dirQueue.length > 0) {
      dir = dirQueue.shift();
    }
    graceActive = false;

    const ateFood = food && nextPos.x === food.x && nextPos.y === food.y;
    const ateBonus = bonus && (
      (nextPos.x === bonus.x && nextPos.y === bonus.y) ||
      (nextPos.x === bonus.x + 1 && nextPos.y === bonus.y)
    );

    snake.unshift({ x: nextPos.x, y: nextPos.y, bulge: ateFood || ateBonus });

    if (!ateFood) {
      snake.pop();
    }

    if (ateFood) {
      score += currentSpeed;
      foodsEaten += 1;
      const nextSpeed = START_SPEED + Math.floor(foodsEaten / APPLES_PER_SPEED_UP);
      if (nextSpeed > currentSpeed) {
        currentSpeed = nextSpeed;
        SFX.speedUp();
        syncSideUI();
      } else {
        SFX.eat();
      }
      spawnFood();
      if (foodsEaten % 5 === 0 && !bonus) {
        spawnBonus();
      }
    }

    if (ateBonus) {
      const bonusPts = bonus.ticksLeft * Math.ceil(currentSpeed / 2) + currentSpeed * 2;
      score += bonusPts;
      bonus = null;
      SFX.bonusEat();
    }

    if (bonus) {
      bonus.ticksLeft -= 1;
      if (bonus.ticksLeft <= 0) {
        bonus = null;
      }
    }

    if (score > topScore) {
      topScore = score;
      isNewRecord = true;
      localStorage.setItem(STORAGE_KEY, String(topScore));
      syncSideUI();
    }
  }

  function triggerGameOver() {
    hasActiveGame = false;
    screen = 'DYING';
    dyingFlashCount = 0;
    dyingTimer = 0;
    SFX.crash();
    syncSideUI();

    if (typeof callbacks.onGameOver === 'function') {
      callbacks.onGameOver({
        score,
        foods: foodsEaten,
        length: snake.length,
        topSpeed: currentSpeed,
        maze: mazeIdx,
        durationMs: Math.max(300, Math.round(activePlayMs)),
      });
    }
  }

  // =========================================================================
  // 5. AUTHENTIC NOKIA SNAKE II RENDERING
  // =========================================================================
  function wrappedDelta(from, to, max) {
    let d = to - from;
    if (d > 1) d -= max;
    if (d < -1) d += max;
    return d;
  }

  function isMouthOpen() {
    const nextPos = computeNextHead(dir);
    if (!nextPos) return false;
    if (food && nextPos.x === food.x && nextPos.y === food.y) return true;
    if (bonus && (
      (nextPos.x === bonus.x && nextPos.y === bonus.y) ||
      (nextPos.x === bonus.x + 1 && nextPos.y === bonus.y)
    )) return true;
    return false;
  }

  function drawSnakeHead(cx, cy, dx, dy, open) {
    const px = PLAY_OX + cx * 4;
    const py = PLAY_OY + cy * 4;
    let spr;
    if (!open) {
      if (dx === 1) spr = ['0100', '1111', '1111', '0000'];
      else if (dx === -1) spr = ['0010', '1111', '1111', '0000'];
      else if (dy === -1) spr = ['0110', '0110', '1110', '0110'];
      else spr = ['0110', '1110', '0110', '0110'];
    } else {
      if (dx === 1) spr = ['0111', '1100', '1100', '0111'];
      else if (dx === -1) spr = ['1110', '0011', '0011', '1110'];
      else if (dy === -1) spr = ['1001', '1001', '1110', '0110'];
      else spr = ['0110', '1110', '1001', '1001'];
    }
    drawSprite(spr, px, py, 1);
  }

  function drawSnakeTail(cx, cy, toPrevDx, toPrevDy) {
    const px = PLAY_OX + cx * 4;
    const py = PLAY_OY + cy * 4;
    let spr;
    if (toPrevDx === 1) spr = ['0000', '0011', '0111', '0000'];
    else if (toPrevDx === -1) spr = ['0000', '1100', '1110', '0000'];
    else if (toPrevDy === 1) spr = ['0000', '0100', '0110', '0110'];
    else spr = ['0110', '0110', '0010', '0000'];
    drawSprite(spr, px, py, 1);
  }

  function drawSnakeBody(seg, prev, next, index) {
    const px = PLAY_OX + seg.x * 4;
    const py = PLAY_OY + seg.y * 4;

    if (seg.bulge) {
      drawSprite(['0110', '1111', '1111', '0110'], px, py, 1);
      return;
    }

    const dx1 = wrappedDelta(seg.x, prev.x, GRID_W);
    const dy1 = wrappedDelta(seg.y, prev.y, GRID_H);
    const dx2 = wrappedDelta(seg.x, next.x, GRID_W);
    const dy2 = wrappedDelta(seg.y, next.y, GRID_H);

    if (dy1 === 0 && dy2 === 0) {
      const spr = index % 2 === 0
        ? ['0000', '1101', '1011', '0000']
        : ['0000', '1011', '1101', '0000'];
      drawSprite(spr, px, py, 1);
      return;
    }

    if (dx1 === 0 && dx2 === 0) {
      const spr = index % 2 === 0
        ? ['0110', '0100', '0010', '0110']
        : ['0110', '0010', '0100', '0110'];
      drawSprite(spr, px, py, 1);
      return;
    }

    const hasL = dx1 === -1 || dx2 === -1;
    const hasR = dx1 === 1 || dx2 === 1;
    const hasU = dy1 === -1 || dy2 === -1;
    const hasD = dy1 === 1 || dy2 === 1;

    setPx(px + 1, py + 1, 1);
    setPx(px + 2, py + 1, 1);
    setPx(px + 1, py + 2, 1);
    setPx(px + 2, py + 2, 1);

    if (hasL) { setPx(px, py + 1, 1); setPx(px, py + 2, 1); }
    if (hasR) { setPx(px + 3, py + 1, 1); setPx(px + 3, py + 2, 1); }
    if (hasU) { setPx(px + 1, py, 1); setPx(px + 2, py, 1); }
    if (hasD) { setPx(px + 1, py + 3, 1); setPx(px + 2, py + 3, 1); }

    if (hasL && hasU) setPx(px + 2, py + 2, 0);
    if (hasR && hasU) setPx(px + 1, py + 2, 0);
    if (hasL && hasD) setPx(px + 2, py + 1, 0);
    if (hasR && hasD) setPx(px + 1, py + 1, 0);
  }

  function renderPlayfield(showSnake = true) {
    // Top-left: 4-digit score
    const scoreStr = String(score).padStart(4, '0');
    drawText(scoreStr, 2, 0, 1, FONT_3X5);

    // Top-center: live progressive speed readout
    drawTextCentered(`SPD ${currentSpeed}`, 0, 1, FONT_3X5);

    // Top-right: bonus critter icon + countdown timer
    if (bonus) {
      drawSprite(BONUS_ICON, 63, 0, 1);
      drawText(String(bonus.ticksLeft).padStart(2, '0'), 71, 0, 1, FONT_3X5);
    }

    // Arena outer border
    if (MAZES[mazeIdx].solidBorder) {
      drawRect(1, 6, 82, 42, false, 1);
      drawVLine(0, 6, 42, 1);
      drawVLine(83, 6, 42, 1);
      drawHLine(0, 5, 84, 1);
    } else {
      for (let x = 1; x <= 82; x += 2) {
        setPx(x, 6, 1);
        setPx(x, 47, 1);
      }
      for (let y = 6; y <= 47; y += 2) {
        setPx(1, y, 1);
        setPx(82, y, 1);
      }
    }

    for (const [wx, wy] of MAZES[mazeIdx].walls) {
      drawSprite(WALL_SPRITE, PLAY_OX + wx * 4, PLAY_OY + wy * 4, 1);
    }

    if (food) {
      drawSprite(FOOD_SPRITE, PLAY_OX + food.x * 4, PLAY_OY + food.y * 4, 1);
    }

    if (bonus) {
      drawSprite(CRITTERS[bonus.critterIdx], PLAY_OX + bonus.x * 4, PLAY_OY + bonus.y * 4, 1);
    }

    if (showSnake && snake.length > 0) {
      drawSnakeHead(snake[0].x, snake[0].y, dir.dx, dir.dy, isMouthOpen());
      for (let i = 1; i < snake.length - 1; i++) {
        drawSnakeBody(snake[i], snake[i - 1], snake[i + 1], i);
      }
      if (snake.length > 1) {
        const tail = snake[snake.length - 1];
        const beforeTail = snake[snake.length - 2];
        const tdx = wrappedDelta(tail.x, beforeTail.x, GRID_W);
        const tdy = wrappedDelta(tail.y, beforeTail.y, GRID_H);
        drawSnakeTail(tail.x, tail.y, tdx, tdy);
      }
    }
  }

  function renderSplash() {
    drawHLine(16, 6, 52, 1);
    drawHLine(16, 7, 52, 1);
    drawSprite([
      '00111111100000000000',
      '01100000110000111100',
      '01100000011111100110',
      '00111100000000000011',
      '00000111111111111110',
    ], 32, 10, 1);

    drawTextCentered('SNAKE II', 20, 1, FONT_5X7);
    drawHLine(16, 30, 52, 1);
    drawTextCentered('NOKIA 3310', 34, 1, FONT_3X5);

    if (Math.floor(splashTimer / 450) % 2 === 0) {
      drawTextCentered('SELECT', 42, 1, FONT_3X5);
    }
  }

  function renderMenu() {
    const items = getMenuItems();
    if (menuIndex >= items.length) menuIndex = items.length - 1;

    drawTextCentered('SNAKE II', 1, 1, FONT_3X5);
    drawHLine(2, 7, 80, 1);

    const visibleCount = 4;
    let start = 0;
    if (menuIndex >= visibleCount) {
      start = menuIndex - visibleCount + 1;
    }

    for (let i = 0; i < visibleCount; i++) {
      const idx = start + i;
      if (idx >= items.length) break;
      const y = 10 + i * 8;
      const selected = idx === menuIndex;
      if (selected) {
        drawRect(2, y - 1, 76, 7, true, 1);
        drawText(items[idx].label, 5, y, 0, FONT_3X5);
      } else {
        drawText(items[idx].label, 5, y, 1, FONT_3X5);
      }
    }

    drawVLine(81, 9, 31, 1);
    const knobH = Math.max(5, Math.floor(31 / items.length));
    const knobY = 9 + Math.floor((menuIndex / Math.max(1, items.length - 1)) * (31 - knobH));
    drawRect(80, knobY, 3, knobH, true, 1);

    drawTextCentered('Select', 42, 1, FONT_3X5);
  }

  function renderMazeSelect() {
    drawTextCentered('MAZES', 1, 1, FONT_3X5);
    drawHLine(2, 7, 80, 1);

    const m = MAZES[mazeIdx];
    drawTextCentered(m.name, 10, 1, FONT_3X5);

    const px = 22;
    const py = 17;
    drawRect(px - 1, py - 1, 42, 22, false, 1);
    if (m.solidBorder) {
      drawRect(px - 2, py - 2, 44, 24, false, 1);
    }
    for (const [wx, wy] of m.walls) {
      drawRect(px + wx * 2, py + wy * 2, 2, 2, true, 1);
    }

    drawText('<', 11, 25, 1, FONT_3X5);
    drawText('>', 69, 25, 1, FONT_3X5);
    drawTextCentered('OK', 42, 1, FONT_3X5);
  }

  function renderTopScore() {
    drawTextCentered('TOP SCORE', 2, 1, FONT_3X5);
    drawHLine(4, 9, 76, 1);
    drawTextCentered(String(topScore), 19, 1, FONT_5X7);
    drawTextCentered('SNAKE II', 31, 1, FONT_3X5);
    drawTextCentered('Back', 42, 1, FONT_3X5);
  }

  function renderGameOver() {
    drawRect(2, 2, 80, 37, false, 1);
    drawTextCentered('GAME OVER', 6, 1, FONT_5X7);
    drawHLine(6, 15, 72, 1);

    drawTextCentered(`SCORE: ${score}`, 19, 1, FONT_3X5);

    if (isNewRecord && score > 0) {
      drawRect(8, 27, 68, 9, true, 1);
      drawTextCentered('NEW TOP SCORE!', 29, 0, FONT_3X5);
    } else {
      drawTextCentered(`BEST:  ${topScore}`, 29, 1, FONT_3X5);
    }

    drawTextCentered('Again', 42, 1, FONT_3X5);
  }

  function render() {
    clearFB();
    switch (screen) {
      case 'SPLASH': renderSplash(); break;
      case 'MENU': renderMenu(); break;
      case 'MAZE': renderMazeSelect(); break;
      case 'TOP_SCORE': renderTopScore(); break;
      case 'PLAYING': renderPlayfield(true); break;
      case 'DYING': renderPlayfield(dyingFlashCount % 2 === 1); break;
      case 'GAME_OVER': renderGameOver(); break;
    }
    flushLCD();
  }

  // =========================================================================
  // 6. MAIN LOOP
  // =========================================================================
  function loop(now) {
    const dt = Math.min(100, now - lastFrameTime);
    lastFrameTime = now;

    if (screen === 'SPLASH') {
      splashTimer += dt;
    } else if (screen === 'PLAYING') {
      activePlayMs += dt;
      stepAccumulator += dt;
      const stepMs = stepMsForSpeed(currentSpeed);
      while (stepAccumulator >= stepMs && screen === 'PLAYING') {
        stepAccumulator -= stepMs;
        stepGame();
      }
    } else if (screen === 'DYING') {
      dyingTimer += dt;
      if (dyingTimer >= 165) {
        dyingTimer = 0;
        dyingFlashCount += 1;
        if (dyingFlashCount >= 6) {
          screen = 'GAME_OVER';
          if (isNewRecord && score > 0) SFX.highScore();
        }
      }
    }

    render();
    requestAnimationFrame(loop);
  }

  // =========================================================================
  // 7. INPUT HANDLING
  // =========================================================================
  function handleAction(action) {
    if (action === 'LIGHT') {
      toggleBacklight();
      SFX.key();
      return;
    }
    if (action === 'SOUND') {
      toggleSound();
      if (soundOn) SFX.key();
      return;
    }

    if (screen === 'SPLASH') {
      SFX.key();
      screen = 'MENU';
      menuIndex = 0;
      return;
    }

    if (screen === 'PLAYING') {
      if (action === 'UP') queueDirection(0, -1);
      else if (action === 'DOWN') queueDirection(0, 1);
      else if (action === 'LEFT') queueDirection(-1, 0);
      else if (action === 'RIGHT') queueDirection(1, 0);
      else if (action === 'SELECT' || action === 'BACK') {
        SFX.key();
        screen = 'MENU';
        menuIndex = 0;
      }
      return;
    }

    if (screen === 'DYING') return;

    if (screen === 'GAME_OVER') {
      if (action === 'SELECT') {
        SFX.key();
        startNewGame();
      } else if (action === 'BACK') {
        SFX.key();
        screen = 'MENU';
        menuIndex = 0;
      }
      return;
    }

    if (screen === 'MENU') {
      const items = getMenuItems();
      if (action === 'UP') {
        SFX.key();
        menuIndex = (menuIndex - 1 + items.length) % items.length;
      } else if (action === 'DOWN') {
        SFX.key();
        menuIndex = (menuIndex + 1) % items.length;
      } else if (action === 'SELECT') {
        SFX.key();
        const chosen = items[menuIndex].id;
        if (chosen === 'continue') {
          screen = 'PLAYING';
          stepAccumulator = 0;
        } else if (chosen === 'new') {
          startNewGame();
        } else if (chosen === 'maze') {
          screen = 'MAZE';
        } else if (chosen === 'top') {
          screen = 'TOP_SCORE';
        }
      } else if (action === 'BACK' && hasActiveGame) {
        SFX.key();
        screen = 'PLAYING';
        stepAccumulator = 0;
      }
      return;
    }

    if (screen === 'MAZE') {
      if (action === 'UP' || action === 'LEFT') {
        SFX.key();
        mazeIdx = (mazeIdx - 1 + MAZES.length) % MAZES.length;
        syncSideUI();
      } else if (action === 'DOWN' || action === 'RIGHT') {
        SFX.key();
        mazeIdx = (mazeIdx + 1) % MAZES.length;
        syncSideUI();
      } else if (action === 'SELECT' || action === 'BACK') {
        SFX.key();
        screen = 'MENU';
      }
      return;
    }

    if (screen === 'TOP_SCORE') {
      if (action === 'SELECT' || action === 'BACK') {
        SFX.key();
        screen = 'MENU';
      }
    }
  }

  function pulseButton(el) {
    if (!el) return;
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 110);
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  window.addEventListener('keydown', (e) => {
    if (!isViewActive || isTypingTarget(e.target)) return;
    const k = e.key;
    const gameKeys = [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      ' ', 'Enter', 'Escape', 'Backspace',
      'w', 'W', 'a', 'A', 's', 'S', 'd', 'D',
      '2', '4', '5', '6', '8', 'c', 'C', 'b', 'B', 'm', 'M', '*', '#',
    ];
    if (!gameKeys.includes(k)) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === '2') {
      pulseButton(document.querySelector('[data-key="2"]'));
      handleAction('UP');
    } else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === '8') {
      pulseButton(document.querySelector('[data-key="8"]'));
      handleAction('DOWN');
    } else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === '4') {
      pulseButton(document.querySelector('[data-key="4"]'));
      handleAction('LEFT');
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === '6') {
      pulseButton(document.querySelector('[data-key="6"]'));
      handleAction('RIGHT');
    } else if (k === 'Enter' || k === ' ' || k === '5') {
      pulseButton(document.getElementById('btnNavi'));
      handleAction('SELECT');
    } else if (k === 'Escape' || k === 'Backspace' || k === 'c' || k === 'C') {
      pulseButton(document.getElementById('btnC'));
      handleAction('BACK');
    } else if (k === 'b' || k === 'B' || k === '*') {
      pulseButton(document.querySelector('[data-key="*"]'));
      handleAction('LIGHT');
    } else if (k === 'm' || k === 'M' || k === '#') {
      pulseButton(document.querySelector('[data-key="#"]'));
      handleAction('SOUND');
    }
  });

  // Phone Hardware Buttons
  document.getElementById('btnNavi').addEventListener('click', (e) => { e.currentTarget.blur(); handleAction('SELECT'); });
  document.getElementById('btnC').addEventListener('click', (e) => { e.currentTarget.blur(); handleAction('BACK'); });
  document.getElementById('btnUp').addEventListener('click', (e) => { e.currentTarget.blur(); handleAction('UP'); });
  document.getElementById('btnDown').addEventListener('click', (e) => { e.currentTarget.blur(); handleAction('DOWN'); });

  document.querySelectorAll('.num-key').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.currentTarget.blur();
      const key = btn.dataset.key;
      if (key === '2') handleAction('UP');
      else if (key === '8') handleAction('DOWN');
      else if (key === '4') handleAction('LEFT');
      else if (key === '6') handleAction('RIGHT');
      else if (key === '5') handleAction('SELECT');
      else if (key === '*') handleAction('LIGHT');
      else if (key === '#') handleAction('SOUND');
      else SFX.key();
    });
  });

  // Touch / Swipe directly on the LCD
  let pointerStart = null;
  canvas.addEventListener('pointerdown', (e) => {
    pointerStart = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!pointerStart) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.hypot(dx, dy) < 16) {
      handleAction('SELECT');
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      handleAction(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      handleAction(dy > 0 ? 'DOWN' : 'UP');
    }
  });

  // =========================================================================
  // 8. COMPANION CONTROLS UI SYNC
  // =========================================================================
  const topScoreBadge = document.getElementById('topScoreBadge');
  const backlightBtn = document.getElementById('backlightBtn');
  const soundBtn = document.getElementById('soundBtn');
  const liveSpeedBadge = document.getElementById('liveSpeedBadge');
  const mazeHint = document.getElementById('mazeHint');
  const mazeButtonsWrap = document.getElementById('mazeButtons');
  const phoneShell = document.getElementById('phoneShell');

  function toggleBacklight() {
    backlightOn = !backlightOn;
    lcdGlass.classList.toggle('backlight-on', backlightOn);
    backlightBtn.textContent = `Backlight: ${backlightOn ? 'On' : 'Off'}`;
  }

  function toggleSound() {
    soundOn = !soundOn;
    soundBtn.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
  }

  function buildMazeButtons() {
    mazeButtonsWrap.innerHTML = '';
    MAZES.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = m.name;
      btn.dataset.mazeIdx = String(idx);
      btn.className = 'maze-btn';
      btn.addEventListener('click', (e) => {
        e.currentTarget.blur();
        mazeIdx = idx;
        SFX.key();
        if (screen === 'PLAYING' || screen === 'GAME_OVER') {
          startNewGame();
        } else {
          syncSideUI();
        }
      });
      mazeButtonsWrap.appendChild(btn);
    });
  }

  function syncSideUI() {
    topScoreBadge.textContent = String(topScore).padStart(4, '0');
    liveSpeedBadge.textContent = `Speed ${currentSpeed}`;
    mazeHint.textContent = MAZES[mazeIdx].hint;

    mazeButtonsWrap.querySelectorAll('.maze-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.mazeIdx) === mazeIdx);
    });
  }

  document.getElementById('quickPlayBtn').addEventListener('click', (e) => {
    e.currentTarget.blur();
    SFX.key();
    startNewGame();
  });

  backlightBtn.addEventListener('click', (e) => {
    e.currentTarget.blur();
    toggleBacklight();
    SFX.key();
  });

  soundBtn.addEventListener('click', (e) => {
    e.currentTarget.blur();
    toggleSound();
    if (soundOn) SFX.key();
  });

  document.querySelectorAll('[data-set-cover]').forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.currentTarget.blur();
      phoneShell.dataset.cover = dot.dataset.setCover;
      document.querySelectorAll('[data-set-cover]').forEach((d) => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  buildMazeButtons();
  syncSideUI();
  requestAnimationFrame(loop);

  window.NokiaSnakeGame = {
    MAZES,
    START_SPEED,
    APPLES_PER_SPEED_UP,
    setCallbacks(next) {
      callbacks = { ...callbacks, ...next };
    },
    setViewActive(active) {
      isViewActive = Boolean(active);
      if (!isViewActive && screen === 'PLAYING') {
        screen = 'MENU';
        menuIndex = 0;
      }
    },
    startNewGame,
  };
})();
