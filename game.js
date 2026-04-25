const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreText = document.querySelector("#scoreText");
const cleanText = document.querySelector("#cleanText");
const bestText = document.querySelector("#bestText");
const menuBestText = document.querySelector("#menuBestText");
const finalScoreText = document.querySelector("#finalScoreText");
const menuOverlay = document.querySelector("#menuOverlay");
const pauseOverlay = document.querySelector("#pauseOverlay");
const gameOverOverlay = document.querySelector("#gameOverOverlay");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const resumeButton = document.querySelector("#resumeButton");
const soundButton = document.querySelector("#soundButton");
const soundIcon = document.querySelector("#soundIcon");
const pauseButton = document.querySelector("#pauseButton");
const leftButton = document.querySelector("#leftButton");
const rightButton = document.querySelector("#rightButton");

const WIDTH = 712;
const HEIGHT = 400;
const FISH_Y = 318;
const lanes = [274, 356, 438];
const laneEdges = [233, 315, 397, 479];
const oilPalette = ["#111016", "#181923", "#251d31", "#43345e", "#090a0e", "#725d92"];
const bestKey = "praia-no-pote-best";

let state = createInitialState();
let lastTime = performance.now();

function createInitialState() {
  return {
    mode: "menu",
    lane: 1,
    targetLane: 1,
    fishX: lanes[1],
    score: 0,
    best: Number(localStorage.getItem(bestKey) || 0),
    lives: 3,
    speed: 170,
    spawnTimer: 0.55,
    waveScroll: 0,
    deepScroll: 0,
    fishBob: 0,
    invulnerable: 0,
    shake: 0,
    obstacles: [],
    bubbles: [],
    splashes: [],
    glints: [],
    oilId: 0
  };
}

