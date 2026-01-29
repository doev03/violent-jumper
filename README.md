# Neon Ladder (Telegram Game)

Cyberpunk re-skin of the Yetisports 10 style vertical climb game. The hero robot auto-bounces on a trampoline; the player only throws platforms to help a human climb the wall.

## Quick Start

```bash
npm install
npm run build
npm run serve
```

Open `http://localhost:5173`.

## Controls

- Tap/click anywhere on the canvas to throw a platform.
- `S` toggles the physics tuner panel.
- `R` restarts the run.

## Project Structure

```
src/
  animation.ts   Animation clips, sprite sheet specs, and clip helpers.
  assets.ts      Image loading helpers + background asset.
  config.ts      GameConfig defaults and config persistence helpers.
  types.ts       Shared types for entities and config.
  utils.ts       Math + formatting helpers.
  main.ts        Game loop, rendering, input, and gameplay state.
```

Build output goes to `dist/` and is loaded by `index.html`.

## Environment Art

- Wall, floor, and trampoline are sprite-based (see `assets/env/hk-snowy/`).
- The wall is tiled from multiple compatible SVG tiles (`wall-1*.svg`) with weighted variation.

## ESM Notes

- The build outputs native ES modules; import specifiers use `.js` extensions.
- `tsconfig.json` uses `NodeNext` module resolution to keep TS + browser ESM aligned.

## Gameplay Summary

- The hero robot auto-bounces. The apex is tied to the human height plus a random offset.
- The player throws a projectile; it arcs, sticks into the wall, and becomes a platform.
- The human auto-jumps if the latest reachable platform is within `human.jumpThreshold`.
- When platforms run out and the human is idle, the run ends and score is shown.

## Animation System

All clip metadata lives in `src/animation.ts`.

### Human

- **Idle:** random choice between looping idle and one-shot actions.
- **Jump:** multi-phase: `prep` (no movement), `ascend`, `descend`, `land`.
- Movement starts after the `prep` clip finishes to keep the takeoff feeling natural.

### Hero

Priority order for frames:
1. Bounce (trampoline contact)
2. Throw release
3. Throw charge (hold last frame while button is held)
4. Turn (apex)
5. Idle up/down

The charge frame persists through the apex and down-flight. It resets only when the hero hits the trampoline.

### Projectile

- Uses a flight animation while moving.
- Rotation is aligned to velocity and preserved when it sticks, so it appears as a spear.
- The last flight frame becomes the platform sprite.

## Asset Requirements

All sprites are controlled via the animation specs in `src/animation.ts`.

For each sprite sheet you define:

- `columns` / `rows` — the sprite sheet grid.
- `width` / `height` — size in world meters.
- `anchorX` / `anchorY` — pivot from top-left (0..1).

For each clip you define:

- `row` / `start` / `length` / `fps`.

The background is a single cover image controlled by `BACKGROUND_IMAGE_SRC` in `src/assets.ts`.

## Extensibility

Gameplay hooks live in `GameFeature` (see `src/types.ts`). To add new features:

1. Create a new class implementing `GameFeature` in `src/main.ts`.
2. Push it into `this.features` inside `resetGame()`.

The existing `BonusCrawlerFeature` shows how to add a moving target that rewards extra platforms.

## Telegram

The game calls `Telegram.WebApp.ready()` and `Telegram.WebApp.expand()` automatically when embedded.
