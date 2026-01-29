import {
  BACKGROUND_IMAGE_SRC,
  loadEnvironmentSprites,
  loadImage,
  loadSpriteSheet,
  WALL_TILE_WEIGHTS,
} from "./assets.js";
import {
  HERO_ANIM,
  HUMAN_ANIM,
  PROJECTILE_ANIM,
  PROJECTILE_ROTATION_OFFSET,
  clipDuration,
  clipFrameIndex,
} from "./animation.js";
import {
  STORAGE_KEYS,
  cloneConfig,
  deepMerge,
  getConfigValue,
  setConfigValue,
  clampConfigValue,
} from "./config.js";
import {
  GameConfig,
  GameFeature,
  GameLike,
  GameMode,
  Hero,
  Human,
  HumanJumpPhase,
  ImageAsset,
  Platform,
  Projectile,
  ScoreEntry,
  SpriteSheetAsset,
} from "./types.js";
import {
  clamp,
  easeInOut,
  formatScore,
  lerp,
  randRange,
  toTitleCase,
} from "./utils.js";

type SettingsElements = {
  inputs: HTMLInputElement[];
  valueLabels: HTMLElement[];
};

class BonusCrawlerFeature implements GameFeature {
  id = "bonus-crawler";
  private y = 0;
  private active = false;
  private respawnTimer = 0;
  private flashTime = 0;

  update(dt: number, game: GameLike): void {
    const config = game.config.features;
    if (!config.bonusCrawler) {
      this.active = false;
      this.respawnTimer = 0;
      return;
    }

    if (!this.active) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
        this.y = -2;
      }
      return;
    }

    this.y += config.bonusSpeed * dt;
    if (this.y > game.maxAltitude + game.viewHeightMeters) {
      this.active = false;
      this.respawnTimer = config.bonusRespawn;
    }

    if (this.flashTime > 0) {
      this.flashTime = Math.max(0, this.flashTime - dt);
    }
  }

  onProjectile(projectile: Projectile, game: GameLike): boolean {
    if (!this.active) {
      return false;
    }

    const crawlerX = 0.25;
    const dx = projectile.pos.x - crawlerX;
    const dy = projectile.pos.y - this.y;
    const hitRadius = 0.35;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      this.active = false;
      this.flashTime = 0.35;
      this.respawnTimer = game.config.features.bonusRespawn;
      game.addPlatforms(game.config.features.bonusReward);
      return true;
    }

    return false;
  }

  render(ctx: CanvasRenderingContext2D, game: GameLike): void {
    if (!this.active && this.flashTime <= 0) {
      return;
    }

    const wallX = game.wallScreenX;
    const screenY = game.worldToScreenY(this.y);

    ctx.save();
    ctx.translate(wallX + 16, screenY);

    const pulse = this.flashTime > 0 ? 1 + this.flashTime * 2 : 1;
    ctx.scale(pulse, pulse);

    ctx.beginPath();
    ctx.fillStyle =
      this.flashTime > 0
        ? "rgba(255, 179, 71, 0.9)"
        : "rgba(57, 245, 154, 0.9)";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(5, 8, 14, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(6, 8);
    ctx.moveTo(6, -8);
    ctx.lineTo(-6, 8);
    ctx.stroke();

    ctx.restore();
  }

  onReset(game: GameLike): void {
    this.active = false;
    this.respawnTimer = game.config.features.bonusRespawn;
    this.flashTime = 0;
  }
}

export class Game implements GameLike {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  config: GameConfig;
  mode: GameMode = "playing";

  width = 0;
  height = 0;
  /** Screen X position of the wall ruler (px). */
  wallScreenX = 80;
  /** Pixels per meter. */
  meterPx = 120;
  /** Screen Y for world y=0 (px). */
  originY = 0;
  /** Camera base height in world meters. */
  cameraY = 0;
  /** Visible vertical span in meters. */
  viewHeightMeters = 6;
  /** Highest reached altitude, used for off-screen culling. */
  maxAltitude = 0;
  /** Static base platform height (m). */
  basePlatformY = 0;
  /** Trampoline ground height for the hero (m). */
  heroGroundY = 0;

  hero: Hero;
  human: Human;
  platforms: Platform[] = [];
  projectiles: Projectile[] = [];
  features: GameFeature[] = [];

  platformsLeft = 0;
  score = 0;
  lastThrowAt = 0;
  time = 0;

  promptTimer = 0;
  lastFrame = 0;