class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicTimer = null;
    this.step = 0;
    this.track = "menu";
    this.muted = false;
    this.noise = null;
    this.waveGain = null;
  }

  async init() {
    if (this.context) {
      await this.context.resume();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.72;
    this.master.connect(this.context.destination);
    this.startWaves();
    this.playTrack("menu");
  }

  startWaves() {
    const bufferSize = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 680;
    gain.gain.value = 0.04;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();

    this.noise = source;
    this.waveGain = gain;
  }

  playTrack(track) {
    this.track = track;
    this.step = 0;

    if (!this.context) return;

    window.clearInterval(this.musicTimer);
    const pace = track === "game" ? 150 : track === "over" ? 270 : 230;
    this.musicTimer = window.setInterval(() => this.tick(), pace);
    this.tick();
  }

  tick() {
    if (!this.context || this.muted) return;

    const t = this.context.currentTime;

    if (this.track === "game") {
      const melody = [659, 740, 880, 740, 659, 587, 523, 587, 659, 784, 988, 880, 784, 659, 587, 523];
      const bass = [196, 196, 247, 247, 220, 220, 262, 262];
      const note = melody[this.step % melody.length];
      this.note(note, t, 0.09, "square", 0.045);

      if (this.step % 4 === 0) {
        this.note(bass[(this.step / 4) % bass.length], t, 0.18, "triangle", 0.08);
      }

      if (state.lives === 1 && this.step % 6 === 0) {
        this.note(110, t, 0.12, "sawtooth", 0.035);
      }
    }

    if (this.track === "menu") {
      const melody = [392, 494, 523, 659, 523, 494, 440, 330];
      const note = melody[this.step % melody.length];
      this.note(note, t, 0.2, "triangle", 0.055);

      if (this.step % 4 === 0) {
        this.note(note / 2, t, 0.34, "sine", 0.06);
      }
    }

    if (this.track === "over") {
      const notes = [392, 349, 311, 247, 196, 0, 196, 0];
      const note = notes[this.step % notes.length];
      if (note) this.note(note, t, 0.28, "triangle", 0.07);
    }

    this.step += 1;
  }

  note(freq, start, duration, type, volume) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  blip(kind) {
    if (!this.context || this.muted) return;

    const t = this.context.currentTime;
    if (kind === "move") this.note(620 + state.targetLane * 70, t, 0.045, "square", 0.035);
    if (kind === "hit") {
      this.note(92, t, 0.16, "sawtooth", 0.11);
      this.note(70, t + 0.04, 0.18, "sawtooth", 0.08);
    }
    if (kind === "start") {
      this.note(523, t, 0.09, "triangle", 0.07);
      this.note(784, t + 0.08, 0.12, "triangle", 0.07);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.72;
  }
}

const audio = new AudioEngine();

function setOverlay(overlay, visible) {
  overlay.classList.toggle("is-visible", visible);
}

function updateHud() {
  const paddedScore = String(Math.floor(state.score)).padStart(4, "0");
  const paddedBest = String(Math.floor(state.best)).padStart(4, "0");
  scoreText.textContent = paddedScore;
  bestText.textContent = paddedBest;
  menuBestText.textContent = paddedBest;
  cleanText.textContent = "◆ ".repeat(Math.max(0, state.lives)).trim() || "0";
}

function resetGame() {
  const best = state.best;
  state = createInitialState();
  state.mode = "playing";
  state.best = best;
  updateHud();
  setOverlay(menuOverlay, false);
  setOverlay(pauseOverlay, false);
  setOverlay(gameOverOverlay, false);
  pauseButton.classList.add("is-active");
  pauseButton.querySelector("span").textContent = "Ⅱ";
}

async function startGame() {
  await audio.init();
  audio.blip("start");
  audio.playTrack("game");
  resetGame();
}

function endGame() {
  state.mode = "over";
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem(bestKey, String(state.best));
  finalScoreText.textContent = String(Math.floor(state.score)).padStart(4, "0");
  updateHud();
  audio.playTrack("over");
  setOverlay(gameOverOverlay, true);
  pauseButton.classList.remove("is-active");
}

function togglePause() {
  if (state.mode === "playing") {
    state.mode = "paused";
    audio.playTrack("menu");
    setOverlay(pauseOverlay, true);
    pauseButton.querySelector("span").textContent = "▶";
    return;
  }

  if (state.mode === "paused") {
    state.mode = "playing";
    audio.playTrack("game");
    setOverlay(pauseOverlay, false);
    pauseButton.querySelector("span").textContent = "Ⅱ";
  }
}

function moveFish(direction) {
  if (state.mode === "menu" || state.mode === "over") return;
  if (state.mode === "paused") {
    togglePause();
    return;
  }

  const nextLane = clamp(state.targetLane + direction, 0, lanes.length - 1);
  if (nextLane !== state.targetLane) {
    state.targetLane = nextLane;
    audio.blip("move");
    spawnSplash(lanes[nextLane], FISH_Y + 20, "#d9fff8", 9);
  }
}

function spawnOil() {
  const safeLane = Math.floor(Math.random() * lanes.length);
  const groupSize = Math.random() > 0.7 && state.score > 110 ? 2 : 1;
  const blocked = [];

  while (blocked.length < groupSize) {
    const lane = Math.floor(Math.random() * lanes.length);
    if (lane !== safeLane && !blocked.includes(lane)) blocked.push(lane);
  }

  if (blocked.length === 0) blocked.push((safeLane + (Math.random() > 0.5 ? 1 : 2)) % lanes.length);

  blocked.forEach((lane) => {
    state.obstacles.push({
      id: state.oilId++,
      lane,
      y: -56 - Math.random() * 86,
      size: 0.76 + Math.random() * 0.28,
      wobble: Math.random() * Math.PI * 2,
      touched: false
    });
  });

  const interval = clamp(1.02 - state.score / 1250, 0.42, 1.02);
  state.spawnTimer = interval + Math.random() * 0.22;
}

function spawnBubble() {
  state.bubbles.push({
    x: 96 + Math.random() * (WIDTH - 192),
    y: HEIGHT + 14,
    size: 2 + Math.random() * 5,
    speed: 32 + Math.random() * 50,
    drift: Math.random() * Math.PI * 2
  });
}

function spawnGlint() {
  state.glints.push({
    x: 118 + Math.random() * (WIDTH - 236),
    y: 76 + Math.random() * 250,
    size: 8 + Math.random() * 18,
    life: 0.5 + Math.random() * 0.7,
    maxLife: 1.2
  });
}

function spawnSplash(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    state.splashes.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 115,
      vy: -24 - Math.random() * 76,
      life: 0.34 + Math.random() * 0.28,
      maxLife: 0.62,
      color
    });
  }
}

