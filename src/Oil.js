import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./config.js";
import { distanceSquared, rand } from "./utils.js";

export class Oil {
  constructor(texture, x, y, scale = 1) {
    this.container = new PIXI.Container();
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(scale);
    this.sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
    this.container.position.set(x, y);
    this.seed = rand(0, Math.PI * 2);
    this.drift = rand(-1, 1);
    this.rotationSpeed = rand(-0.18, 0.18);
    this.radius = Math.max(texture.width, texture.height) * 0.32 * scale;
    this.dead = false;
    this.container.addChild(this.sprite);
  }

  update(dt, scrollSpeed, elapsed) {
    const wave = Math.sin(elapsed * 1.5 + this.seed);
    this.container.y += scrollSpeed * dt;
    this.container.x += (wave * 34 + this.drift * 12) * dt;
    this.container.rotation += this.rotationSpeed * dt;
    this.sprite.scale.x += Math.sin(elapsed * 2 + this.seed) * 0.0008;
    this.sprite.scale.y += Math.cos(elapsed * 2.2 + this.seed) * 0.0008;
    if (this.container.x < 90) this.container.x = DESIGN_WIDTH - 90;
    if (this.container.x > DESIGN_WIDTH - 90) this.container.x = 90;
    if (this.container.y > DESIGN_HEIGHT + 260) this.dead = true;
  }

  collides(playerCircles) {
    const circles = [
      { x: 0, y: 0, r: this.radius * 0.72 },
      { x: -this.radius * 0.44, y: 10, r: this.radius * 0.36 },
      { x: this.radius * 0.38, y: -8, r: this.radius * 0.34 },
      { x: 12, y: this.radius * 0.38, r: this.radius * 0.3 }
    ];
    for (const a of playerCircles) {
      for (const b of circles) {
        const bx = this.container.x + b.x * this.sprite.scale.x;
        const by = this.container.y + b.y * this.sprite.scale.y;
        const r = a.r + b.r;
        if (distanceSquared(a.x, a.y, bx, by) < r * r) return true;
      }
    }
    return false;
  }

  destroy() {
    this.container.destroy({ children: true });
  }

  static randomSpawn(textures, elapsed) {
    const texture = textures[Math.floor(Math.random() * textures.length)];
    let x = rand(180, DESIGN_WIDTH - 180);
    if (Math.random() < 0.35) x = DESIGN_WIDTH * 0.5 + Math.sin(elapsed * 0.8) * 140 + rand(-420, 420);
    const base = texture.width < 120 ? rand(1.35, 2.3) : rand(0.68, 1.05);
    return new Oil(texture, x, rand(-230, -100), base);
  }
}
