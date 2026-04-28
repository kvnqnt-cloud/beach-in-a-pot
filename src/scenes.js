import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./config.js";
import { Oil } from "./Oil.js";
import { ParticleSystem } from "./ParticleSystem.js";
import { Player } from "./Player.js";
import { Hud, makeControlsHint, makeHitButton, makeSoundToggle, makeText } from "./UI.js";
import { clamp, lerp, padScore, rand } from "./utils.js";

function fullSprite(texture) {
  const sprite = new PIXI.Sprite(texture);
  sprite.width = DESIGN_WIDTH;
  sprite.height = DESIGN_HEIGHT;
  return sprite;
}

class BaseScene {
  constructor(game) {
    this.game = game;
    this.container = new PIXI.Container();
    this.elapsed = 0;
  }

  update(dt) {
    this.elapsed += dt;
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}

export class MenuScene extends BaseScene {
  constructor(game) {
    super(game);
    this.bg = fullSprite(game.textures.titleBg);
    this.ui = fullSprite(game.textures.titleInterface);

    this.startHit = makeHitButton(960, 827, 330, 72, async () => {
      await this.game.audio.unlock();
      this.game.startRun();
    });

    // 🔥 HOVER EFFECT (opacity)
    this.startHit.eventMode = "static";
    this.startHit.cursor = "pointer";

    this.startHit.on("pointerover", () => {
      this.startHit.alpha = 0.8;
    });

    this.startHit.on("pointerout", () => {
      this.startHit.alpha = 1;
    });

    this.soundToggle = makeSoundToggle(this.game.audio);
    this.hint = makeControlsHint();

    this.container.addChild(this.bg, this.ui, this.startHit, this.soundToggle, this.hint);
  }

  async enter() {
    await this.game.audio.warmStart();
  }

  update(dt) {
    super.update(dt);
    const pulse = 1 + Math.sin(this.elapsed * 3.2) * 0.012;
    this.startHit.scale.set(pulse);
    this.game.audio.update(dt, this.elapsed, "menu");
  }
}

export class GameplayScene extends BaseScene {
  constructor(game) {
    super(game);
    this.bg = fullSprite(game.textures.gameplayBg);
    this.bg2 = fullSprite(game.textures.gameplayBg);
    this.bg2.y = -DESIGN_HEIGHT;
    this.oilContainer = new PIXI.Container();
    this.particles = new ParticleSystem();
    this.player = new Player(game.textures.fish, game.textures.deadFish);
    this.interface = fullSprite(game.textures.gameplayInterface);
    this.hud = new Hud(game.bestScore);
    this.soundToggle = makeSoundToggle(this.game.audio);
    this.hint = makeControlsHint();

    this.container.addChild(
      this.bg,
      this.bg2,
      this.oilContainer,
      this.particles.container,
      this.player.container,
      this.interface,
      this.hud.container,
      this.soundToggle,
      this.hint
    );

    this.score = 0;
    this.spawnTimer = 0.62;
    this.oils = [];
    this.scrollSpeed = 330;
    this.slowMo = 1;
    this.crashed = false;
    this.crashTimer = 0;
    this.previousInput = 0;
  }

  updateBackground(dt) {
    const drift = this.scrollSpeed * 0.055 * dt;
    this.bg.y += drift;
    this.bg2.y += drift;
    if (this.bg.y >= DESIGN_HEIGHT) this.bg.y = this.bg2.y - DESIGN_HEIGHT;
    if (this.bg2.y >= DESIGN_HEIGHT) this.bg2.y = this.bg.y - DESIGN_HEIGHT;
  }

