import { ImageAsset, SpriteSheetAsset, SpriteSheetSpec } from "./types.js";

export const BACKGROUND_IMAGE_SRC = "assets/background.jpg";

const WALL_TILE_SOURCES = [
  "assets/env/hk-snowy/wall-1.svg",
  "assets/env/hk-snowy/wall-1b.svg",
  "assets/env/hk-snowy/wall-1c.svg",
  "assets/env/hk-snowy/wall-1d.svg",
  "assets/env/hk-snowy/wall-1e.svg",
  "assets/env/hk-snowy/wall-1f.svg",
];

export const WALL_TILE_WEIGHTS = [0.42, 0.18, 0.12, 0.12, 0.10, 0.06];

const ENVIRONMENT_SOURCES = {
  floor: "assets/env/hk-snowy/floor-1.svg",
  trampoline: "assets/env/hk-snowy/trampoline-1.svg",
};

export const loadSpriteSheet = (spec: SpriteSheetSpec): SpriteSheetAsset => {
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

export const loadImage = (src: string): ImageAsset => {
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

export const loadEnvironmentSprites = (): {
  wallTiles: ImageAsset[];
  wallWeights: number[];
  floor: ImageAsset;
  trampoline: ImageAsset;
} => ({
  wallTiles: WALL_TILE_SOURCES.map((src) => loadImage(src)),
  wallWeights: WALL_TILE_WEIGHTS,
  floor: loadImage(ENVIRONMENT_SOURCES.floor),
  trampoline: loadImage(ENVIRONMENT_SOURCES.trampoline),
});
