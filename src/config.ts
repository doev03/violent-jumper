import { GameConfig } from "./types.js";
import { clamp } from "./utils.js";

export const STORAGE_KEYS = {
  scores: "neon_ladder_scores",
  config: "neon_ladder_config",
};

export const DEFAULT_CONFIG: GameConfig = {
  physics: {
    gravity: 14,
  },
  throwing: {
    speed: 10.0,
    cooldown: 0.2,
  },
  platform: {
    count: 10,
    width: 0.85,
    height: 0.18,
  },
  hero: {
    peakOffset: 2,
    peakRandomness: 0.5,
    minPeak: 1.6,
  },
  human: {
    jumpThreshold: 2.0,
    jumpDuration: 0.6,
    jumpArc: 0.7,
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
    bonusRespawn: 2,
  },
  ui: {
    promptDuration: 2,
  },
};

export const cloneConfig = (): GameConfig =>
  JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as GameConfig;

export const deepMerge = <T extends Record<string, any>>(
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
      result[typedKey] = deepMerge(baseValue, updateValue as Partial<typeof baseValue>);
    } else if (updateValue !== undefined) {
      result[typedKey] = updateValue as T[typeof typedKey];
    }
  });
  return result;
};

export const getConfigValue = (
  config: GameConfig,
  path: string,
): number | boolean => {
  const parts = path.split(".");
  let current: any = config;
  for (const part of parts) {
    current = current?.[part];
  }
  return current as number | boolean;
};

export const setConfigValue = (
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

export const clampConfigValue = (value: number): number => clamp(value, 0, 999);
