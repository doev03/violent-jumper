import { ClipSpec, HeroAnimSpec, HumanAnimSpec, ProjectileAnimSpec } from "./types.js";

export const clipDuration = (clip: ClipSpec): number =>
  clip.length / Math.max(1, clip.fps);

export const clipFrameIndex = (
  clip: ClipSpec,
  frame: number,
  columns: number,
): number => clip.row * columns + clip.start + frame;

// NOTE: Update columns/clip lengths to match the real sprite sheet grid.
export const HUMAN_ANIM: HumanAnimSpec = {
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
export const HERO_ANIM: HeroAnimSpec = {
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
export const PROJECTILE_ANIM: ProjectileAnimSpec = {
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

export const PROJECTILE_ROTATION_OFFSET = Math.PI;
