import { Game } from "./game.js";

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

const initTelegram = (): void => {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
};

const start = (): void => {
  initTelegram();
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    return;
  }
  const fxCanvas = document.getElementById("fx-canvas") as HTMLCanvasElement | null;
  const game = new Game(canvas, fxCanvas);
  requestAnimationFrame(game.tick);
};

window.addEventListener("DOMContentLoaded", start);
