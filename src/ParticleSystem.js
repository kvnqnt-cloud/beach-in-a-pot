import { rand } from "./utils.js";

function makeBubbleTexture(radius) {
  const canvas = document.createElement("canvas");
  const size = Math.ceil(radius * 2 + 8);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c - radius * 0.35, c - radius * 0.45, radius * 0.1, c, c, radius);
  gradient.addColorStop(0, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.24)");
  gradient.addColorStop(0.72, "rgba(190,220,220,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.58)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.beginPath();
  ctx.arc(c - radius * 0.35, c - radius * 0.45, Math.max(1.2, radius * 0.18), 0, Math.PI * 2);
  ctx.fill();
  return PIXI.Texture.from(canvas);
}

export class ParticleSystem {
  constructor() {
    this.container = new PIXI.Container();
    this.particles = [];
    this.bubbleTextures = [makeBubbleTexture(4), makeBubbleTexture(6), makeBubbleTexture(9), makeBubbleTexture(12)];
  }

  spawnBubbleTrail(x, y, amount = 1) {
    for (let i = 0; i < amount; i += 1) {
      const texture = this.bubbleTextures[Math.floor(Math.random() * this.bubbleTextures.length)];
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.alpha = rand(0.35, 0.82);
      sprite.position.set(x + rand(-18, 18), y + rand(70, 110));
      sprite.scale.set(rand(0.7, 1.18));
      this.container.addChild(sprite);
      this.particles.push({
        view: sprite,
        vx: rand(-18, 18),
        vy: rand(-64, -28),
        life: rand(0.9, 1.9),
        maxLife: 1.9,
        spin: rand(-0.8, 0.8),
        kind: "bubble"
      });
    }
  }

  spawnSplash(x, y) {
    for (let i = 0; i < 34; i += 1) {
      const g = new PIXI.Graphics();
      const r = rand(4, 13);
      g.beginFill(i % 3 === 0 ? 0xffffff : 0x070707, rand(0.3, 0.85));
      g.drawCircle(0, 0, r);
      g.endFill();
      g.position.set(x + rand(-25, 25), y + rand(-28, 28));
      this.container.addChild(g);
      this.particles.push({ view: g, vx: rand(-230, 230), vy: rand(-260, 110), life: rand(0.28, 0.72), maxLife: 0.72, spin: rand(-4, 4), kind: "splash" });
    }
  }

  update(dt, scrollSpeed = 0) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      p.view.x += p.vx * dt;
      p.view.y += (p.vy + scrollSpeed * 0.24) * dt;
      p.view.rotation += p.spin * dt;
      p.vx *= 1 - dt * 0.8;
      p.vy += p.kind === "splash" ? 260 * dt : -5 * dt;
      p.view.alpha = Math.max(0, p.life / p.maxLife);
      p.view.scale.x *= 1 + dt * 0.018;
      p.view.scale.y *= 1 + dt * 0.028;
      if (p.life <= 0) {
        p.view.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  destroy() {
    this.container.destroy({ children: true });
    this.particles.length = 0;
  }
}