function hitOil(oil) {
  if (state.invulnerable > 0 || oil.touched) return;

  oil.touched = true;
  state.lives -= 1;
  state.invulnerable = 1.08;
  state.shake = 0.32;
  audio.blip("hit");
  spawnSplash(lanes[oil.lane], FISH_Y - 10, "#17151d", 18);
  spawnSplash(lanes[oil.lane], FISH_Y + 10, "#5d4c79", 10);

  if (state.lives <= 0) endGame();
}

function update(dt) {
  state.waveScroll = (state.waveScroll + dt * (30 + state.speed * 0.18)) % 96;
  state.deepScroll = (state.deepScroll + dt * (16 + state.speed * 0.08)) % 128;
  state.fishBob += dt * 7;
  state.shake = Math.max(0, state.shake - dt);

  updateBubbles(dt);
  updateSplashes(dt);
  updateGlints(dt);

  if (state.mode !== "playing") return;

  state.score += dt * (10 + state.speed * 0.07);
  state.best = Math.max(state.best, Math.floor(state.score), Number(localStorage.getItem(bestKey) || 0));
  state.speed = clamp(170 + state.score * 0.28, 170, 350);
  state.spawnTimer -= dt;
  state.invulnerable = Math.max(0, state.invulnerable - dt);

  if (Math.random() < dt * 4.2) spawnBubble();
  if (Math.random() < dt * 1.15) spawnGlint();
  if (state.spawnTimer <= 0) spawnOil();

  state.fishX += (lanes[state.targetLane] - state.fishX) * Math.min(1, dt * 15);
  if (Math.abs(lanes[state.targetLane] - state.fishX) < 0.5) {
    state.lane = state.targetLane;
    state.fishX = lanes[state.targetLane];
  }

  for (const oil of state.obstacles) {
    oil.y += state.speed * dt;
    oil.wobble += dt * 2.2;

    const nearFish = oil.y > FISH_Y - 48 && oil.y < FISH_Y + 34;
    const inLane = oil.lane === state.targetLane && Math.abs(state.fishX - lanes[oil.lane]) < 48;

    if (nearFish && inLane) hitOil(oil);
  }

  state.obstacles = state.obstacles.filter((oil) => oil.y < HEIGHT + 76);
  updateHud();
}

function updateBubbles(dt) {
  for (const bubble of state.bubbles) {
    bubble.y -= bubble.speed * dt;
    bubble.x += Math.sin(state.fishBob + bubble.drift) * dt * 16;
  }
  state.bubbles = state.bubbles.filter((bubble) => bubble.y > -20);
}

function updateGlints(dt) {
  for (const glint of state.glints) glint.life -= dt;
  state.glints = state.glints.filter((glint) => glint.life > 0);
}

function updateSplashes(dt) {
  for (const splash of state.splashes) {
    splash.x += splash.vx * dt;
    splash.y += splash.vy * dt;
    splash.vy += 210 * dt;
    splash.life -= dt;
  }
  state.splashes = state.splashes.filter((splash) => splash.life > 0);
}

function draw() {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (state.shake > 0) {
    const amp = state.shake * 10;
    ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
  }

  drawSea();
  drawBubbles();
  drawGlints();
  drawObstacles();
  drawSplashes();
  drawFish();
  drawForegroundDetails();
  drawVignette();

  ctx.restore();
}

function drawSea() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#8be6df");
  gradient.addColorStop(0.45, "#45bfc5");
  gradient.addColorStop(1, "#20779b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawSandyEdges();
  drawDeepWaterTiles();
  drawLaneChannel();
  drawWaveTiles();
  drawReefDetails();
  drawBottleRim();
}

