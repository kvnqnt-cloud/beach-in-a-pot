import { ASSETS, DESIGN_HEIGHT, DESIGN_WIDTH, STORAGE_KEYS } from "./config.js";
import { AudioManager } from "./AudioManager.js";
import { SceneManager } from "./SceneManager.js";
import { GameOverScene, GameplayScene, MenuScene } from "./scenes.js";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function makeCleanTexture(src, clearRects) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = DESIGN_WIDTH;
  canvas.height = DESIGN_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  for (const rect of clearRects) ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
  return PIXI.Texture.from(canvas);
}

const bottomUiRects = [
  { x: 96, y: 925, w: 430, h: 140 },
  { x: 1320, y: 925, w: 540, h: 140 }
];

export class Game {
  constructor(root) {
    this.root = root;
    this.app = new PIXI.Application({
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      backgroundColor: 0x000000,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      forceCanvas: false
    });

    this.stage = this.app.stage;
    this.input = { left: 0, right: 0 };
    this.bestScore = Number(localStorage.getItem(STORAGE_KEYS.bestScore) || 0);
    this.audio = new AudioManager();
    this.scenes = new SceneManager(this);
    this.textures = {};

    this.app.view.tabIndex = 0;
    this.app.view.setAttribute("aria-label", "peixe inteligente game canvas");
    this.root.appendChild(this.app.view);

    this.bindInput();
    this.app.ticker.add(() => {
      const dt = Math.min(0.05, this.app.ticker.elapsedMS / 1000);
      this.scenes.update(dt);
    });
  }

  async init() {
    const aliases = {
      titleBg: ASSETS.titleBg,
      gameplayBg: ASSETS.gameplayBg,
      fish: ASSETS.fish,
      deadFish: ASSETS.deadFish,
      oil01: ASSETS.oil01,
      oil02: ASSETS.oil02,
      oil03: ASSETS.oil03
    };

    for (const [key, src] of Object.entries(aliases)) {
      this.textures[key] = await PIXI.Assets.load(src);
    }

    this.textures.titleInterface = await makeCleanTexture(ASSETS.titleInterface, bottomUiRects);
    this.textures.gameplayInterface = await makeCleanTexture(ASSETS.gameplayInterface, [
      { x: 120, y: 108, w: 260, h: 78 },
      { x: 120, y: 268, w: 260, h: 78 },
      ...bottomUiRects
    ]);
    this.textures.gameOverInterface = await makeCleanTexture(ASSETS.gameOverInterface, [
      { x: 690, y: 365, w: 560, h: 145 },
      ...bottomUiRects
    ]);

    this.oilTextures = [this.textures.oil01, this.textures.oil02, this.textures.oil03];
    await this.scenes.set(MenuScene);
  }

  bindInput() {
    window.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        this.input.left = 1;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        this.input.right = 1;
      }
      if (event.key === "Enter" || event.key === " ") event.preventDefault();
    });

    window.addEventListener("keyup", (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") this.input.left = 0;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") this.input.right = 0;
    });

    this.app.view.addEventListener("pointerdown", async (event) => {
      await this.audio.unlock();
      const rect = this.app.view.getBoundingClientRect();
      const x = event.clientX - rect.left;
      this.input.left = x < rect.width * 0.5 ? 1 : 0;
      this.input.right = x >= rect.width * 0.5 ? 1 : 0;
      this.app.view.focus();
    });

    window.addEventListener("pointerup", () => {
      this.input.left = 0;
      this.input.right = 0;
    });
  }

  startRun() {
    this.input.left = 0;
    this.input.right = 0;
    this.scenes.set(GameplayScene);
  }

  endRun(score) {
    const finalScore = Math.floor(score);
    this.bestScore = Math.max(this.bestScore, finalScore);
    localStorage.setItem(STORAGE_KEYS.bestScore, String(this.bestScore));
    this.scenes.set(GameOverScene, { score: finalScore });
  }
}
