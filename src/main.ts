import './style.css';
import { Game } from './core/Game';
import { loadLevel, parseLevel } from './level/LevelDocument';

const viewport = document.querySelector<HTMLElement>('#viewport');
const debug = document.querySelector<HTMLElement>('#debug');
const error = document.querySelector<HTMLElement>('#error');
const status = document.querySelector<HTMLElement>('#combat-status');
const notice = document.querySelector<HTMLElement>('#powerup-notice');
const menu = document.querySelector<HTMLElement>('#game-menu');
const bossStatus = document.querySelector<HTMLElement>('#boss-status');
if (!viewport || !debug || !error || !status || !notice || !menu || !bossStatus) throw new Error('Faltan elementos de la interfaz.');

async function start(): Promise<void> {
try {
  const params = new URLSearchParams(location.search), playtest = params.has('playtest') && import.meta.env.MODE !== 'release';
  const levelUrl = params.get('level');
  const data = playtest ? parseLevel(JSON.parse(sessionStorage.getItem('iron-signal-playtest-v1') ?? 'null'))
    : levelUrl ? await loadLevel(new URL(levelUrl, location.href).href) : undefined;
  const game = new Game(viewport!, debug!, status!, notice!, menu!, bossStatus!, data);
  if (playtest) {
    game.beginPlaytest();
    const link = document.createElement('a'); link.href = './level-editor.html'; link.textContent = 'RETURN TO LEVEL EDITOR · ESC';
    link.className = 'viewer-link'; document.querySelector('header')?.append(link);
    window.addEventListener('keydown', event => { if (event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); location.href = './level-editor.html'; } }, true);
  }
  game.start();
  if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
} catch (cause: unknown) {
  error!.hidden = false;
  error!.textContent = `No se pudo iniciar el juego: ${String(cause)}`;
  console.error(cause);
}
}
void start();
