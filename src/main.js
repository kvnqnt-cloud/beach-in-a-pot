import { Game } from "./Game.js";

const root = document.querySelector("#game-root");
const loading = document.querySelector("#loading");

// 🔥 BLOQUEIA SCROLL DENTRO DO JOGO (iframe fix)
window.addEventListener("wheel", (e) => {
  e.preventDefault();
}, { passive: false });

window.addEventListener("touchmove", (e) => {
  e.preventDefault();
}, { passive: false });

async function boot() {
  if (!window.PIXI) {
    loading.textContent = "pixijs failed to load";
    return;
  }

  const game = new Game(root);

  try {
    await game.init();
    loading.remove();
  } catch (error) {
    console.error(error);
    loading.textContent = "could not load game";
  }
}

boot();