function drawSandyEdges() {
  const left = 78;
  const right = WIDTH - 78;

  ctx.fillStyle = "#e9c86f";
  ctx.fillRect(0, 0, left, HEIGHT);
  ctx.fillRect(right, 0, left, HEIGHT);

  ctx.fillStyle = "#d9aa57";
  for (let y = -24; y < HEIGHT + 40; y += 34) {
    const py = y + (state.deepScroll % 34);
    const wobble = Math.sin((py + state.waveScroll) * 0.04) * 4;
    pixelRect(14 + wobble, py, 9, 4, "#d9aa57");
    pixelRect(40 - wobble, py + 13, 16, 5, "#f3d782");
    pixelRect(right + 18 - wobble, py + 7, 12, 4, "#d9aa57");
    pixelRect(right + 42 + wobble, py + 21, 15, 5, "#f3d782");
  }

  drawFoamBorder(left - 9, 1);
  drawFoamBorder(right + 3, -1);
}

function drawFoamBorder(x, side) {
  for (let y = -24; y < HEIGHT + 36; y += 22) {
    const py = y + (state.waveScroll * 0.7) % 22;
    const offset = Math.sin((py + state.waveScroll) * 0.06) * 5 * side;
    pixelRect(x + offset, py, 12, 4, "rgba(244, 255, 245, 0.68)");
    pixelRect(x + 8 + offset, py + 4, 8, 4, "rgba(244, 255, 245, 0.38)");
  }
}

function drawDeepWaterTiles() {
  for (let y = -96; y < HEIGHT + 96; y += 44) {
    const py = ((y + state.deepScroll) % (HEIGHT + 96)) - 96;
    const sway = Math.sin((py + state.waveScroll) * 0.026) * 16;

    pixelRect(114 + sway, py + 8, 38, 5, "rgba(22, 124, 149, 0.2)");
    pixelRect(158 + sway, py + 13, 20, 5, "rgba(22, 124, 149, 0.16)");
    pixelRect(522 - sway, py + 27, 42, 5, "rgba(22, 124, 149, 0.18)");
    pixelRect(482 - sway, py + 32, 24, 5, "rgba(22, 124, 149, 0.14)");
  }
}

function drawLaneChannel() {
  const top = 0;
  const bottom = HEIGHT;

  ctx.fillStyle = "rgba(13, 83, 110, 0.18)";
  ctx.fillRect(laneEdges[0], top, laneEdges[3] - laneEdges[0], bottom);

  ctx.fillStyle = "rgba(217, 255, 247, 0.24)";
  laneEdges.forEach((x) => {
    for (let y = -48; y < HEIGHT + 56; y += 64) {
      const py = y + state.waveScroll * 1.15;
      pixelRect(x - 2, py, 4, 16, "rgba(229, 255, 248, 0.42)");
      pixelRect(x - 7, py + 20, 14, 4, "rgba(229, 255, 248, 0.22)");
    }
  });

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(laneEdges[0] - 6, 0, 3, HEIGHT);
  ctx.fillRect(laneEdges[3] + 3, 0, 3, HEIGHT);
}

function drawWaveTiles() {
  for (let y = -96; y < HEIGHT + 96; y += 42) {
    const py = ((y + state.waveScroll) % (HEIGHT + 96)) - 96;
    const offset = Math.sin((py + state.waveScroll) * 0.036) * 20;

    pixelRect(105 + offset, py, 26, 4, "rgba(229, 255, 248, 0.5)");
    pixelRect(135 + offset, py + 4, 13, 4, "rgba(229, 255, 248, 0.28)");
    pixelRect(318 - offset * 0.18, py + 16, 38, 4, "rgba(229, 255, 248, 0.36)");
    pixelRect(362 - offset * 0.18, py + 20, 18, 4, "rgba(229, 255, 248, 0.22)");
    pixelRect(558 - offset, py + 25, 28, 4, "rgba(229, 255, 248, 0.42)");
    pixelRect(590 - offset, py + 29, 14, 4, "rgba(229, 255, 248, 0.26)");
  }
}

