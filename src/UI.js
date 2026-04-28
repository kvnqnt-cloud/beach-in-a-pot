import { COLORS } from "./config.js";
import { padScore } from "./utils.js";

export function makeText(text, size = 42, align = "left") {
  return new PIXI.Text(text, {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: size,
    fontWeight: "400",
    fill: COLORS.white,
    align,
    letterSpacing: 0,
    lineHeight: size * 1.14
  });
}

export function makeHitButton(x, y, width, height, onClick) {
  const button = new PIXI.Container();
  button.position.set(x, y);
  button.eventMode = "static";
  button.cursor = "pointer";

  // área clicável invisível
  const hit = new PIXI.Graphics();
  hit.beginFill(0xffffff, 0.001);
  hit.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  hit.endFill();

  // overlay de hover
  const hoverOverlay = new PIXI.Graphics();
  hoverOverlay.beginFill(0x000000, 0.2);
  hoverOverlay.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  hoverOverlay.endFill();
  hoverOverlay.alpha = 0;

  button.addChild(hit, hoverOverlay);

  // animação
  let start = 0;
  let from = 0;
  let to = 0;
  const duration = 0.2; // segundos

  function easeInOut(t) {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  const tickerFn = (ticker) => {
    if (start === 0) return;

    const now = performance.now() / 1000;
    const t = Math.min((now - start) / duration, 1);
    const eased = easeInOut(t);

    hoverOverlay.alpha = from + (to - from) * eased;

    if (t >= 1) {
      start = 0;
    }
  };

  PIXI.Ticker.shared.add(tickerFn);

  // eventos
  button.on("pointertap", onClick);

  button.on("pointerover", () => {
    from = hoverOverlay.alpha;
    to = 1;
    start = performance.now() / 1000;
  });

  button.on("pointerout", () => {
    from = hoverOverlay.alpha;
    to = 0;
    start = performance.now() / 1000;
  });

  return button;
}

export class Hud {
  constructor(bestScore) {
    this.container = new PIXI.Container();
    this.scoreValue = makeText("00000", 48);
    this.bestValue = makeText(padScore(bestScore), 48);
    this.scoreValue.position.set(150, 123);
    this.bestValue.position.set(150, 280);
    this.container.addChild(this.scoreValue, this.bestValue);
  }

  update(score, bestScore) {
    this.scoreValue.text = padScore(score);
    this.bestValue.text = padScore(bestScore);
  }
}

export function makeSoundToggle(audioManager) {
  const container = new PIXI.Container();
  container.eventMode = "static";
  container.cursor = "pointer";
  container.position.set(150, 998);

  const patch = new PIXI.Graphics();
  patch.beginFill(0x050505, 0.72);
  patch.drawRoundedRect(-52, -40, 320, 82, 8);
  patch.endFill();

  const icon = new PIXI.Graphics();
  const label = makeText("", 38);
  label.position.set(72, -23);

  function redraw() {
    icon.clear();
    icon.lineStyle(2, 0xffffff, 0.92);
    icon.beginFill(0x000000, 0.02);
    icon.drawCircle(0, 0, 33);
    icon.endFill();
    icon.lineStyle(4, 0xffffff, 0.94);
    icon.moveTo(-14, -8);
    icon.lineTo(-4, -8);
    icon.lineTo(10, -20);
    icon.lineTo(10, 20);
    icon.lineTo(-4, 8);
    icon.lineTo(-14, 8);
    icon.closePath();
    if (!audioManager.enabled) {
      icon.moveTo(-20, -20);
      icon.lineTo(20, 20);
    }
    label.text = audioManager.enabled ? "sound on" : "sound off";
  }

  container.addChild(patch, icon, label);
  container.on("pointertap", async () => {
    await audioManager.toggle();
    redraw();
  });

  redraw();
  return container;
}

export function makeControlsHint() {
  const container = new PIXI.Container();
  container.position.set(1392, 998);

  const patch = new PIXI.Graphics();
  patch.beginFill(0x050505, 0.72);
  patch.drawRoundedRect(-18, -42, 420, 84, 8);
  patch.endFill();

  const labelLeft = makeText("use", 38, "left");
  labelLeft.anchor.set(0, 0.5);
  labelLeft.position.set(0, 0);

  const keys = new PIXI.Graphics();
  keys.lineStyle(2, 0xffffff, 0.94);
  keys.drawRoundedRect(70, -22, 44, 44, 6);
  keys.drawRoundedRect(130, -22, 44, 44, 6);

  const left = makeText("←", 36, "center");
  left.anchor.set(0.5);
  left.position.set(92, -1);

  const right = makeText("→", 36, "center");
  right.anchor.set(0.5);
  right.position.set(152, -1);

  const labelRight = makeText("to escape oil", 38, "left");
  labelRight.anchor.set(0, 0.5);
  labelRight.position.set(198, 0);

  container.addChild(patch, labelLeft, keys, left, right, labelRight);
  return container;
}
