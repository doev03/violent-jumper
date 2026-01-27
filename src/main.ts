/** World-space coordinates in meters: x grows right, y grows up, wall is x=0, floor is y=0. */
type Vec2 = { x: number; y: number };

type GameMode = "playing" | "gameover";

type HumanState = "idle" | "jumping" | "worry";
type HumanJumpPhase = "prep" | "ascend" | "descend" | "land";

type ScoreEntry = {
  name: string;
  score: number;
  timestamp: number;
};

/** Game tuning knobs. Units are meters and seconds unless stated otherwise. */
type GameConfig = {
  physics: {
    /** Downward acceleration (m/s^2). */
    gravity: number;
  };
  throwing: {
    /** Initial horizontal throw speed (m/s). */
    speed: number;
    /** Minimum time between throws (s). */
    cooldown: number;
  };
  platform: {
    /** Total platforms available per run. */
    count: number;
    /** Platform width (m). */
    width: number;
    /** Platform height (m). */
    height: number;
  };
  hero: {
    /** Base offset from human height to hero apex (m). */
    peakOffset: number;
    /** Random apex variation (+/- meters). */
    peakRandomness: number;
    /** Absolute minimum apex height (m). */
    minPeak: number;
  };
  human: {
    /** Max vertical distance to auto-jump (m). */
    jumpThreshold: number;
    /** Jump animation duration (s). */
    jumpDuration: number;
    /** Extra arc height added during jump (m). */
    jumpArc: number;
    /** How long the worry reaction lasts (s). */
    worryDuration: number;
  };
  camera: {
    /** Vertical offset below the hero to keep in view (m). */
    offset: number;
    /** Smoothing speed for camera follow (1/s). */
    followSpeed: number;
  };
  features: {
    /** Enable the bonus crawler feature. */
    bonusCrawler: boolean;
    /** Platforms awarded for hitting the crawler. */
    bonusReward: number;
    /** Crawler vertical speed (m/s). */
    bonusSpeed: number;
    /** Delay before crawler respawns (s). */
    bonusRespawn: number;
  };
  ui: {
    /** Initial hint prompt duration (s). */
    promptDuration: number;
  };
};

type Platform = {
  id: number;
  /** Wall height where the platform is attached (m). */
  y: number;
  /** Timestamp when placed (s). */
  createdAt: number;
  /** Sprite frame index to render (if using a sprite sheet). */
  spriteFrame?: number;
  /** Rotation in radians for the sprite (optional). */
  rotation?: number;
};

type Projectile = {
  id: number;
  /** World position (m). */
  pos: Vec2;
  /** Velocity (m/s). */
  vel: Vec2;
  /** Rotation in radians. */
  rotation: number;
  /** Horizontal spawn position (m). */
  startX: number;
  /** Time since launch (s). */
  age: number;
  active: boolean;
};

type Hero = {
  /** World position (m). */
  pos: Vec2;
  /** World velocity (m/s). */
  vel: Vec2;
  /** Squash factor for trampoline impact (0..1). */
  squish: number;
};

type Human = {
  /** Current vertical position (m). */
  y: number;
  state: HumanState;
  /** Jump animation phase. */
  jumpPhase: HumanJumpPhase;
  /** Time spent in the current jump phase (s). */
  jumpPhaseTime: number;
  /** Jump start height (m). */
  jumpStart: number;
  /** Jump target height (m). */
  jumpTarget: number;
  /** Jump elapsed time (s). */
  jumpTime: number;
  /** Worry timer (s). */
  worryTime: number;
};

type GameFeature = {
  id: string;
  /** Update hook; dt is in seconds. */
  update: (dt: number, game: Game) => void;
  /** Draw hook; rendering is in screen space. */
  render: (ctx: CanvasRenderingContext2D, game: Game) => void;
  /** Called for each active projectile; return true to consume it. */
  onProjectile?: (projectile: Projectile, game: Game) => boolean;
  /** Reset hook called when a new run starts. */
  onReset?: (game: Game) => void;
};

/** Sprite sheet metadata in world meters with a bottom-center style anchor. */
type SpriteSheetSpec = {
  /** Image URL relative to index.html. */
  src: string;
  /** Number of columns in the sheet. */
  columns: number;
  /** Number of rows in the sheet. */
  rows: number;
  /** Width in world meters. */
  width: number;
  /** Height in world meters. */
  height: number;
  /** Anchor point (0..1) from left. */
  anchorX: number;
  /** Anchor point (0..1) from top. */
  anchorY: number;
};

