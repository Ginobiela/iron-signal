import { GameplayConfigStore, parseTuningPreset } from '../config/gameplay';
import type { TuningPreset } from '../config/gameplay';

export const TUNING_SESSION_KEY = 'iron-signal-dev-tuning-v1';
export const CUSTOM_PRESETS_KEY = 'iron-signal-dev-presets-v1';
export const BUILTIN_PRESETS: readonly TuningPreset[] = [
  { version: 1, name: 'DEFAULT', overrides: {} },
  { version: 1, name: 'GOD MODE', overrides: { 'player.maxHealth': 999, 'game.initialLives': 999, 'player.invulnerabilityTime': 30 } },
  { version: 1, name: 'FAST GAMEPLAY', overrides: { 'player.speed': 150, 'player.jumpSpeed': 260, 'enemies.runner.speed': 110 } },
  // A tuning preset, not time scaling: the engine timestep is deliberately unchanged.
  { version: 1, name: 'SLOW MOTION TEST', overrides: { 'player.speed': 48, 'player.jumpSpeed': 105, 'player.gravity': 150, 'weapons.rifle.projectileSpeed': 160, 'enemies.runner.speed': 40 } },
  { version: 1, name: 'WEAPON TEST', overrides: { 'player.maxHealth': 100, 'player.invulnerabilityTime': 10, 'weapons.rifle.fireRate': 12, 'weapons.machineGun.fireRate': 24 } },
];
// Browser persistence is called only by explicit developer pages/playtests, never by gameplay systems.
export function restoreTuningSession(): GameplayConfigStore {
  const store = new GameplayConfigStore();
  const saved = sessionStorage.getItem(TUNING_SESSION_KEY);
  if (saved) store.replace(parseTuningPreset(JSON.parse(saved)).overrides);
  return store;
}
export function saveTuningSession(store: GameplayConfigStore): void {
  sessionStorage.setItem(TUNING_SESSION_KEY, JSON.stringify(store.preset('Current session')));
}
export function readCustomPresets(): TuningPreset[] {
  const data: unknown = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) ?? '[]');
  if (!Array.isArray(data) || data.length > 100) throw new Error('Lista de presets inválida.');
  return data.map(parseTuningPreset);
}
