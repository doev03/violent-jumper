# Neon Ladder (Telegram Game)

Cyberpunk re-skin of the Yetisports 10 style vertical climb game. The hero robot auto-bounces on a trampoline; the player only throws platforms to help a human climb the wall.

## Run locally

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

## Extensibility

Gameplay hooks live in `src/main.ts` (`GameFeature`). Add a new feature class and push it into `this.features` inside `resetGame()`. The sample `BonusCrawlerFeature` adds extra platforms when hit.

## Telegram

The game calls `Telegram.WebApp.ready()` + `expand()` automatically when inside a Telegram WebApp.
# violent-jumper
