export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t;

export const randRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const formatScore = (score: number): string => score.toFixed(3);

export const toTitleCase = (value: string): string =>
  value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
