export type Vec2 = { x: number; y: number };

export type GameMode = "playing" | "gameover";

export type HumanState = "idle" | "jumping" | "worry";
export type HumanJumpPhase = "prep" | "ascend" | "descend" | "land";

export type ScoreEntry = {
  name: string;
  score: number;
  timestamp: number;
};

/** Game tuning knobs. Units are meters and seconds unless stated otherwise. */
export type GameConfig = {
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
    /** Visual offset above the platform (m). */
    renderOffset: number;
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

export type Platform = {
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

export type Projectile = {
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

export type Hero = {
  /** World position (m). */
  pos: Vec2;
  /** World velocity (m/s). */
  vel: Vec2;
  /** Squash factor for trampoline impact (0..1). */
  squish: number;
};

export type Human = {
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

export type GameLike = {
  config: GameConfig;
  maxAltitude: number;
  viewHeightMeters: number;
  wallScreenX: number;
  height: number;
  meterPx: number;
  addPlatforms: (amount: number) => number;
  getPlatformIconTargets: (amount: number) => Vec2[];
  stickProjectile: (projectile: Projectile) => void;
  worldToScreenY: (y: number) => number;
  screenToWorldY: (screenY: number) => number;
};

export type GameFeature = {
  id: string;
  /** Update hook; dt is in seconds. */
  update: (dt: number, game: GameLike) => void;
  /** Draw hook; rendering is in screen space. */
  render: (ctx: CanvasRenderingContext2D, game: GameLike) => void;
  /** Called for each active projectile; return true to consume it. */
  onProjectile?: (projectile: Projectile, game: GameLike) => boolean;
  /** Reset hook called when a new run starts. */
  onReset?: (game: GameLike) => void;
};

/** Sprite sheet metadata in world meters with a bottom-center style anchor. */
export type SpriteSheetSpec = {
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

export type SpriteSheetAsset = SpriteSheetSpec & {
  image: HTMLImageElement;
  loaded: boolean;
  frameWidth: number;
  frameHeight: number;
};

export type ImageAsset = {
  image: HTMLImageElement;
  loaded: boolean;
};

export type ClipSpec = {
  /** Row index (0-based). */
  row: number;
  /** Start column index (0-based). */
  start: number;
  /** Number of frames in the clip. */
  length: number;
  /** Playback speed (frames per second). */
  fps: number;
};

export type HumanAnimSpec = {
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

export type HeroAnimSpec = {
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

export type ProjectileAnimSpec = {
  sheet: SpriteSheetSpec;
  /** Flight animation (last frame becomes the platform). */
  flight: ClipSpec;
};
