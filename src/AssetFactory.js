import { ASSETS } from "./config.js";
import { clamp, smoothstep } from "./utils.js";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function organicMask(nx, ny, seed = 0, sx = 1, sy = 0.72) {
  const angle = Math.atan2(ny / sy, nx / sx);
  const dist = Math.sqrt((nx / sx) ** 2 + (ny / sy) ** 2);
  const radius = 0.74 + Math.sin(angle * 3.1 + seed) * 0.09 + Math.sin(angle * 7.3 + seed * 0.7) * 0.07;
  return 1 - smoothstep(radius, radius + 0.08, dist);
}

function dilateAlpha(alpha, width, height, iterations = 2) {
  let src = alpha;
  for (let k = 0; k < iterations; k += 1) {
    const next = new Uint8ClampedArray(src);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        let m = src[i];
        m = Math.max(m, src[i - 1], src[i + 1], src[i - width], src[i + width]);
        next[i] = m;
      }
    }
    src = next;
  }
  return src;
}

function makeTextureFromCrop(image, crop, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = crop.w;
  canvas.height = crop.h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  const frame = ctx.getImageData(0, 0, crop.w, crop.h);
  const data = frame.data;
  const alphaMap = new Uint8ClampedArray(crop.w * crop.h);

  for (let y = 0; y < crop.h; y += 1) {
    for (let x = 0; x < crop.w; x += 1) {
      const i = (y * crop.w + x) * 4;
      const lum = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      const nx = (x / crop.w - 0.5) * 2;
      const ny = (y / crop.h - 0.5) * 2;
      let a = 1;

      if (options.mode === "luma") {
        data[i] = Math.min(255, data[i] * 1.35 + 26);
        data[i + 1] = Math.min(255, data[i + 1] * 1.35 + 26);
        data[i + 2] = Math.min(255, data[i + 2] * 1.35 + 26);
        a = smoothstep(options.low ?? 24, options.high ?? 105, lum);
        if (options.mask === "fish") {
          const widthProfile = 0.18 + 0.33 * Math.sin(Math.PI * clamp((y / crop.h) * 1.1, 0, 1));
          const taper = 1 - smoothstep(widthProfile, widthProfile + 0.14, Math.abs(nx));
          const vertical = smoothstep(0.03, 0.14, y / crop.h) * (1 - smoothstep(0.95, 1, y / crop.h));
          a = Math.max(a, taper * vertical * 0.92);
        }
      }

      if (options.mode === "organic") {
        a = organicMask(nx, ny, options.seed ?? 0, options.sx ?? 1, options.sy ?? 0.72);
        const contrast = clamp((lum - 10) / 115, 0, 1);
        const darken = 0.22 + contrast * 1.15;
        const shine = lum > 40 ? 24 : 0;
        data[i] = Math.min(255, Math.floor(data[i] * darken + shine));
        data[i + 1] = Math.min(255, Math.floor(data[i + 1] * darken + shine));
        data[i + 2] = Math.min(255, Math.floor(data[i + 2] * darken + shine));
      }

      if (options.mode === "skeleton") {
        const body = organicMask(nx, ny, options.seed ?? 2.2, 0.82, 1.05);
        const bones = smoothstep(options.low ?? 26, options.high ?? 115, lum);
        a = Math.max(body * 0.82, bones);
      }

      alphaMap[y * crop.w + x] = Math.floor(clamp(a, 0, 1) * 255);
    }
  }

  const finalAlpha = options.mode === "luma" ? dilateAlpha(alphaMap, crop.w, crop.h, 3) : alphaMap;
  for (let i = 0; i < finalAlpha.length; i += 1) data[i * 4 + 3] = finalAlpha[i];
  ctx.putImageData(frame, 0, 0);
  return PIXI.Texture.from(canvas);
}

export async function buildVisualAssets() {
  const [title, gameplay, gameover] = await Promise.all([loadImage(ASSETS.title), loadImage(ASSETS.gameplay), loadImage(ASSETS.gameover)]);
  const fish = makeTextureFromCrop(gameplay, { x: 900, y: 570, w: 220, h: 305 }, { mode: "luma", mask: "fish", low: 24, high: 92 });
  const fishHero = fish;
  const skeleton = makeTextureFromCrop(gameover, { x: 820, y: 690, w: 330, h: 360 }, { mode: "skeleton", low: 28, high: 128, seed: 3.6 });
  const oils = [
    makeTextureFromCrop(gameover, { x: 0, y: 500, w: 740, h: 410 }, { mode: "organic", seed: 0.3, sx: 1.08, sy: 0.62 }),
    makeTextureFromCrop(gameover, { x: 1230, y: 432, w: 390, h: 240 }, { mode: "organic", seed: 1.2, sx: 1.0, sy: 0.7 }),
    makeTextureFromCrop(gameover, { x: 1220, y: 0, w: 700, h: 350 }, { mode: "organic", seed: 2.1, sx: 1.12, sy: 0.58 }),
    makeTextureFromCrop(gameplay, { x: 660, y: 120, w: 230, h: 230 }, { mode: "organic", seed: 4.2, sx: 0.78, sy: 0.86 }),
    makeTextureFromCrop(gameplay, { x: 1180, y: 350, w: 270, h: 170 }, { mode: "organic", seed: 5.7, sx: 1.0, sy: 0.66 })
  ];
  return { fish, fishHero, skeleton, oils };
}
