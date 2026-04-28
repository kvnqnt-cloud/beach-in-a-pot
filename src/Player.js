import { DESIGN_WIDTH } from "./config.js";
import { clamp, lerp } from "./utils.js";

export class Player {
  constructor(texture, deadTexture) {
    this.container = new PIXI.Container();
    this.baseY = 720;
    this.x = DESIGN_WIDTH * 0.5;
    this.y = this.baseY;
    this.vx = 0;
    this.input = 0;
    this.swim = 0;
    this.dead = false;
    this.deadTimer = 0;

    this.shadow = new PIXI.Graphics();
    this.shadow.beginFill(0x000000, 0.28);
    this.shadow.drawEllipse(0, 92, 48, 16);
    this.shadow.endFill();

    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(0.96);

    this.deadSprite = new PIXI.Sprite(deadTexture);
    this.deadSprite.anchor.set(0.5);
    this.deadSprite.scale.set(0.72);
    this.deadSprite.visible = false;
    this.deadSprite.alpha = 0;

    this.container.addChild(this.shadow, this.sprite, this.deadSprite);
    this.container.position.set(this.x, this.y);
  }

  setInput(value) {
    this.input = this.dead ? 0 : value;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.deadTimer = 0;
    this.input = 0;
    this.sprite.visible = false;
    this.deadSprite.visible = true;
    this.deadSprite.alpha = 0;
  }

  update(dt, speedFactor = 1) {
    this.swim += dt * (6.8 + speedFactor * 1.1);

    if (!this.dead) {
      const force = 2300;
      const damping = 5.1;
      this.vx += this.input * force * dt;
      this.vx -= this.vx * damping * dt;
      this.vx = clamp(this.vx, -880, 880);
      this.x += this.vx * dt;

      const margin = 145;
      if (this.x < margin) {
        this.x = margin;
        this.vx *= -0.18;
      }
      if (this.x > DESIGN_WIDTH - margin) {
        this.x = DESIGN_WIDTH - margin;
        this.vx *= -0.18;
      }

      this.y = this.baseY + Math.sin(this.swim * 0.85) * 9;
      this.container.rotation = lerp(this.container.rotation, this.vx * 0.00055, dt * 8);
      this.sprite.scale.x = 0.96 * (1 + Math.sin(this.swim * 1.9) * 0.018);
      this.sprite.scale.y = 0.96 * (1 - Math.sin(this.swim * 1.9) * 0.012);
      this.sprite.rotation = Math.sin(this.swim * 2.5) * 0.025;
    } else {
      this.deadTimer += dt;
      this.vx -= this.vx * 3.6 * dt;
      this.x += this.vx * dt;
      this.y += 28 * dt;
      this.container.rotation = lerp(this.container.rotation, Math.sin(this.deadTimer * 2.2) * 0.22, dt * 3);
      this.deadSprite.alpha = lerp(this.deadSprite.alpha, 1, dt * 5);
      this.deadSprite.scale.set(0.72 * (1 + Math.sin(this.deadTimer * 1.9) * 0.025));
    }

    this.container.position.set(this.x, this.y);
  }

  getHitCircles() {
    return [
      { x: this.x, y: this.y - 38, r: 38 },
      { x: this.x, y: this.y - 94, r: 24 },
      { x: this.x, y: this.y + 48, r: 26 }
    ];
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
