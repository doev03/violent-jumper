import { loadImage } from "./assets.js";
import { GameFeature, GameLike, Projectile } from "./types.js";
import { clamp, easeInOut, lerp } from "./utils.js";

type BonusIcicle = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  t: number;
  duration: number;
  arc: number;
};

const BONUS_TUNING = {
  sizeMeters: 0.825,
  idleFrames: 4,
  deathFrames: 4,
  idleFps: 6,
  deathFps: 12,
  hitRadius: 0.32,
  crawlerX: 0.22,
  spawnBelowScreen: 0.8,
  icicleSpread: 12,
  icicleArc: -26,
  icicleDuration: 0.6,
};

export class BonusCrawlerFeature implements GameFeature {
  id = "bonus-crawler";
  private y = 0;
  private state: "hidden" | "active" | "dying" = "hidden";
  private respawnTimer = 0;
  private idleTime = 0;
  private deathTime = 0;
  private readonly idleSprite = loadImage("assets/bonus-crawler-idle.svg");
  private readonly deathSprite = loadImage("assets/bonus-crawler-death.svg");
  private readonly counterSprite = loadImage("assets/platform-counter.png");
  private icicles: BonusIcicle[] = [];

  update(dt: number, game: GameLike): void {
    const config = game.config.features;
    if (!config.bonusCrawler) {
      this.state = "hidden";
      this.respawnTimer = 0;
      this.icicles = [];
      return;
    }

    if (this.state === "hidden") {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.state = "active";
        this.y = game.screenToWorldY(game.height) - BONUS_TUNING.spawnBelowScreen;
        this.idleTime = 0;
      }
    }

    if (this.state === "active") {
      this.y += config.bonusSpeed * dt;
      this.idleTime += dt;
      if (this.y > game.maxAltitude + game.viewHeightMeters) {
        this.state = "hidden";
        this.respawnTimer = config.bonusRespawn;
      }
    }

    if (this.state === "dying") {
      this.deathTime += dt;
      const deathDuration = BONUS_TUNING.deathFrames / BONUS_TUNING.deathFps;
      if (this.deathTime >= deathDuration) {
        this.state = "hidden";
      }
    }

    if (this.icicles.length > 0) {
      this.icicles = this.icicles.filter((icicle) => {
        icicle.t += dt;
        return icicle.t < icicle.duration;
      });
    }
  }

  onProjectile(projectile: Projectile, game: GameLike): boolean {
    if (this.state !== "active") {
      return false;
    }

    const dx = projectile.pos.x - BONUS_TUNING.crawlerX;
    const dy = projectile.pos.y - this.y;
    if (dx * dx + dy * dy <= BONUS_TUNING.hitRadius * BONUS_TUNING.hitRadius) {
      this.state = "dying";
      this.deathTime = 0;
      this.respawnTimer = game.config.features.bonusRespawn;
      const added = game.addPlatforms(game.config.features.bonusReward);
      const targets = game.getPlatformIconTargets(added);
      this.spawnIcicles(game, targets);
      game.stickProjectile(projectile);
      return true;
    }

    return false;
  }

  render(ctx: CanvasRenderingContext2D, game: GameLike): void {
    if (this.state === "hidden" && this.icicles.length === 0) {
      return;
    }

    if (this.state !== "hidden") {
      const screenY = game.worldToScreenY(this.y);
      const sprite = this.state === "dying" ? this.deathSprite : this.idleSprite;
      const frames = this.state === "dying"
        ? BONUS_TUNING.deathFrames
        : BONUS_TUNING.idleFrames;
      const fps = this.state === "dying" ? BONUS_TUNING.deathFps : BONUS_TUNING.idleFps;
      const frameIndex = this.state === "dying"
        ? Math.min(frames - 1, Math.floor(this.deathTime * fps))
        : Math.floor(this.idleTime * fps) % frames;
      const frameWidth = sprite.loaded ? sprite.image.width / frames : 64;
      const heightRatio = sprite.loaded ? sprite.image.height / frameWidth : 1;
      const width = BONUS_TUNING.sizeMeters * game.meterPx;
      const height = width * heightRatio;
      const centerX = game.wallScreenX + width * 0.05;

      if (sprite.loaded && sprite.image.width > 0) {
        const sx = frameIndex * frameWidth;
        ctx.drawImage(
          sprite.image,
          sx,
          0,
          frameWidth,
          sprite.image.height,
          centerX - width / 2,
          screenY - height / 2,
          width,
          height,
        );
      } else {
        ctx.save();
        ctx.translate(centerX, screenY);
        ctx.fillStyle = "rgba(76, 205, 252, 0.85)";
        ctx.beginPath();
        ctx.ellipse(0, 0, width * 0.35, height * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (this.icicles.length > 0) {
      const sprite = this.counterSprite;
      const hasSprite = sprite.loaded && sprite.image.width > 0;
      const ratio = hasSprite ? sprite.image.height / sprite.image.width : 2;
      for (const icicle of this.icicles) {
        const t = clamp(icicle.t / icicle.duration, 0, 1);
        const eased = easeInOut(t);
        const x = lerp(icicle.startX, icicle.endX, eased);
        const y = lerp(icicle.startY, icicle.endY, eased) + Math.sin(t * Math.PI) * icicle.arc;
        const width = 14;
        const height = width * ratio;
        if (hasSprite) {
          ctx.drawImage(
            sprite.image,
            x - width / 2,
            y - height / 2,
            width,
            height,
          );
        } else {
          ctx.save();
          ctx.fillStyle = "rgba(230, 244, 255, 0.9)";
          ctx.fillRect(x - width / 2, y - height / 2, width, height);
          ctx.restore();
        }
      }
    }
  }

  onReset(game: GameLike): void {
    this.state = "hidden";
    this.respawnTimer = game.config.features.bonusRespawn;
    this.idleTime = 0;
    this.deathTime = 0;
    this.icicles = [];
  }

  private spawnIcicles(game: GameLike, targets: { x: number; y: number }[]): void {
    if (targets.length === 0) {
      return;
    }
    const screenY = game.worldToScreenY(this.y);
    const startX = game.wallScreenX - 4;
    const spread = BONUS_TUNING.icicleSpread;
    const offset = (targets.length - 1) / 2;
    this.icicles = targets.map((target, index) => ({
      startX: startX + (index - offset) * spread,
      startY: screenY - 6,
      endX: target.x,
      endY: target.y,
      t: 0,
      duration: BONUS_TUNING.icicleDuration + index * 0.05,
      arc: BONUS_TUNING.icicleArc,
    }));
  }
}
