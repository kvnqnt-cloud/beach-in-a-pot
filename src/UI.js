export class MenuScene extends BaseScene {
  constructor(game) {
    super(game);
    this.bg = fullSprite(game.textures.titleBg);
    this.ui = fullSprite(game.textures.titleInterface);

    this.startHit = makeHitButton(960, 827, 330, 72, async () => {
      await this.game.audio.unlock();
      this.game.startRun();
    });

    // hover
    this.startHit.eventMode = "static";
    this.startHit.cursor = "pointer";

    this.startHit.on("pointerover", () => {
      this.startHit.alpha = 0.8;
    });

    this.startHit.on("pointerout", () => {
      this.startHit.alpha = 1;
    });

    this.soundToggle = makeSoundToggle(this.game.audio);

    // ❌ REMOVIDO
    // this.hint = makeControlsHint();

    this.container.addChild(
      this.bg,
      this.ui,
      this.startHit,
      this.soundToggle
      // ❌ this.hint removido daqui também
    );
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