function drawReefDetails() {
  for (let y = -90; y < HEIGHT + 120; y += 116) {
    const py = ((y + state.deepScroll * 0.72) % (HEIGHT + 140)) - 90;

    drawSeaweedClump(96, py + 20, 1);
    drawSeaweedClump(612, py + 58, -1);
    drawCoralCluster(48, py + 82, 1);
    drawCoralCluster(654, py + 24, -1);
    drawShell(132, py + 70, "#fff0bd");
    drawShell(574, py + 108, "#ffd0aa");
  }
}

function drawSeaweedClump(x, y, side) {
  pixelRect(x, y, 7, 28, "#2f8750");
  pixelRect(x + 8 * side, y + 8, 7, 21, "#48b56a");
  pixelRect(x - 7 * side, y + 15, 6, 18, "#277145");
  pixelRect(x + 2 * side, y - 5, 5, 9, "#71ce7a");
}

function drawCoralCluster(x, y, side) {
  pixelRect(x, y, 8, 8, "#ff7c6e");
  pixelRect(x + 8 * side, y - 8, 8, 16, "#f15f73");
  pixelRect(x + 16 * side, y, 8, 8, "#ffb05f");
  pixelRect(x + 8 * side, y + 8, 18, 6, "#df4f69");
}

function drawShell(x, y, color) {
  pixelRect(x, y, 14, 5, color);
  pixelRect(x + 3, y - 5, 8, 5, "#fff7d8");
  pixelRect(x + 6, y, 2, 5, "#d9aa57");
}

function drawBottleRim() {
  pixelRect(88, 14, 536, 6, "rgba(255, 255, 255, 0.24)");
  pixelRect(98, 24, 516, 3, "rgba(255, 255, 255, 0.13)");
  pixelRect(88, HEIGHT - 22, 536, 5, "rgba(255, 255, 255, 0.2)");
  pixelRect(93, 18, 5, HEIGHT - 40, "rgba(255, 255, 255, 0.12)");
  pixelRect(614, 18, 5, HEIGHT - 40, "rgba(255, 255, 255, 0.1)");
}

function drawBubbles() {
  for (const bubble of state.bubbles) {
    pixelRect(bubble.x, bubble.y, bubble.size, bubble.size, "rgba(229, 255, 248, 0.58)");
    pixelRect(bubble.x + bubble.size * 0.6, bubble.y - bubble.size * 0.4, bubble.size * 0.45, bubble.size * 0.45, "rgba(255, 255, 255, 0.7)");
  }
}

function drawGlints() {
  for (const glint of state.glints) {
    const alpha = Math.max(0, glint.life / glint.maxLife);
    ctx.globalAlpha = alpha * 0.52;
    pixelRect(glint.x, glint.y, glint.size, 3, "#f3fff7");
    pixelRect(glint.x + glint.size / 2 - 1, glint.y - glint.size / 3, 3, glint.size * 0.7, "#f3fff7");
    ctx.globalAlpha = 1;
  }
}

function drawObstacles() {
  for (const oil of state.obstacles) drawOil(oil);
}

function drawOil(oil) {
  const x = lanes[oil.lane] + Math.sin(oil.wobble) * 6;
  const y = oil.y;
  const s = oil.size;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(oil.wobble * 0.6) * 0.08);
  ctx.scale(s, s);

  const cells = [
    [-5, -3, 5, 2, 4],
    [-2, -4, 7, 3, 0],
    [-7, -1, 13, 3, 1],
    [-8, 2, 16, 3, 0],
    [-6, 5, 18, 3, 1],
    [-3, 8, 11, 3, 4],
    [0, 11, 6, 2, 0],
    [5, -2, 6, 3, 2],
    [-10, 2, 4, 4, 4],
    [8, 6, 4, 3, 2],
    [-3, 0, 4, 1, 5],
    [2, 4, 5, 1, 5],
    [-5, 7, 3, 1, 5],
    [5, 10, 3, 1, 3]
  ];

  for (const [cx, cy, cw, ch, color] of cells) {
    pixelRect(cx * 5, cy * 5, cw * 5, ch * 5, oilPalette[color]);
  }

  pixelRect(-20, -6, 14, 4, "rgba(184, 197, 255, 0.3)");
  pixelRect(18, 16, 18, 4, "rgba(128, 102, 180, 0.34)");
  pixelRect(-6, 27, 22, 4, "rgba(30, 21, 42, 0.58)");
  ctx.restore();
}