  scoreValue: HTMLElement;
  platformIcons: HTMLElement;
  prompt: HTMLElement;
  gameover: HTMLElement;
  finalScore: HTMLElement;
  leaderboard: HTMLElement;
  leaderboardList: HTMLElement;
  settingsPanel: HTMLElement;
  settingsInputs: HTMLInputElement[] = [];
  settingsValueLabels: HTMLElement[] = [];
  sprites: {
    human: SpriteSheetAsset;
    hero: SpriteSheetAsset;
    projectile: SpriteSheetAsset;
  };
  background: ImageAsset;
  environment: {
    wallTiles: ImageAsset[];
    wallWeights: number[];
    trampoline: ImageAsset;
  };
  humanIdleClipIndex = 0;
  humanIdleClipSource: "loop" | "oneShot" = "loop";
  humanIdleClipStartedAt = 0;
  humanIdleNextSwitch = 0;
  humanIdleElapsed = 0;
  heroThrowChargeElapsed = 0;
  heroThrowCharging = false;
  heroThrowReleaseElapsed = 0;
  heroThrowReleaseActive = false;
  heroBounceElapsed = 0;
  heroBounceActive = false;
  heroBounceTriggered = false;
  heroTurnElapsed = 0;
  heroTurnActive = false;
  heroPrevVelY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }
    this.ctx = ctx;

    this.config = this.loadConfig();

    this.hero = {
      pos: { x: 3.1, y: this.heroGroundY },
      vel: { x: 0, y: 0 },
      squish: 0,
    };

    this.human = {
      y: 0,
      state: "idle",
      jumpPhase: "prep",
      jumpPhaseTime: 0,
      jumpStart: 0,
      jumpTarget: 0,
      jumpTime: 0,
      worryTime: 0,
    };

    this.scoreValue = document.getElementById("score-value") as HTMLElement;
    this.platformIcons = document.getElementById(
      "platform-icons",
    ) as HTMLElement;
    this.prompt = document.getElementById("prompt") as HTMLElement;
    this.gameover = document.getElementById("gameover") as HTMLElement;
    this.finalScore = document.getElementById("final-score") as HTMLElement;
    this.leaderboard = document.getElementById("leaderboard") as HTMLElement;
    this.leaderboardList = document.getElementById(
      "leaderboard-list",
    ) as HTMLElement;
    this.settingsPanel = document.getElementById("settings") as HTMLElement;
    const settingsElements = this.readSettingsElements();
    this.settingsInputs = settingsElements.inputs;
    this.settingsValueLabels = settingsElements.valueLabels;

    this.sprites = {
      human: loadSpriteSheet(HUMAN_ANIM.sheet),
      hero: loadSpriteSheet(HERO_ANIM.sheet),
      projectile: loadSpriteSheet(PROJECTILE_ANIM.sheet),
    };
    this.background = loadImage(BACKGROUND_IMAGE_SRC);
    this.environment = loadEnvironmentSprites();

    this.bindUi();
    this.bindSettings();
    this.bindControls();

    this.resetGame();
    this.resize();

    window.addEventListener("resize", () => this.resize());
  }

  readSettingsElements(): SettingsElements {
    return {
      inputs: Array.from(
        this.settingsPanel.querySelectorAll<HTMLInputElement>("[data-path]"),
      ),
      valueLabels: Array.from(
        this.settingsPanel.querySelectorAll<HTMLElement>("[data-value]"),
      ),
    };
  }

  loadConfig(): GameConfig {
    const saved = localStorage.getItem(STORAGE_KEYS.config);
    if (!saved) {
      return cloneConfig();
    }

    try {
      const parsed = JSON.parse(saved) as Partial<GameConfig>;
      return deepMerge(cloneConfig(), parsed);
    } catch (error) {
      console.warn("Failed to parse config", error);
      return cloneConfig();
    }
  }

  saveConfig(): void {
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(this.config));
  }

  bindUi(): void {
    const restartButton = document.getElementById("restart") as HTMLButtonElement;
    const showLeaderboard = document.getElementById(
      "show-leaderboard",
    ) as HTMLButtonElement;
    const saveScore = document.getElementById("save-score") as HTMLButtonElement;
    const closeLeaderboard = document.getElementById(
      "close-leaderboard",
    ) as HTMLButtonElement;
    const settingsToggle = document.getElementById(
      "settings-toggle",
    ) as HTMLButtonElement;
    const settingsReset = document.getElementById(
      "settings-reset",
    ) as HTMLButtonElement | null;

    restartButton.addEventListener("click", () => this.resetGame());
    showLeaderboard.addEventListener("click", () => this.openLeaderboard());
    saveScore.addEventListener("click", () => this.saveScore());
    closeLeaderboard.addEventListener("click", () => this.closeLeaderboard());
    settingsToggle.addEventListener("click", () => this.toggleSettings());
    settingsReset?.addEventListener("click", () => this.resetSettings());
  }

  bindSettings(): void {
    this.settingsInputs.forEach((input) => {
      const path = input.dataset.path;
      if (!path) {
        return;
      }

      input.addEventListener("input", () => {
        const nextValue =
          input.type === "checkbox"
            ? input.checked
            : clampConfigValue(Number(input.value));
        setConfigValue(this.config, path, nextValue);
        if (path === "platform.count") {
          if (typeof nextValue === "number") {
            this.platformsLeft = Math.min(
              this.platformsLeft,
              Math.floor(nextValue),
            );
          }
          this.refreshPlatformIcons();
        }
        this.updateSettingsLabels();
        this.saveConfig();
      });
    });

    this.syncSettingsInputs();
  }

  updateSettingsLabels(): void {
    this.settingsValueLabels.forEach((label) => {
      const path = label.dataset.value;
      if (!path) {
        return;
      }
      const value = getConfigValue(this.config, path);
      label.textContent =
        typeof value === "number"
          ? Number.isInteger(value)
            ? String(value)
            : value.toFixed(2)
          : value
            ? "on"
            : "off";
    });
  }

  syncSettingsInputs(): void {
    this.settingsInputs.forEach((input) => {
      const path = input.dataset.path;
      if (!path) {
        return;
      }
      const value = getConfigValue(this.config, path);
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else {
        input.value = String(value);
      }
    });
    this.updateSettingsLabels();
  }

  bindControls(): void {
    window.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("button") || target.closest("input") || target.closest("#settings")) {
        return;
      }
      if (this.mode === "playing") {
        this.startHeroThrowCharge();
      }
    });

    window.addEventListener("pointerup", () => {
      this.releaseHeroThrow();
    });

    window.addEventListener("pointercancel", () => {
      this.releaseHeroThrow();
    });

    window.addEventListener("keydown", (event) => {
      if (event.repeat) {
        return;
      }
      if (event.code === "Space" || event.code === "Enter") {
        this.startHeroThrowCharge();
      }
      if (event.code === "KeyR") {
        this.resetGame();
      }
      if (event.code === "KeyS") {
        this.toggleSettings();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "Space" || event.code === "Enter") {
        this.releaseHeroThrow();
      }
    });
  }

  startHeroThrowCharge(): void {
    if (this.mode !== "playing") {
      return;
    }
    if (this.platformsLeft <= 0) {
      return;
    }
    if (this.time - this.lastThrowAt < this.config.throwing.cooldown) {
      return;
    }
    if (this.heroThrowCharging) {
      return;
    }

    this.heroThrowCharging = true;
    this.heroThrowChargeElapsed = 0;
    this.heroTurnActive = false;
    this.heroTurnElapsed = 0;
  }

  releaseHeroThrow(): void {
    if (!this.heroThrowCharging) {
      return;
    }
    this.heroThrowCharging = false;
    if (this.throwPlatform()) {
      this.heroThrowReleaseElapsed = 0;
      this.heroThrowReleaseActive = true;
    }
  }

  toggleSettings(): void {
    this.settingsPanel.classList.toggle("hidden");
  }

  resetSettings(): void {
    this.config = cloneConfig();
    this.saveConfig();
    this.platformsLeft = Math.min(this.platformsLeft, this.config.platform.count);
    this.syncSettingsInputs();
    this.refreshPlatformIcons();
  }

  resetGame(): void {
    this.mode = "playing";
    this.time = 0;
    this.platforms = [];
    this.projectiles = [];
    this.features = [new BonusCrawlerFeature()];
    this.features.forEach((feature) => feature.onReset?.(this));

    this.platformsLeft = this.config.platform.count;
    this.hero.pos = { x: 3.1, y: this.heroGroundY };
    this.hero.vel = { x: 0, y: 0 };
    this.hero.squish = 0;
    this.heroThrowChargeElapsed = 0;
    this.heroThrowCharging = false;
    this.heroThrowReleaseElapsed = 0;
    this.heroThrowReleaseActive = false;
    this.heroBounceElapsed = 0;
    this.heroBounceActive = false;
    this.heroBounceTriggered = false;
    this.heroTurnElapsed = 0;
    this.heroTurnActive = false;
    this.heroPrevVelY = 0;

    const initialPlatformY = this.config.human.jumpThreshold;
    this.human.y = initialPlatformY;
    this.human.state = "idle";
    this.human.jumpPhase = "prep";
    this.human.jumpPhaseTime = 0;
    this.human.jumpStart = initialPlatformY;
    this.human.jumpTarget = initialPlatformY;
    this.human.jumpTime = 0;
    this.human.worryTime = 0;
    this.humanIdleClipIndex = 0;
    this.humanIdleClipSource = "loop";
    this.humanIdleClipStartedAt = this.time;
    this.humanIdleNextSwitch = this.time;
    this.humanIdleElapsed = 0;

    this.score = 0;
    this.maxAltitude = 0;
    this.cameraY = 0;
    this.promptTimer = this.config.ui.promptDuration;
    this.lastThrowAt = 0;

    this.gameover.classList.add("hidden");
    this.closeLeaderboard();
    this.refreshPlatformIcons();
    this.updateScoreUi();

    const stuckFrame = clipFrameIndex(
      PROJECTILE_ANIM.flight,
      Math.max(0, PROJECTILE_ANIM.flight.length - 1),
      PROJECTILE_ANIM.sheet.columns,
    );
    this.platforms.push({
      id: Date.now() + Math.random(),
      y: initialPlatformY,
      createdAt: this.time - 1,
      spriteFrame: stuckFrame,
      rotation: 0,
    });
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.meterPx = clamp(this.width * 0.12, 90, 150);
    this.wallScreenX = clamp(this.width * 0.08, 50, 110);
    this.originY = this.height - clamp(this.height * 0.2, 90, 160);
    this.viewHeightMeters = (this.originY + 30) / this.meterPx;
  }

  worldToScreenX(x: number): number {
    return this.wallScreenX + x * this.meterPx;
  }

  worldToScreenY(y: number): number {
    return this.originY - (y - this.cameraY) * this.meterPx;
  }

  throwPlatform(): boolean {
    const now = this.time;
    if (this.mode !== "playing") {
      return false;
    }
    if (this.platformsLeft <= 0) {
      return false;
    }
    if (now - this.lastThrowAt < this.config.throwing.cooldown) {
      return false;
    }

    const startX = this.hero.pos.x - 0.2;
    const gravity = this.config.physics.gravity * 0.85;
    const arcHeight = randRange(0.35, 0.75);
    const arcVy = Math.sqrt(2 * gravity * arcHeight);
    const projectile: Projectile = {
      id: Date.now() + Math.random(),
      pos: { x: startX, y: this.hero.pos.y + 0.6 },
      vel: {
        x: -this.config.throwing.speed,
        y: arcVy,
      },
      rotation:
        Math.atan2(arcVy, -this.config.throwing.speed) +
        PROJECTILE_ROTATION_OFFSET,
      startX,
      age: 0,
      active: true,
    };

    this.projectiles.push(projectile);
    this.platformsLeft -= 1;
    this.lastThrowAt = now;
    this.promptTimer = 0;

    this.refreshPlatformIcons();
    return true;
  }

  addPlatforms(amount: number): void {
    this.platformsLeft = Math.min(
      this.config.platform.count,
      this.platformsLeft + amount,
    );
    this.refreshPlatformIcons();
  }

  update(dt: number): void {
    if (this.mode !== "playing") {
      return;
    }

    this.time += dt;
    this.promptTimer = Math.max(0, this.promptTimer - dt);

    this.updateHero(dt);
    this.updateHeroAnimation(dt);
    this.updateProjectiles(dt);
    this.updateHuman(dt);
    this.updateCamera(dt);

    this.maxAltitude = Math.max(this.maxAltitude, this.hero.pos.y, this.human.y);

    for (const feature of this.features) {
      feature.update(dt, this);
    }

    this.score = Math.max(this.score, this.human.y);
    this.updateScoreUi();

    if (this.platformsLeft <= 0 && this.projectiles.length === 0 && this.human.state === "idle") {
      this.endGame();
    }
  }

  updateHero(dt: number): void {
    const prevVelY = this.hero.vel.y;
    this.heroPrevVelY = prevVelY;

    this.hero.vel.y -= this.config.physics.gravity * dt;
    this.hero.pos.y += this.hero.vel.y * dt;

    if (prevVelY > 0 && this.hero.vel.y <= 0) {
      if (!this.heroThrowCharging && !this.heroThrowReleaseActive) {
        this.heroTurnActive = true;
        this.heroTurnElapsed = 0;
      }
    }

    const bounceLead = 0.25;
    const nearGround = this.hero.pos.y <= this.heroGroundY + bounceLead;
    if (this.hero.vel.y < 0 && nearGround && !this.heroBounceTriggered) {
      this.heroBounceTriggered = true;
      this.heroBounceActive = true;
      this.heroBounceElapsed = 0;
      this.heroThrowCharging = false;
    }

    if (this.hero.pos.y <= this.heroGroundY) {
      this.hero.pos.y = this.heroGroundY;
      this.hero.squish = 1;
      this.heroBounceTriggered = true;
      if (!this.heroBounceActive) {
        this.heroBounceActive = true;
        this.heroBounceElapsed = 0;
      }
      this.heroThrowCharging = false;

      const peakBase = this.human.y + this.config.hero.peakOffset;
      const desiredApex = Math.max(
        this.config.hero.minPeak,
        peakBase + randRange(-this.config.hero.peakRandomness, this.config.hero.peakRandomness),
      );
      const heightFromGround = Math.max(0.1, desiredApex - this.heroGroundY);
      const desiredVy = Math.sqrt(2 * this.config.physics.gravity * heightFromGround);
      this.hero.vel.y = desiredVy;
    }

    if (this.hero.vel.y > 0 && this.hero.pos.y > this.heroGroundY + bounceLead) {
      this.heroBounceTriggered = false;
    }

    this.hero.squish = Math.max(0, this.hero.squish - dt * 2.8);
  }

  updateHeroAnimation(dt: number): void {
    if (this.heroThrowCharging) {
      const duration = clipDuration(HERO_ANIM.throwCharge);
      this.heroThrowChargeElapsed = Math.min(duration, this.heroThrowChargeElapsed + dt);
      this.heroTurnActive = false;
      this.heroTurnElapsed = 0;
    }

    if (this.heroThrowReleaseActive) {
      this.heroThrowReleaseElapsed += dt;
      if (this.heroThrowReleaseElapsed >= clipDuration(HERO_ANIM.throwRelease)) {
        this.heroThrowReleaseActive = false;
      }
    }

    if (this.heroBounceActive) {
      this.heroBounceElapsed += dt;
      if (this.heroBounceElapsed >= clipDuration(HERO_ANIM.bounce)) {
        this.heroBounceActive = false;
      }
    }

    if (this.heroTurnActive) {
      this.heroTurnElapsed += dt;
      if (this.heroTurnElapsed >= clipDuration(HERO_ANIM.turn)) {
        this.heroTurnActive = false;
      }
    }
  }

  updateProjectiles(dt: number): void {
    const gravity = this.config.physics.gravity * 0.85;
    const wallX = 0;

    for (const projectile of this.projectiles) {
      if (!projectile.active) {
        continue;
      }

      projectile.age += dt;
      projectile.vel.y -= gravity * dt;
      projectile.pos.x += projectile.vel.x * dt;
      projectile.pos.y += projectile.vel.y * dt;
      projectile.rotation =
        Math.atan2(projectile.vel.y, projectile.vel.x) + PROJECTILE_ROTATION_OFFSET;

      for (const feature of this.features) {
        if (feature.onProjectile?.(projectile, this)) {
          projectile.active = false;
          break;
        }
      }

      if (!projectile.active) {
        continue;
      }

      if (projectile.pos.x <= wallX) {
        const platformY = Math.max(0, projectile.pos.y);
        const stuckFrame = clipFrameIndex(
          PROJECTILE_ANIM.flight,
          Math.max(0, PROJECTILE_ANIM.flight.length - 1),
          PROJECTILE_ANIM.sheet.columns,
        );
        this.platforms.push({
          id: Date.now() + Math.random(),
          y: platformY,
          createdAt: this.time,
          spriteFrame: stuckFrame,
          rotation: projectile.rotation,
        });
        projectile.active = false;
        this.handlePlatformPlacement(platformY);
      }

      if (projectile.pos.y < -2 || projectile.pos.y > this.cameraY + this.viewHeightMeters + 6) {
        projectile.active = false;
      }
    }

    this.projectiles = this.projectiles.filter((projectile) => projectile.active);
  }

  handlePlatformPlacement(platformY: number): void {
    if (this.human.state === "jumping") {
      return;
    }
    if (this.attemptHumanJump()) {
      return;
    }

    this.human.state = "worry";
    this.human.worryTime = this.config.human.worryDuration;
    this.pickIdleClip("oneShot");
  }

  updateHuman(dt: number): void {
    if (this.human.state === "jumping") {
      if (this.human.jumpPhase === "prep") {
        const prepDuration = clipDuration(HUMAN_ANIM.jump.prep);
        this.human.jumpPhaseTime += dt;
        this.human.y = this.human.jumpStart;
        if (this.human.jumpPhaseTime >= prepDuration) {
          const overflow = this.human.jumpPhaseTime - prepDuration;
          this.human.jumpPhase = "ascend";
          this.human.jumpPhaseTime = 0;
          this.human.jumpTime = 0;
          if (overflow > 0) {
            this.advanceHumanJump(overflow);
          }
        }
      } else {
        this.advanceHumanJump(dt);
      }
    }

    if (this.human.state === "worry") {
      this.human.worryTime = Math.max(0, this.human.worryTime - dt);
      if (this.human.worryTime <= 0) {
        this.human.state = "idle";
      }
    }

    if (this.human.state === "idle") {
      this.attemptHumanJump();
    }

    this.updateHumanIdleAnimation(dt);
  }

  advanceHumanJump(dt: number): void {
    this.human.jumpTime += dt;
    const t = clamp(this.human.jumpTime / this.config.human.jumpDuration, 0, 1);
    const eased = easeInOut(t);
    const arc = Math.sin(t * Math.PI) * this.config.human.jumpArc;
    this.human.y = lerp(this.human.jumpStart, this.human.jumpTarget, eased) + arc;

    const landRatio = clamp(HUMAN_ANIM.jump.landRatio, 0, 1);
    let nextPhase: HumanJumpPhase;
    if (t >= landRatio) {
      nextPhase = "land";
    } else if (t >= 0.5) {
      nextPhase = "descend";
    } else {
      nextPhase = "ascend";
    }

    if (nextPhase !== this.human.jumpPhase) {
      this.human.jumpPhase = nextPhase;
      this.human.jumpPhaseTime = 0;
    } else {
      this.human.jumpPhaseTime += dt;
    }

    if (t >= 1) {
      this.human.state = "idle";
      this.human.jumpPhase = "land";
      this.human.jumpPhaseTime = 0;
      this.human.y = this.human.jumpTarget;
      this.humanIdleElapsed = 0;
      this.humanIdleClipStartedAt = this.time;
      this.humanIdleNextSwitch = this.time;
    }
  }

  updateCamera(dt: number): void {
    const target = Math.max(0, this.hero.pos.y - this.config.camera.offset);
    this.cameraY = lerp(this.cameraY, target, clamp(dt * this.config.camera.followSpeed, 0, 1));
  }

  findReachablePlatform(): Platform | null {
    let candidate: Platform | null = null;
    for (const platform of this.platforms) {
      if (platform.y <= this.human.y) {
        continue;
      }
      const delta = platform.y - this.human.y;
      if (delta <= this.config.human.jumpThreshold) {
        if (!candidate || platform.y > candidate.y) {
          candidate = platform;
        }
      }
    }
    return candidate;
  }

  attemptHumanJump(): boolean {
    if (this.human.state === "jumping") {
      return false;
    }
    const target = this.findReachablePlatform();
    if (!target) {
      return false;
    }

    this.human.state = "jumping";
    this.human.jumpPhase = "prep";
    this.human.jumpPhaseTime = 0;
    this.human.jumpStart = this.human.y;
    this.human.jumpTarget = target.y;
    this.human.jumpTime = 0;
    this.human.worryTime = 0;
    this.humanIdleElapsed = 0;
    return true;
  }

  updateHumanIdleAnimation(dt: number): void {
    if (this.human.state === "jumping") {
      this.humanIdleElapsed = 0;
      return;
    }

    this.humanIdleElapsed += dt;
    if (this.humanIdleElapsed < HUMAN_ANIM.idle.delayAfterLand) {
      return;
    }

    if (this.time >= this.humanIdleNextSwitch) {
      this.pickIdleClip();
    }
  }

  pickIdleClip(force?: "loop" | "oneShot"): void {
    const idle = HUMAN_ANIM.idle;
    const wantsOneShot = force ? force === "oneShot" : Math.random() < idle.oneShotChance;
    let clips = wantsOneShot ? idle.oneShotClips : idle.loopClips;
    let source: "loop" | "oneShot" = wantsOneShot ? "oneShot" : "loop";
    if (clips.length === 0) {
      clips = wantsOneShot ? idle.loopClips : idle.oneShotClips;
      source = source === "oneShot" ? "loop" : "oneShot";
    }
    if (clips.length === 0) {
      return;
    }

    let nextIndex = Math.floor(Math.random() * clips.length);
    if (clips.length > 1 && source === this.humanIdleClipSource && nextIndex === this.humanIdleClipIndex) {
      nextIndex = (nextIndex + 1) % clips.length;
    }

    const clip = clips[nextIndex];
    this.humanIdleClipIndex = nextIndex;
    this.humanIdleClipSource = source;
    this.humanIdleClipStartedAt = this.time;
    this.humanIdleNextSwitch =
      source === "loop" ? this.time + randRange(idle.minHold, idle.maxHold) : this.time + clipDuration(clip);
  }

  updateScoreUi(): void {
    this.scoreValue.textContent = formatScore(this.score);
    if (this.promptTimer > 0) {
      this.prompt.classList.remove("hidden");
    } else {
      this.prompt.classList.add("hidden");
    }
  }

  endGame(): void {
    this.mode = "gameover";
    this.finalScore.textContent = `${formatScore(this.score)} m`;
    this.gameover.classList.remove("hidden");
  }

  refreshPlatformIcons(): void {
    const count = this.platformsLeft;
    const total = Math.max(this.config.platform.count, this.platformsLeft);

    this.platformIcons.innerHTML = "";
    for (let i = 0; i < total; i += 1) {
      const icon = document.createElement("div");
      icon.className = "platform-icon" + (i >= count ? " used" : "");
      this.platformIcons.appendChild(icon);
    }
  }

  openLeaderboard(): void {
    this.renderLeaderboard();
    this.leaderboard.classList.remove("hidden");
  }

  closeLeaderboard(): void {
    this.leaderboard.classList.add("hidden");
  }

  renderLeaderboard(): void {
    const entries = this.loadScores();
    if (entries.length === 0) {
      this.leaderboardList.innerHTML = "<div class=\"leaderboard-row\">No scores yet</div>";
      return;
    }

    this.leaderboardList.innerHTML = entries
      .map((entry, index) => {
        const name = toTitleCase(entry.name);
        return `<div class=\"leaderboard-row\"><span>#${index + 1} ${name}</span><span>${formatScore(
          entry.score,
        )} m</span></div>`;
      })
      .join("");
  }

  saveScore(): void {
    const name = this.resolvePlayerName();
    if (!name) {
      return;
    }

    const entries = this.loadScores();
    entries.push({ name, score: this.score, timestamp: Date.now() });
    entries.sort((a, b) => b.score - a.score);
    const trimmed = entries.slice(0, 10);
    localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(trimmed));
    this.renderLeaderboard();
  }

  resolvePlayerName(): string | null {
    const webApp = window.Telegram?.WebApp;
    const user = webApp?.initDataUnsafe?.user;
    if (user) {
      return user.username || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Runner";
    }

    const input = window.prompt("Enter name for leaderboard", "Runner");
    if (!input) {
      return null;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.slice(0, 20);
  }

  loadScores(): ScoreEntry[] {
    const saved = localStorage.getItem(STORAGE_KEYS.scores);
    if (!saved) {
      return [];
    }
    try {
      return JSON.parse(saved) as ScoreEntry[];
    } catch (error) {
      console.warn("Failed to parse scores", error);
      return [];
    }
  }

  render(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackground();
    this.drawPlatforms();
    this.drawWall();
    this.drawTrampoline();
    this.drawHero();
    this.drawHuman();
    this.drawProjectiles();

    for (const feature of this.features) {
      feature.render(this.ctx, this);
    }
  }

  drawBackground(): void {
    if (this.background.loaded) {
      const image = this.background.image;
      const scale = Math.max(this.width / image.width, this.height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const offsetX = (this.width - drawWidth) / 2;
      const offsetY = (this.height - drawHeight) / 2;
      this.ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    } else {
      this.ctx.fillStyle = "#070a12";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  drawWall(): void {
    const wallWidth = this.wallScreenX;
    if (wallWidth <= 0) {
      return;
    }

    const tiles = this.environment.wallTiles;
    let baseTile: ImageAsset | null = null;
    for (const tile of tiles) {
      if (tile.loaded && tile.image.width > 0 && tile.image.height > 0) {
        baseTile = tile;
        break;
      }
    }

    if (baseTile) {
      const image = baseTile.image;
      const scale = wallWidth / image.width;
      const tileHeight = image.height * scale * 1.8;
      if (tileHeight > 1) {
        const rowHeightMeters = tileHeight / this.meterPx;
        const worldTop = this.cameraY + (this.originY - this.height) / this.meterPx;
        const worldBottom = this.cameraY + this.originY / this.meterPx;
        const startRow = Math.floor(worldTop / rowHeightMeters) - 1;
        const endRow = Math.ceil(worldBottom / rowHeightMeters) + 1;
        const blendHeight = Math.max(10, tileHeight * 0.12);
        for (let row = startRow; row <= endRow; row += 1) {
          const worldY = row * rowHeightMeters;
          const y = this.worldToScreenY(worldY);
          const tileIndex = this.pickWallTileIndex(row);
          const tile = tiles[tileIndex];
          const tileImage = tile && tile.loaded ? tile.image : image;
          this.ctx.drawImage(tileImage, 0, y, wallWidth, tileHeight);
          if (row > startRow) {
            const seamY = y;
            const gradient = this.ctx.createLinearGradient(
              0,
              seamY - blendHeight / 2,
              0,
              seamY + blendHeight / 2,
            );
            gradient.addColorStop(0, "rgba(7, 10, 14, 0)");
            gradient.addColorStop(0.5, "rgba(7, 10, 14, 0.35)");
            gradient.addColorStop(1, "rgba(7, 10, 14, 0)");
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, seamY - blendHeight / 2, wallWidth, blendHeight);
          }
        }
      } else {
        this.ctx.drawImage(image, 0, 0, wallWidth, this.height);
      }
    } else {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(16, 18, 26, 0.95)";
      this.ctx.fillRect(0, 0, wallWidth, this.height);
      this.ctx.fillStyle = "rgba(240, 248, 255, 0.12)";
      this.ctx.fillRect(wallWidth - 6, 0, 6, this.height);
      this.ctx.restore();
    }

  }

  drawPlatforms(): void {
    this.ctx.save();
    const sprite = this.sprites.projectile;
    for (const platform of this.platforms) {
      const embed = this.meterPx * 0.12;
      const x = this.wallScreenX + 10 - embed;
      const y = this.worldToScreenY(platform.y);
      const growTime = 0.22;
      const growProgress = clamp((this.time - platform.createdAt) / growTime, 0, 1);
      const grow = easeInOut(growProgress);

      if (sprite.loaded && sprite.frameWidth > 0 && sprite.frameHeight > 0 && platform.spriteFrame !== undefined) {
        const maxFrames = sprite.columns * sprite.rows;
        const safeFrame = clamp(platform.spriteFrame, 0, Math.max(0, maxFrames - 1));
        const column = safeFrame % sprite.columns;
        const row = Math.floor(safeFrame / sprite.columns);
        const sx = column * sprite.frameWidth;
        const sy = row * sprite.frameHeight;
        const width = sprite.width * this.meterPx;
        const height = sprite.height * this.meterPx;

        const glow = Math.min(1, (this.time - platform.createdAt) * 3);
        this.ctx.save();
        this.ctx.translate(x, y);
        if (platform.rotation) {
          this.ctx.rotate(platform.rotation);
        }
        this.ctx.scale(grow, grow);
        this.ctx.shadowColor = `rgba(57, 245, 154, ${0.35 + glow * 0.25})`;
        this.ctx.shadowBlur = 12;
        this.ctx.drawImage(
          sprite.image,
          sx,
          sy,
          sprite.frameWidth,
          sprite.frameHeight,
          -width * sprite.anchorX,
          -height * sprite.anchorY,
          width,
          height,
        );
        this.ctx.restore();
      } else {
        const width = this.config.platform.width * this.meterPx;
        const height = this.config.platform.height * this.meterPx;
        const growWidth = width * grow;
        const growHeight = height * grow;

        const glow = Math.min(1, (this.time - platform.createdAt) * 3);
        this.ctx.fillStyle = `rgba(57, 245, 154, ${0.6 + glow * 0.2})`;
        this.ctx.shadowColor = "rgba(57, 245, 154, 0.6)";
        this.ctx.shadowBlur = 12;
        this.ctx.fillRect(x, y - growHeight / 2, growWidth, growHeight);

        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = "rgba(5, 8, 14, 0.6)";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y - growHeight / 2, growWidth, growHeight);
      }
    }
    this.ctx.restore();
  }

  drawTrampoline(): void {
    const x = this.worldToScreenX(this.hero.pos.x);
    const y = this.worldToScreenY(this.heroGroundY);

    const squish = 1 - this.hero.squish * 0.3;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(1, squish);

    const asset = this.environment.trampoline;
    if (asset.loaded) {
      const width = this.meterPx * 1.15;
      const height = width * 0.5;
      const anchorY = 66 / 128;
      this.ctx.drawImage(asset.image, -width / 2, -height * anchorY, width, height);
    } else {
      this.ctx.scale(1.1, 1);
      this.ctx.beginPath();
      this.ctx.fillStyle = "rgba(230, 242, 252, 0.20)";
      this.ctx.strokeStyle = "rgba(230, 242, 252, 0.55)";
      this.ctx.lineWidth = 3;
      this.ctx.ellipse(0, 0, 40, 10, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  pickWallTileIndex(seed: number): number {
    const weights = this.environment.wallWeights.length
      ? this.environment.wallWeights
      : WALL_TILE_WEIGHTS;
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return 0;
    }

    let x = seed | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const value = Math.abs(x % 1000) / 1000;

    let cumulative = 0;
    for (let i = 0; i < weights.length; i += 1) {
      cumulative += weights[i] / total;
      if (value <= cumulative) {
        return i;
      }
    }
    return weights.length - 1;
  }

  drawHero(): void {
    const x = this.worldToScreenX(this.hero.pos.x);
    const y = this.worldToScreenY(this.hero.pos.y);
    const bodyWidth = this.meterPx * 0.5;
    const bodyHeight = this.meterPx * 0.8;
    const sprite = this.sprites.hero;

    this.ctx.save();
    this.ctx.translate(x, y);
    const bob = Math.sin(this.time * 4) * 3;
    this.ctx.translate(0, bob);

    if (sprite.loaded && sprite.frameWidth > 0 && sprite.frameHeight > 0) {
      const width = sprite.width * this.meterPx;
      const height = sprite.height * this.meterPx;
      const frameIndex = this.getHeroFrameIndex(sprite);
      const maxFrames = sprite.columns * sprite.rows;
      const safeFrame = clamp(frameIndex, 0, Math.max(0, maxFrames - 1));
      const column = safeFrame % sprite.columns;
      const row = Math.floor(safeFrame / sprite.columns);
      const sx = column * sprite.frameWidth;
      const sy = row * sprite.frameHeight;
      this.ctx.drawImage(
        sprite.image,
        sx,
        sy,
        sprite.frameWidth,
        sprite.frameHeight,
        -width * sprite.anchorX,
        -height * sprite.anchorY,
        width,
        height,
      );
    } else {
      this.ctx.translate(0, -bodyHeight * 0.6);

      this.ctx.fillStyle = "rgba(57, 245, 154, 0.8)";
      this.ctx.fillRect(-bodyWidth / 2, -bodyHeight * 0.1, bodyWidth, bodyHeight * 0.2);

      this.ctx.fillStyle = "rgba(50, 242, 255, 0.85)";
      this.ctx.shadowColor = "rgba(50, 242, 255, 0.6)";
      this.ctx.shadowBlur = 12;
      this.ctx.fillRect(-bodyWidth / 2, bodyHeight * 0.15, bodyWidth, bodyHeight * 0.65);

      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = "rgba(5, 8, 14, 0.8)";
      this.ctx.fillRect(-bodyWidth * 0.3, bodyHeight * 0.25, bodyWidth * 0.6, bodyHeight * 0.3);

      this.ctx.fillStyle = "rgba(255, 179, 71, 0.9)";
      this.ctx.fillRect(-bodyWidth * 0.2, bodyHeight * 0.3, bodyWidth * 0.4, bodyHeight * 0.08);
    }

    this.ctx.restore();
  }

  drawHuman(): void {
    const x = this.worldToScreenX(0.45);
    const y = this.worldToScreenY(this.human.y);
    const wobble =
      this.human.state === "worry" ? Math.sin(this.time * 12) * 3 : Math.sin(this.time * 2) * 1.5;
    const sprite = this.sprites.human;
    if (sprite.loaded && sprite.frameWidth > 0 && sprite.frameHeight > 0) {
      const width = sprite.width * this.meterPx;
      const height = sprite.height * this.meterPx;
      const frameIndex = this.getHumanFrameIndex(sprite);
      const maxFrames = sprite.columns * sprite.rows;
      const safeFrame = clamp(frameIndex, 0, Math.max(0, maxFrames - 1));
      const column = safeFrame % sprite.columns;
      const row = Math.floor(safeFrame / sprite.columns);
      const sx = column * sprite.frameWidth;
      const sy = row * sprite.frameHeight;
      this.ctx.save();
      this.ctx.translate(x + wobble, y);
      this.ctx.drawImage(
        sprite.image,
        sx,
        sy,
        sprite.frameWidth,
        sprite.frameHeight,
        -width * sprite.anchorX,
        -height * sprite.anchorY,
        width,
        height,
      );
      this.ctx.restore();
    } else {
      const bodyWidth = this.meterPx * 0.16;
      const bodyHeight = this.meterPx * 0.32;
      const headSize = this.meterPx * 0.18;

      this.ctx.save();
      this.ctx.translate(x + wobble, y - this.meterPx * 0.2);

      this.ctx.fillStyle = "rgba(255, 111, 110, 0.9)";
      this.ctx.shadowColor = "rgba(255, 111, 110, 0.6)";
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(-bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight);

      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = "rgba(230, 244, 255, 0.9)";
      this.ctx.fillRect(-headSize / 2, -bodyHeight - headSize, headSize, headSize);

      this.ctx.strokeStyle = "rgba(230, 244, 255, 0.5)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(-bodyWidth * 0.8, -bodyHeight * 0.4);
      this.ctx.lineTo(-bodyWidth * 1.2, bodyHeight * 0.2);
      this.ctx.moveTo(bodyWidth * 0.8, -bodyHeight * 0.4);
      this.ctx.lineTo(bodyWidth * 1.2, bodyHeight * 0.2);
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  getHeroFrameIndex(sprite: SpriteSheetAsset): number {
    if (this.heroBounceActive) {
      const frame = Math.min(
        HERO_ANIM.bounce.length - 1,
        Math.floor(this.heroBounceElapsed * HERO_ANIM.bounce.fps),
      );
      return clipFrameIndex(HERO_ANIM.bounce, frame, sprite.columns);
    }

    if (this.heroThrowReleaseActive) {
      const frame = Math.min(
        HERO_ANIM.throwRelease.length - 1,
        Math.floor(this.heroThrowReleaseElapsed * HERO_ANIM.throwRelease.fps),
      );
      return clipFrameIndex(HERO_ANIM.throwRelease, frame, sprite.columns);
    }

    if (this.heroThrowCharging) {
      const frame = Math.min(
        HERO_ANIM.throwCharge.length - 1,
        Math.floor(this.heroThrowChargeElapsed * HERO_ANIM.throwCharge.fps),
      );
      return clipFrameIndex(HERO_ANIM.throwCharge, frame, sprite.columns);
    }

    if (this.heroTurnActive) {
      const frame = Math.min(
        HERO_ANIM.turn.length - 1,
        Math.floor(this.heroTurnElapsed * HERO_ANIM.turn.fps),
      );
      return clipFrameIndex(HERO_ANIM.turn, frame, sprite.columns);
    }

    const idleClip = this.hero.vel.y >= 0 ? HERO_ANIM.idleUp : HERO_ANIM.idleDown;
    const idleFrame = idleClip.length > 1
      ? Math.floor((this.time * idleClip.fps) % idleClip.length)
      : 0;
    return clipFrameIndex(idleClip, idleFrame, sprite.columns);
  }

  getHumanFrameIndex(sprite: SpriteSheetAsset): number {
    if (this.human.state === "jumping") {
      let clip = HUMAN_ANIM.jump.prep;
      if (this.human.jumpPhase === "ascend") {
        clip = HUMAN_ANIM.jump.ascend;
      } else if (this.human.jumpPhase === "descend") {
        clip = HUMAN_ANIM.jump.descend;
      } else if (this.human.jumpPhase === "land") {
        clip = HUMAN_ANIM.jump.land;
      }
      const fps = Math.max(1, clip.fps);
      const frame = clip.length > 1
        ? Math.min(clip.length - 1, Math.floor(this.human.jumpPhaseTime * fps))
        : 0;
      return clipFrameIndex(clip, frame, sprite.columns);
    }

    const idle = HUMAN_ANIM.idle;
    const idleClips = this.humanIdleClipSource === "oneShot" ? idle.oneShotClips : idle.loopClips;
    let clip = idleClips[this.humanIdleClipIndex];
    if (!clip) {
      clip = idle.loopClips[0] ?? idle.oneShotClips[0];
    }
    if (!clip) {
      return 0;
    }
    const clipTime = Math.max(0, this.time - this.humanIdleClipStartedAt);
    const fps = Math.max(1, clip.fps);
    const isOneShot = this.humanIdleClipSource === "oneShot" || idle.loopClips.length === 0;
    const frame = clip.length > 1
      ? isOneShot
        ? Math.min(clip.length - 1, Math.floor(clipTime * fps))
        : Math.floor((clipTime * fps) % clip.length)
      : 0;
    return clipFrameIndex(clip, frame, sprite.columns);
  }

  drawProjectiles(): void {
    for (const projectile of this.projectiles) {
      const x = this.worldToScreenX(projectile.pos.x);
      const y = this.worldToScreenY(projectile.pos.y);
      const sprite = this.sprites.projectile;
      if (sprite.loaded && sprite.frameWidth > 0 && sprite.frameHeight > 0) {
        const span = Math.max(0.001, projectile.startX);
        const progress = clamp((projectile.startX - projectile.pos.x) / span, 0, 1);
        const frame = Math.min(
          PROJECTILE_ANIM.flight.length - 1,
          Math.floor(progress * PROJECTILE_ANIM.flight.length),
        );
        const frameIndex = clipFrameIndex(PROJECTILE_ANIM.flight, frame, sprite.columns);
        const column = frameIndex % sprite.columns;
        const row = Math.floor(frameIndex / sprite.columns);
        const sx = column * sprite.frameWidth;
        const sy = row * sprite.frameHeight;
        const width = sprite.width * this.meterPx;
        const height = sprite.height * this.meterPx;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(projectile.rotation);
        this.ctx.shadowColor = "rgba(50, 242, 255, 0.5)";
        this.ctx.shadowBlur = 8;
        this.ctx.drawImage(
          sprite.image,
          sx,
          sy,
          sprite.frameWidth,
          sprite.frameHeight,
          -width * sprite.anchorX,
          -height * sprite.anchorY,
          width,
          height,
        );
        this.ctx.restore();
      } else {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(projectile.rotation);
        this.ctx.fillStyle = "rgba(50, 242, 255, 0.8)";
        this.ctx.shadowColor = "rgba(50, 242, 255, 0.6)";
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -8);
        this.ctx.lineTo(18, 0);
        this.ctx.lineTo(0, 8);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  tick = (timestamp: number): void => {
    if (!this.lastFrame) {
      this.lastFrame = timestamp;
    }
    const dt = Math.min(0.033, (timestamp - this.lastFrame) / 1000);
    this.lastFrame = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.tick);
  };
}