type SpriteSheetAsset = SpriteSheetSpec & {
  image: HTMLImageElement;
  loaded: boolean;
  frameWidth: number;
  frameHeight: number;
};

type ImageAsset = {
  image: HTMLImageElement;
  loaded: boolean;
};

type ClipSpec = {
  /** Row index (0-based). */
  row: number;
  /** Start column index (0-based). */
  start: number;
  /** Number of frames in the clip. */
  length: number;
  /** Playback speed (frames per second). */
  fps: number;
};

type HumanAnimSpec = {
  sheet: SpriteSheetSpec;
  idle: {
    /** Looping idle clips. */
    loopClips: ClipSpec[];
    /** One-shot idle action clips. */
    oneShotClips: ClipSpec[];
    /** Probability to pick a one-shot clip (0..1). */
    oneShotChance: number;
    /** Minimum time to stay on a clip before switching (s). */
    minHold: number;
    /** Maximum time to stay on a clip before switching (s). */
    maxHold: number;
    /** Delay after landing before idle variations start (s). */
    delayAfterLand: number;
  };
  jump: {
    /** Prep + takeoff clip (played on the platform, no movement). */
    prep: ClipSpec;
    /** Single frame while moving up. */
    ascend: ClipSpec;
    /** Single frame while moving down. */
    descend: ClipSpec;
    /** Single frame just before landing. */
    land: ClipSpec;
    /** Ratio of the jump duration at which landing frame starts (0..1). */
    landRatio: number;
  };
};

type HeroAnimSpec = {
  sheet: SpriteSheetSpec;
  /** Idle looping animation while moving up. */
  idleUp: ClipSpec;
  /** Idle looping animation while moving down. */
  idleDown: ClipSpec;
  /** Bounce animation around trampoline contact. */
  bounce: ClipSpec;
  /** Turn animation at the apex. */
  turn: ClipSpec;
  /** Throw charge animation (holds on last frame). */
  throwCharge: ClipSpec;
  /** Throw release animation (plays once on release). */
  throwRelease: ClipSpec;
};

type ProjectileAnimSpec = {
  sheet: SpriteSheetSpec;
  /** Flight animation (last frame becomes the platform). */
  flight: ClipSpec;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: {
          user?: {
            username?: string;
            first_name?: string;
            last_name?: string;
          };
        };
      };
    };
  }
}

const STORAGE_KEYS = {
  scores: "neon_ladder_scores",
  config: "neon_ladder_config",
};

const DEFAULT_CONFIG: GameConfig = {
  physics: {
    gravity: 10,
  },
  throwing: {
    speed: 10.0,
    cooldown: 0.2,
  },
  platform: {
    count: 12,
    width: 0.85,
    height: 0.18,
  },
  hero: {
    peakOffset: 2,
    peakRandomness: 0.5,
    minPeak: 1.6,
  },
  human: {
    jumpThreshold: 1.6,
    jumpDuration: 0.55,
    jumpArc: 0.35,
    worryDuration: 0.6,
  },
  camera: {
    offset: 2.4,
    followSpeed: 5.6,
  },
  features: {
    bonusCrawler: true,
    bonusReward: 3,
    bonusSpeed: 1.7,
    bonusRespawn: 4,
  },
  ui: {
    promptDuration: 2,
  },
};

// NOTE: Update columns/clip lengths to match the real sprite sheet grid.
const HUMAN_ANIM: HumanAnimSpec = {
  sheet: {
    src: "assets/human-sheet-11.png",
    columns: 7,
    rows: 2,
    width: 1,
    height: 1.3,
    anchorX: 0.5,
    anchorY: 1.05,
  },
  idle: {
    loopClips: [
      { row: 0, start: 6, length: 1, fps: 1 },
      { row: 0, start: 1, length: 1, fps: 1 },
      { row: 0, start: 5, length: 1, fps: 1 },
      { row: 0, start: 5, length: 2, fps: 1 },
    ],
    oneShotClips: [
      { row: 0, start: 0, length: 1, fps: 1 },
      { row: 0, start: 1, length: 3, fps: 3 },
    ],
    oneShotChance: 0.35,
    minHold: 3.0,
    maxHold: 5.0,
    delayAfterLand: 0.4,
  },
  jump: {
    prep: { row: 1, start: 1, length: 1, fps: 10 },
    ascend: { row: 1, start: 2, length: 2, fps: 2 },
    descend: { row: 1, start: 4, length: 1, fps: 1 },
    land: { row: 1, start: 5, length: 1, fps: 1 },
    landRatio: 0.88,
  },
};

