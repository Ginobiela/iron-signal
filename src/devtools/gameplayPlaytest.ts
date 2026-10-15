import './gameplay-tuner.css';
import type { Game } from '../core/Game';
import type { GameplayConfigStore } from '../config/gameplay';
import { DEV_TOOLS } from '../config/devtools';
import { TuningControls } from './TuningControls';
import { saveTuningSession } from './gameplayPresets';

export function attachGameplayPlaytest(game: Game, store: GameplayConfigStore): () => void {
  if (!DEV_TOOLS) throw new Error('Developer tools disabled.');
  const session = game.developerSession();
  const panel = document.createElement('aside'); panel.className = 'quick-tuner'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Gameplay Tuner quick panel');
  panel.innerHTML = `<h2>GAMEPLAY TUNER · F3</h2><button id="quick-close">CLOSE</button>
    <a href="./gameplay-tuner.html">FULL TUNER</a><p id="quick-dirty"></p>
    <label><input id="pause-editing" type="checkbox" checked> PAUSE GAME WHILE OPEN</label>
    <p id="quick-error" role="alert"></p><div id="quick-settings"></div><button id="quick-reset">RESET ALL</button>
    <h2>LIGHTING COMPARISON (DEV ONLY)</h2>
    <label>Lighting intensity multiplier <input id="light-intensity" type="range" min="0" max="2" step=".05" value="1"></label>
    <label>Temporary light multiplier <input id="light-temporary" type="range" min="0" max="2" step=".05" value="1"></label>
    <label><input id="light-full" type="checkbox"> FULL AMBIENT</label>
    <label><input id="light-enabled" type="checkbox"> LIGHTING ON</label>
    <h2>DEV COMMANDS</h2><nav id="dev-commands"></nav><h2>LIVE GAME</h2><pre id="live-game"></pre>`;
  const badge = document.createElement('button'); badge.className = 'tuning-badge';
  badge.setAttribute('aria-label', 'Open gameplay tuner panel F3'); document.body.append(panel, badge);
  const get = <T extends HTMLElement = HTMLElement>(selector: string): T => panel.querySelector<T>(selector)!;
  const report = (message: string) => { get('#quick-error').textContent = message; };
  const controls = new TuningControls(get('#quick-settings'), store, report,
    ['player.gravity','player.speed','player.jumpSpeed','player.maxHealth','weapons.rifle.damage','enemies.soldier.health','enemies.runner.health']);
  const pause = get<HTMLInputElement>('#pause-editing');
  const toggle = () => {
    panel.hidden = !panel.hidden;
    session.pauseEditing(!panel.hidden && pause.checked);
    if (panel.hidden && panel.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  };
  for(const [id,key] of [['light-intensity','intensity'],['light-temporary','temporary'],['light-full','fullAmbient'],['light-enabled','enabled']] as const){
    const field=get<HTMLInputElement>('#'+id);
    field.oninput=()=>session.setLighting(key,field.type==='checkbox'?field.checked:Number(field.value));
  }
  badge.onclick = toggle; get('#quick-close').onclick = toggle;
  pause.onchange = () => session.pauseEditing(!panel.hidden && pause.checked);
  get('#quick-reset').onclick = () => { try { store.resetAll(); report(''); } catch (error) { report(String(error)); } };
  for (const [command, label] of Object.entries({ heal: 'HEAL PLAYER', kill: 'KILL PLAYER', clear: 'CLEAR ENEMIES (NO SCORE/DROPS)',
    infiniteLives: 'TOGGLE INFINITE LIVES', invulnerable: 'TOGGLE INVULNERABLE',
    rifle: 'GIVE RIFLE', machineGun: 'GIVE MACHINE GUN', spread: 'GIVE SPREAD', laser: 'GIVE LASER',
    checkpoint: 'TELEPORT TO CHECKPOINT', restart: 'RESTART LEVEL' })) {
    const button = document.createElement('button'); button.textContent = label; button.dataset.command = command;
    button.onclick = () => { session.command(command); refresh(); };
    get('#dev-commands').append(button);
  }
  function refresh(): void {
    const light=session.lightingSettings();
    for(const [id,key] of [['light-intensity','intensity'],['light-temporary','temporary'],['light-full','fullAmbient'],['light-enabled','enabled']] as const){
      const field=get<HTMLInputElement>('#'+id);if(field!==document.activeElement){if(field.type==='checkbox')field.checked=Boolean(light[key]);else field.value=String(light[key]);}
    }
    const count = Object.keys(store.getOverrides()).length;
    const label = `${count ? `MODIFIED · ${count} OVERRIDES` : 'DEFAULT'} · F3`;
    badge.textContent = `DEV PLAYTEST · ${label}`; get('#quick-dirty').textContent = label;
    if (!panel.hidden) get('#live-game').textContent = JSON.stringify(session.snapshot(), null, 2);
    const state = session.snapshot();
    for (const key of ['infiniteLives','invulnerable'] as const) get<HTMLButtonElement>(`[data-command="${key}"]`).setAttribute('aria-pressed', String(state[key]));
  }
  const unsubscribe = store.subscribe(() => {
    session.changed(); refresh();
    try { saveTuningSession(store); report(''); } catch (error) { report(String(error)); }
  });
  const onKey = (event: KeyboardEvent) => {
    if (event.code === 'F3' && !event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); toggle(); refresh(); }
    else if (!panel.hidden && panel.contains(event.target as Node)) event.stopImmediatePropagation();
  };
  window.addEventListener('keydown', onKey, true);
  const timer = window.setInterval(refresh, 250); refresh();
  return () => {
    clearInterval(timer); window.removeEventListener('keydown', onKey, true);
    unsubscribe(); controls.dispose(); session.pauseEditing(false); panel.remove(); badge.remove();
  };
}