function drawSplashes() {
  for (const splash of state.splashes) {
    const alpha = Math.max(0, splash.life / splash.maxLife);
    ctx.globalAlpha = alpha;
    pixelRect(splash.x, splash.y, 5, 5, splash.color);
    ctx.globalAlpha = 1;
  }
}

function drawFish() {
  const blink = state.invulnerable > 0 && Math.floor(state.invulnerable * 16) % 2 === 0;
  if (blink) return;

  const x = state.fishX;
  const y = FISH_Y + Math.sin(state.fishBob) * 3;
  const tail = Math.sin(state.fishBob * 2.4) > 0 ? 1 : -1;
  const lean = (lanes[state.targetLane] - state.fishX) * 0.004;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);

  pixelRect(-24, 30, 48, 8, "rgba(8, 26, 35, 0.18)");
  pixelRect(-17, 16, 34, 18, "#bac4ca");
  pixelRect(-23, -1, 46, 24, "#dbe4e8");
  pixelRect(-19, -20, 38, 24, "#f0f6f8");
  pixelRect(-11, -35, 22, 18, "#fbfeff");
  pixelRect(-6, -43, 12, 9, "#fbfeff");

  pixelRect(-31, 1, 10, 20, "#9ba7b0");
  pixelRect(21, 1, 10, 20, "#9ba7b0");
  pixelRect(-10 * tail, 32, 20 * tail, 14, "#aeb8bf");
  pixelRect(-18 * tail, 44, 18 * tail, 8, "#909ba4");

  pixelRect(-13, -25, 26, 5, "#ffffff");
  pixelRect(-7, 6, 14, 20, "#a7b0b8");
  pixelRect(6, -32, 4, 4, "#1b2e3b");
  pixelRect(10, -28, 3, 3, "#ffffff");
  pixelRect(-10, -32, 4, 4, "#1b2e3b");
  pixelRect(-15, -47, 30, 5, "#d5edf2");
  pixelRect(-2, -15, 4, 32, "rgba(255, 255, 255, 0.38)");

  ctx.restore();
}

function drawForegroundDetails() {
  pixelRect(110, 36, 72, 5, "rgba(255, 255, 255, 0.15)");
  pixelRect(492, 62, 86, 5, "rgba(255, 255, 255, 0.13)");
  pixelRect(145, 348, 100, 5, "rgba(255, 255, 255, 0.1)");
  pixelRect(470, 326, 84, 5, "rgba(255, 255, 255, 0.12)");
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.42, 40, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.7);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(7,20,30,0.3)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function pixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
resumeButton.addEventListener("click", togglePause);
pauseButton.addEventListener("click", togglePause);

soundButton.addEventListener("click", async () => {
  await audio.init();
  audio.setMuted(!audio.muted);
  soundIcon.textContent = audio.muted ? "×" : "♪";
});

leftButton.addEventListener("click", () => moveFish(-1));
rightButton.addEventListener("click", () => moveFish(1));

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  moveFish(x < rect.width / 2 ? -1 : 1);
});

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", " ", "Enter"].includes(event.key)) event.preventDefault();

  if ((event.key === "Enter" || event.key === " ") && (state.mode === "menu" || state.mode === "over")) {
    startGame();
    return;
  }

  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") moveFish(-1);
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") moveFish(1);
  if (event.key.toLowerCase() === "p" && (state.mode === "playing" || state.mode === "paused")) togglePause();
});

updateHud();
audio.playTrack("menu");
requestAnimationFrame(loop);