  update(dt) {
    super.update(dt);
    const activeDt = dt * this.slowMo;
    this.scrollSpeed = 340 + 420 * (1 - Math.exp(-this.elapsed / 18));
    this.updateBackground(activeDt);
    this.score += this.crashed ? 0 : activeDt;
    this.spawnTimer -= activeDt;

    const input = this.game.input.right - this.game.input.left;
    this.player.setInput(input);
    if (input !== 0 && input !== this.previousInput) this.game.audio.blip("move");
    this.previousInput = input;

    this.player.update(activeDt, this.scrollSpeed / 600);
    if (!this.crashed && Math.random() < activeDt * 8)
      this.particles.spawnBubbleTrail(this.player.x, this.player.y, 1);

    if (!this.crashed && this.spawnTimer <= 0) {
      this.spawnOilWave();
      this.spawnTimer = clamp(1.12 - this.elapsed * 0.022, 0.34, 1.12) + rand(0, 0.22);
    }

    for (const oil of this.oils) {
      oil.update(activeDt, this.scrollSpeed, this.elapsed);
      if (!this.crashed && oil.collides(this.player.getHitCircles()))
        this.handleCrash(oil);
    }

    for (let i = this.oils.length - 1; i >= 0; i -= 1) {
      if (this.oils[i].dead) {
        this.oils[i].destroy();
        this.oils.splice(i, 1);
      }
    }

    this.particles.update(activeDt, this.scrollSpeed);
    this.hud.update(this.score, this.game.bestScore);
    this.game.audio.update(dt, this.elapsed, "gameplay", this.slowMo);

    if (this.crashed) {
      this.crashTimer += dt;
      this.slowMo = lerp(this.slowMo, 0.18, dt * 7);
      if (this.crashTimer > 0.58) this.game.endRun(this.score);
    }
  }

  spawnOilWave() {
    const count = this.elapsed > 18 && Math.random() < 0.42 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const oil = Oil.randomSpawn(this.game.oilTextures, this.elapsed + i * 2);
      if (count === 2) oil.container.x += i === 0 ? -260 : 260;
      this.oilContainer.addChild(oil.container);
      this.oils.push(oil);
    }
  }

  handleCrash(oil) {
    this.crashed = true;
    this.crashTimer = 0;
    this.player.kill();
    this.particles.spawnSplash(this.player.x, this.player.y - 30);
    oil.sprite.scale.x *= 1.18;
    oil.sprite.scale.y *= 1.1;
    this.game.audio.blip("oil");
  }

  destroy() {
    this.player.destroy();
    this.particles.destroy();
    for (const oil of this.oils) oil.destroy();
    super.destroy();
  }
}

export class GameOverScene extends BaseScene {
  constructor(game, data) {
    super(game);
    this.bg = fullSprite(game.textures.gameplayBg);

    this.dead = new PIXI.Sprite(game.textures.deadFish);
    this.dead.anchor.set(0.5);
    this.dead.position.set(960, 830);
    this.dead.scale.set(0.92);

    this.interface = fullSprite(game.textures.gameOverInterface);

    this.scoreText = makeText(padScore(data.score || 0), 84, "center");
    this.scoreText.anchor.set(0.5);
    this.scoreText.position.set(960, 430);

    this.restartHit = makeHitButton(960, 565, 215, 70, async () => {
      await this.game.audio.unlock();
      this.game.startRun();
    });

    // 🔥 HOVER EFFECT (opacity)
    this.restartHit.eventMode = "static";
    this.restartHit.cursor = "pointer";

    this.restartHit.on("pointerover", () => {
      this.restartHit.alpha = 0.8;
    });

    this.restartHit.on("pointerout", () => {
      this.restartHit.alpha = 1;
    });

    this.soundToggle = makeSoundToggle(this.game.audio);
    this.hint = makeControlsHint();

    this.container.addChild(
      this.bg,
      this.dead,
      this.interface,
      this.scoreText,
      this.restartHit,
      this.soundToggle,
      this.hint
    );
  }

  update(dt) {
    super.update(dt);
    this.dead.rotation = Math.sin(this.elapsed * 1.5) * 0.08;
    this.dead.y = 830 + Math.sin(this.elapsed * 1.8) * 10;
    this.game.audio.update(dt, this.elapsed, "gameover", 0.42);
  }
}