// NOTE: Update columns/clip lengths to match the hero sprite sheet grid.
const HERO_ANIM: HeroAnimSpec = {
  sheet: {
    src: "assets/hero-sheet-3.png",
    columns: 3,
    rows: 5,
    width: 1.5,
    height: 1.5,
    anchorX: 0.5,
    anchorY: 1,
  },
  idleUp: { row: 0, start: 0, length: 3, fps: 6 },
  idleDown: { row: 1, start: 0, length: 3, fps: 6 },
  turn: { row: 2, start: 0, length: 1, fps: 1 },
  bounce: { row: 3, start: 0, length: 3, fps: 10 },
  throwCharge: { row: 4, start: 0, length: 1, fps: 1 },
  throwRelease: { row: 4, start: 1, length: 1, fps: 1 },
};

// NOTE: Update columns/clip lengths to match the projectile sprite sheet grid.
const PROJECTILE_ANIM: ProjectileAnimSpec = {
  sheet: {
    src: "assets/projectile-sheet-0.png",
    columns: 5,
    rows: 1,
    width: 1.5,
    height: 0.5,
    anchorX: 0.1,
    anchorY: 0.5,
  },
  flight: { row: 0, start: 0, length: 4, fps: 1 },
};

const PROJECTILE_ROTATION_OFFSET = Math.PI;
const BACKGROUND_IMAGE_SRC = "assets/background-3-2.png";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t;

const randRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const clipDuration = (clip: ClipSpec): number =>
  clip.length / Math.max(1, clip.fps);

const clipFrameIndex = (
  clip: ClipSpec,
  frame: number,
  columns: number,
): number => clip.row * columns + clip.start + frame;

const pseudoRandom = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const formatScore = (score: number): string => score.toFixed(3);

const toTitleCase = (value: string): string =>
  value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const cloneConfig = (): GameConfig =>
  JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as GameConfig;

const deepMerge = <T extends Record<string, any>>(
  base: T,
  update: Partial<T>,
): T => {
  const result = { ...base } as T;
  Object.keys(update).forEach((key) => {
    const typedKey = key as keyof T;
    const baseValue = base[typedKey];
    const updateValue = update[typedKey];
    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      updateValue &&
      typeof updateValue === "object"
    ) {
      result[typedKey] = deepMerge(
        baseValue,
        updateValue as Partial<typeof baseValue>,
      );
    } else if (updateValue !== undefined) {
      result[typedKey] = updateValue as T[typeof typedKey];
    }
  });
  return result;
};

const getConfigValue = (config: GameConfig, path: string): number | boolean => {
  const parts = path.split(".");
  let current: any = config;
  for (const part of parts) {
    current = current?.[part];
  }
  return current as number | boolean;
};

const setConfigValue = (
  config: GameConfig,
  path: string,
  value: number | boolean,
): void => {
  const parts = path.split(".");
  let current: any = config;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
    } else {
      current = current[part];
    }
  });
};

const loadSpriteSheet = (spec: SpriteSheetSpec): SpriteSheetAsset => {
  const image = new Image();
  const asset: SpriteSheetAsset = {
    ...spec,
    image,
    loaded: false,
    frameWidth: 0,
    frameHeight: 0,
  };
  image.onload = () => {
    asset.loaded = true;
    asset.frameWidth = image.width / spec.columns;
    asset.frameHeight = image.height / spec.rows;
  };
  image.onerror = () => {
    console.warn(`Failed to load sprite: ${spec.src}`);
  };
  image.src = spec.src;
  return asset;
};

const loadImage = (src: string): ImageAsset => {
  const image = new Image();
  const asset: ImageAsset = { image, loaded: false };
  image.onload = () => {
    asset.loaded = true;
  };
  image.onerror = () => {
    console.warn(`Failed to load image: ${src}`);
  };
  image.src = src;
  return asset;
};

class BonusCrawlerFeature implements GameFeature {
  id = "bonus-crawler";
  private y = 0;
  private active = false;
  private respawnTimer = 0;
  private flashTime = 0;

