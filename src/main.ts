import './style.css';
import { Game } from './core/Game';

const viewport = document.querySelector<HTMLElement>('#viewport');
const debug = document.querySelector<HTMLElement>('#debug');
const error = document.querySelector<HTMLElement>('#error');
const status = document.querySelector<HTMLElement>('#combat-status');
const notice = document.querySelector<HTMLElement>('#powerup-notice');
const menu = document.querySelector<HTMLElement>('#game-menu');
const bossStatus = document.querySelector<HTMLElement>('#boss-status');
if (!viewport || !debug || !error || !status || !notice || !menu || !bossStatus) throw new Error('Faltan elementos de la interfaz.');

try {
  const game = new Game(viewport, debug, status, notice, menu, bossStatus);
  game.start();
  if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
} catch (cause: unknown) {
  error.hidden = false;
  error.textContent = 'No se pudo iniciar WebGL. Prueba un navegador con aceleración gráfica habilitada.';
  console.error(cause);
}