  update(dt: number, game: Game): void {
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
        this.y = 0;
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

  onProjectile(projectile: Projectile, game: Game): boolean {
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

  render(ctx: CanvasRenderingContext2D, game: Game): void {
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

  onReset(game: Game): void {
    this.active = false;
    this.respawnTimer = game.config.features.bonusRespawn;
    this.flashTime = 0;
  }
}

class Game {
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
  heroGroundY = -0.5;

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
    this.settingsInputs = Array.from(
      this.settingsPanel.querySelectorAll<HTMLInputElement>("[data-path]"),
    );
    this.settingsValueLabels = Array.from(
      this.settingsPanel.querySelectorAll<HTMLElement>("[data-value]"),
    );
    this.sprites = {
      human: loadSpriteSheet(HUMAN_ANIM.sheet),
      hero: loadSpriteSheet(HERO_ANIM.sheet),
      projectile: loadSpriteSheet(PROJECTILE_ANIM.sheet),
    };
    this.background = loadImage(BACKGROUND_IMAGE_SRC);

    this.bindUi();
    this.bindSettings();
    this.bindControls();

    this.resetGame();
    this.resize();

    window.addEventListener("resize", () => this.resize());
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
    const restartButton = document.getElementById(
      "restart",
    ) as HTMLButtonElement;
    const showLeaderboard = document.getElementById(
      "show-leaderboard",
    ) as HTMLButtonElement;
    const saveScore = document.getElementById(
      "save-score",
    ) as HTMLButtonElement;
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
            : clamp(Number(input.value), 0, 999);
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
        typeof value === "number" ? value.toFixed(2) : value ? "on" : "off";
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
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("#settings")
      ) {
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
    this.platformsLeft = Math.min(
      this.platformsLeft,
      this.config.platform.count,
    );
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

    this.human.y = 0;
    this.human.state = "idle";
    this.human.jumpPhase = "prep";
    this.human.jumpPhaseTime = 0;
    this.human.jumpStart = this.human.y;
    this.human.jumpTarget = this.human.y;
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
      rotation: Math.atan2(arcVy, -this.config.throwing.speed) + PROJECTILE_ROTATION_OFFSET,
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
    this.platformsLeft += amount;
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

    this.maxAltitude = Math.max(
      this.maxAltitude,
      this.hero.pos.y,
      this.human.y,
    );

    for (const feature of this.features) {
      feature.update(dt, this);
    }

    this.score = Math.max(this.score, this.human.y);
    this.updateScoreUi();

    if (
      this.platformsLeft <= 0 &&
      this.projectiles.length === 0 &&
      this.human.state === "idle"
    ) {
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
        peakBase +
          randRange(
            -this.config.hero.peakRandomness,
            this.config.hero.peakRandomness,
          ),
      );
      const heightFromGround = Math.max(0.1, desiredApex - this.heroGroundY);
      const desiredVy = Math.sqrt(
        2 * this.config.physics.gravity * heightFromGround,
      );
      this.hero.vel.y = desiredVy;
    }

    if (
      this.hero.vel.y > 0 &&
      this.hero.pos.y > this.heroGroundY + bounceLead
    ) {
      this.heroBounceTriggered = false;
    }

    this.hero.squish = Math.max(0, this.hero.squish - dt * 2.8);
  }

  updateHeroAnimation(dt: number): void {
    if (this.heroThrowCharging) {
      const duration = clipDuration(HERO_ANIM.throwCharge);
      this.heroThrowChargeElapsed = Math.min(
        duration,
        this.heroThrowChargeElapsed + dt,
      );
      this.heroTurnActive = false;
      this.heroTurnElapsed = 0;
    }

    if (this.heroThrowReleaseActive) {
      this.heroThrowReleaseElapsed += dt;
      if (
        this.heroThrowReleaseElapsed >= clipDuration(HERO_ANIM.throwRelease)
      ) {
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

      if (
        projectile.pos.y < -2 ||
        projectile.pos.y > this.cameraY + this.viewHeightMeters + 6
      ) {
        projectile.active = false;
      }
    }

    this.projectiles = this.projectiles.filter(
      (projectile) => projectile.active,
    );
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
    this.human.y =
      lerp(this.human.jumpStart, this.human.jumpTarget, eased) + arc;

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
    this.cameraY = lerp(
      this.cameraY,
      target,
      clamp(dt * this.config.camera.followSpeed, 0, 1),
    );
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
    const wantsOneShot = force
      ? force === "oneShot"
      : Math.random() < idle.oneShotChance;
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
    if (
      clips.length > 1 &&
      source === this.humanIdleClipSource &&
      nextIndex === this.humanIdleClipIndex
    ) {
      nextIndex = (nextIndex + 1) % clips.length;
    }

    const clip = clips[nextIndex];
    this.humanIdleClipIndex = nextIndex;
    this.humanIdleClipSource = source;
    this.humanIdleClipStartedAt = this.time;
    this.humanIdleNextSwitch =
      source === "loop"
        ? this.time + randRange(idle.minHold, idle.maxHold)
        : this.time + clipDuration(clip);
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
      this.leaderboardList.innerHTML =
        '<div class="leaderboard-row">No scores yet</div>';
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
      return (
        user.username ||
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        "Runner"
      );
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
    this.drawWall();
    this.drawPlatforms();
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
      const scale = Math.max(
        this.width / image.width,
        this.height / image.height,
      );
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
    this.ctx.save();
    this.ctx.fillStyle = "rgba(15, 24, 38, 0.95)";
    this.ctx.fillRect(this.wallScreenX - 18, 0, 36, this.height);

    this.ctx.strokeStyle = "rgba(50, 242, 255, 0.6)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.wallScreenX, 0);
    this.ctx.lineTo(this.wallScreenX, this.height);
    this.ctx.stroke();

    const startMeter = Math.floor(this.cameraY - 1);
    const endMeter = Math.ceil(this.cameraY + this.viewHeightMeters + 2);
    for (let meter = startMeter; meter <= endMeter; meter += 1) {
      const y = this.worldToScreenY(meter);
      if (y < -30 || y > this.height + 30) {
        continue;
      }

      const major = meter % 5 === 0;
      this.ctx.strokeStyle = major
        ? "rgba(50, 242, 255, 0.8)"
        : "rgba(50, 242, 255, 0.4)";
      this.ctx.lineWidth = major ? 3 : 1;
      this.ctx.beginPath();
      this.ctx.moveTo(this.wallScreenX - (major ? 14 : 10), y);
      this.ctx.lineTo(this.wallScreenX + (major ? 18 : 12), y);
      this.ctx.stroke();

      if (major && meter >= 0) {
        this.ctx.fillStyle = "rgba(230, 244, 255, 0.7)";
        this.ctx.font = "12px 'Share Tech Mono'";
        this.ctx.fillText(String(meter), this.wallScreenX - 38, y + 4);
      }
    }

    this.ctx.restore();
  }

  drawPlatforms(): void {
    this.ctx.save();
    const baseWidth = this.config.platform.width * 1.4 * this.meterPx;
    const baseHeight = this.config.platform.height * 1.3 * this.meterPx;
    const baseX = this.wallScreenX + 8;
    const baseY = this.worldToScreenY(this.basePlatformY);
    this.ctx.fillStyle = "rgba(50, 242, 255, 0.35)";
    this.ctx.shadowColor = "rgba(50, 242, 255, 0.5)";
    this.ctx.shadowBlur = 14;
    this.ctx.fillRect(baseX, baseY - baseHeight / 2, baseWidth, baseHeight);
    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = "rgba(5, 8, 14, 0.7)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(baseX, baseY - baseHeight / 2, baseWidth, baseHeight);

    const sprite = this.sprites.projectile;
    for (const platform of this.platforms) {
      const x = this.wallScreenX + 12;
      const y = this.worldToScreenY(platform.y);
      const growTime = 0.22;
      const growProgress = clamp(
        (this.time - platform.createdAt) / growTime,
        0,
        1,
      );
      const grow = easeInOut(growProgress);

      if (
        sprite.loaded &&
        sprite.frameWidth > 0 &&
        sprite.frameHeight > 0 &&
        platform.spriteFrame !== undefined
      ) {
        const maxFrames = sprite.columns * sprite.rows;
        const safeFrame = clamp(
          platform.spriteFrame,
          0,
          Math.max(0, maxFrames - 1),
        );
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
    this.ctx.translate(x, y + 8);
    this.ctx.scale(1.1, squish);

    this.ctx.beginPath();
    this.ctx.fillStyle = "rgba(50, 242, 255, 0.25)";
    this.ctx.strokeStyle = "rgba(50, 242, 255, 0.7)";
    this.ctx.lineWidth = 3;
    this.ctx.ellipse(0, 0, 40, 10, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
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

      ///

      this.ctx.fillStyle = "rgba(57, 245, 154, 0.8)";
      this.ctx.fillRect(
        -bodyWidth / 2,
        -bodyHeight * 0.1,
        bodyWidth,
        bodyHeight * 0.2,
      );

      this.ctx.fillStyle = "rgba(50, 242, 255, 0.85)";
      this.ctx.shadowColor = "rgba(50, 242, 255, 0.6)";
      this.ctx.shadowBlur = 12;
      this.ctx.fillRect(
        -bodyWidth / 2,
        bodyHeight * 0.15,
        bodyWidth,
        bodyHeight * 0.65,
      );

      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = "rgba(5, 8, 14, 0.8)";
      this.ctx.fillRect(
        -bodyWidth * 0.3,
        bodyHeight * 0.25,
        bodyWidth * 0.6,
        bodyHeight * 0.3,
      );

      this.ctx.fillStyle = "rgba(255, 179, 71, 0.9)";
      this.ctx.fillRect(
        -bodyWidth * 0.2,
        bodyHeight * 0.3,
        bodyWidth * 0.4,
        bodyHeight * 0.08,
      );

      ///

      // this.ctx.fillStyle = "rgba(50, 242, 255, 0.85)";
      // this.ctx.shadowColor = "rgba(50, 242, 255, 0.6)";
      // this.ctx.shadowBlur = 12;
      // this.ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight * 0.65);

      // this.ctx.shadowBlur = 0;
      // this.ctx.fillStyle = "rgba(5, 8, 14, 0.8)";
      // this.ctx.fillRect(-bodyWidth * 0.3, -bodyHeight * 0.2, bodyWidth * 0.6, bodyHeight * 0.3);

      // this.ctx.fillStyle = "rgba(255, 179, 71, 0.9)";
      // this.ctx.fillRect(-bodyWidth * 0.2, -bodyHeight * 0.15, bodyWidth * 0.4, bodyHeight * 0.08);

      // this.ctx.fillStyle = "rgba(57, 245, 154, 0.8)";
      // this.ctx.fillRect(-bodyWidth / 2, bodyHeight * 0.2, bodyWidth, bodyHeight * 0.2);

      ///
    }

    this.ctx.restore();
  }

  drawHuman(): void {
    const x = this.worldToScreenX(0.55);
    const y = this.worldToScreenY(this.human.y);
    const wobble =
      this.human.state === "worry"
        ? Math.sin(this.time * 12) * 3
        : Math.sin(this.time * 2) * 1.5;
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
      this.ctx.fillRect(
        -headSize / 2,
        -bodyHeight - headSize,
        headSize,
        headSize,
      );

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

    const idleClip =
      this.hero.vel.y >= 0 ? HERO_ANIM.idleUp : HERO_ANIM.idleDown;
    const idleFrame =
      idleClip.length > 1
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
      const frame =
        clip.length > 1
          ? Math.min(
              clip.length - 1,
              Math.floor(this.human.jumpPhaseTime * fps),
            )
          : 0;
      return clipFrameIndex(clip, frame, sprite.columns);
    }

    const idle = HUMAN_ANIM.idle;
    const idleClips =
      this.humanIdleClipSource === "oneShot"
        ? idle.oneShotClips
        : idle.loopClips;
    let clip = idleClips[this.humanIdleClipIndex];
    if (!clip) {
      clip = idle.loopClips[0] ?? idle.oneShotClips[0];
    }
    if (!clip) {
      return 0;
    }
    const clipTime = Math.max(0, this.time - this.humanIdleClipStartedAt);
    const fps = Math.max(1, clip.fps);
    const isOneShot =
      this.humanIdleClipSource === "oneShot" || idle.loopClips.length === 0;
    const frame =
      clip.length > 1
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
        const progress = clamp(
          (projectile.startX - projectile.pos.x) / span,
          0,
          1,
        );
        const frame = Math.min(
          PROJECTILE_ANIM.flight.length - 1,
          Math.floor(progress * PROJECTILE_ANIM.flight.length),
        );
        const frameIndex = clipFrameIndex(
          PROJECTILE_ANIM.flight,
          frame,
          sprite.columns,
        );
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

const initTelegram = (): void => {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
};

const start = (): void => {
  initTelegram();
  const canvas = document.getElementById(
    "game-canvas",
  ) as HTMLCanvasElement | null;
  if (!canvas) {
    return;
  }
  const game = new Game(canvas);
  requestAnimationFrame(game.tick);
};

window.addEventListener("DOMContentLoaded", start);

export {};
