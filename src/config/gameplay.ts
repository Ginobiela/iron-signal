import { PLAYER, GAMEPLAY, RIFLE, MACHINE_GUN, SPREAD_GUN, LASER, PROJECTILES, ENEMIES, BOSS, POWERUPS, CAMERA, FEEDBACK } from './constants';

type Values<T> = T extends number ? number : T extends string ? string : T extends readonly (infer U)[] ? readonly Values<U>[] : { readonly [K in keyof T]: Values<T[K]> };
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const defaults = {
  player: PLAYER, game: GAMEPLAY,
  weapons: {
    rifle: { ...RIFLE, projectileLifetime: PROJECTILES.lifetime },
    machineGun: { ...MACHINE_GUN, projectileLifetime: PROJECTILES.lifetime },
    spread: { ...SPREAD_GUN, projectileLifetime: PROJECTILES.lifetime },
    laser: { ...LASER, projectileLifetime: PROJECTILES.lifetime },
  },
  enemies: ENEMIES, boss: BOSS, powerups: POWERUPS, camera: CAMERA,
  feedback: { shakeLimit: FEEDBACK.shakeLimit },
};
export type GameplayConfig = Values<typeof defaults>;
// Clone before freezing: the canonical defaults never freeze or mutate legacy exports.
export const DEFAULT_GAMEPLAY_CONFIG: GameplayConfig = freeze(structuredClone(defaults));
export interface GameplayConfigSource { get(): GameplayConfig }
export const DEFAULT_CONFIG_SOURCE: GameplayConfigSource = Object.freeze({ get: () => DEFAULT_GAMEPLAY_CONFIG });
export type SettingValue = number | readonly number[];
export type Overrides = Readonly<Record<string, SettingValue>>;
export interface Setting {
  path: string; label: string; category: string; min: number; max: number; step: number;
  applyMode: 'LIVE' | 'RESPAWN' | 'RESTART'; advanced: boolean; description: string; array?: boolean;
}
const settings: Setting[] = [];
function add(category: string, prefix: string, entries: readonly (readonly [string, number, number, number, string?])[],
  applyMode: Setting['applyMode'] = 'LIVE', advanced = false): void {
  for (const [key, min, max, step, description] of entries) settings.push({
    path: `${prefix}.${key}`, label: `${prefix.split('.').slice(1).join(' · ')} ${key}`.trim(),
    category, min, max, step, applyMode, advanced,
    description: description ?? (applyMode === 'LIVE' ? 'Se aplica en la siguiente actualización/evento; no reinicia timers ni objetos existentes.' : 'Se aplica al crear o reiniciar la instancia. No reinicia automáticamente.'),
  });
}
add('PLAYER', 'player', [['maxHealth',1,999,1,'Máximo en vivo; no cura. Al reducirlo limita la salud actual.'],['speed',10,500,1],['jumpSpeed',10,600,1],['gravity',50,2000,10],['invulnerabilityTime',0,30,.05]]);
add('PLAYER','game',[['initialLives',1,999,1]],'RESTART');
add('PLAYER','player',[['fallGravityMultiplier',.1,5,.1],['maxFallSpeed',20,1000,10],['coyoteTime',0,1,.01,'Tiempo tras abandonar una plataforma en que todavía se permite saltar.'],['jumpBuffer',0,1,.01,'Tiempo que se conserva una pulsación de salto antes de aterrizar.'],['dropSpeed',1,200,1]],'LIVE',true);
for (const kind of Object.keys(defaults.weapons)) add('WEAPONS', `weapons.${kind}`, [['damage',1,999,1],['fireRate',.2,30,.1,'Disparos por segundo; mayor valor = mayor cadencia. Afecta al próximo cooldown.'],['projectileSpeed',10,1500,10],['projectileLifetime',.1,10,.1,'Solo nuevos proyectiles; conserva los que ya están en vuelo.']]);
add('WEAPONS','weapons.spread',[['angles',-80,80,1,'Lista ordenada de 1–15 ángulos únicos, en grados. Su longitud es la cantidad de perdigones.']], 'LIVE',true);
settings[settings.length - 1]!.array = true;
for (const kind of ['soldier','runner','turret','flying']) add('ENEMIES',`enemies.${kind}`,[['health',1,999,1]],'RESPAWN');
for (const kind of ['soldier','runner','flying']) add('ENEMIES',`enemies.${kind}`,[['speed',1,400,1]]);
for (const kind of ['soldier','turret']) add('ENEMIES',`enemies.${kind}`,[['attackInterval',.1,15,.05,'Segundos entre ataques; menor valor = mayor cadencia.'],['bulletSpeed',10,1000,5]]);
add('ENEMIES','enemies',[['contactDamage',1,999,1],['bulletDamage',1,999,1]]);
add('ENEMIES','enemies',[['activationMargin',0,256,1]],'LIVE',true);
add('ENEMIES','enemies.soldier',[['stopDistance',0,256,1]],'LIVE',true);
add('ENEMIES','enemies.runner',[['jumpSpeed',10,600,1]],'LIVE',true);
add('ENEMIES','enemies.flying',[['amplitude',0,60,1],['frequency',.1,10,.1]],'LIVE',true);
add('BOSS','boss',[['health',1,999,1]],'RESTART');
add('BOSS','boss',[['phase2Threshold',.02,.99,.01],['phase3Threshold',.01,.98,.01]],'LIVE',true);
for (const key of ['telegraphTimes','recoveryTimes','bulletSpeeds']) for (let i = 0; i < 3; i++) add('BOSS',`boss.${key}`,[[String(i),key === 'bulletSpeeds' ? 10 : .05,key === 'bulletSpeeds' ? 1000 : 10,key === 'bulletSpeeds' ? 5 : .05]],'LIVE',true);
add('BOSS','boss',[['burstCount',1,10,1],['burstInterval',.02,1,.01],['attackTime',.05,5,.01],['introTime',.1,10,.1]],'LIVE',true);
add('POWERUPS','powerups',[['lifetime',1,60,.5,'Solo los pickups nuevos.'],['warningTime',0,10,.1]]);
add('CAMERA / FEEDBACK','camera',[['deadZone',0,64,1]]);
add('CAMERA / FEEDBACK','feedback',[['shakeLimit',0,5,.1,'Límite de intensidad de shake; 0 lo desactiva.']], 'LIVE');
export const GAMEPLAY_SETTINGS: readonly Setting[] = freeze(settings);
const byPath = new Map(GAMEPLAY_SETTINGS.map(setting => [setting.path, setting]));
export function settingValue(config: GameplayConfig, path: string): SettingValue {
  let value: unknown = config;
  for (const key of path.split('.')) value = (value as Record<string, unknown>)[key];
  return value as SettingValue;
}
export interface TuningPreset { version: 1; name: string; overrides: Overrides }
function resolve(overrides: Overrides): GameplayConfig {
  const config = structuredClone(DEFAULT_GAMEPLAY_CONFIG);
  for (const [path, value] of Object.entries(overrides)) {
    const setting = byPath.get(path);
    if (!setting) throw new Error(`Parámetro desconocido: ${path}`);
    const numbers = setting.array && Array.isArray(value) ? value : [value];
    if (setting.array && (!Array.isArray(value) || value.length < 1 || value.length > 15
      || value.some((angle, index) => index > 0 && angle <= value[index - 1]!))) throw new Error(`${path}: use 1–15 ángulos únicos en orden ascendente.`);
    if (numbers.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < setting.min || n > setting.max
      || (setting.step === 1 && !Number.isInteger(n)))) throw new Error(`${path}: valor inválido (${setting.min}…${setting.max}).`);
    let target = config as unknown as Record<string, unknown>;
    const keys = path.split('.');
    for (const key of keys.slice(0,-1)) target = target[key] as Record<string, unknown>;
    target[keys[keys.length - 1]!] = structuredClone(value);
  }
  if (config.boss.phase2Threshold <= config.boss.phase3Threshold) throw new Error('Boss: phase2Threshold debe ser mayor que phase3Threshold.');
  if (config.powerups.warningTime > config.powerups.lifetime) throw new Error('Powerups: warningTime debe ser menor o igual que lifetime.');
  return freeze(config);
}
export function parseTuningPreset(input: unknown): TuningPreset {
  if (!input || typeof input !== 'object') throw new Error('Preset inválido.');
  const data = input as Record<string, unknown>;
  if (data.version !== 1 || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80
    || !data.overrides || typeof data.overrides !== 'object' || Array.isArray(data.overrides)) throw new Error('Formato/version de preset inválido.');
  const overrides = data.overrides as Overrides;
  resolve(overrides);
  return { version: 1, name: data.name.trim(), overrides: freeze(structuredClone(overrides)) };
}
export class GameplayConfigStore implements GameplayConfigSource {
  private current = DEFAULT_GAMEPLAY_CONFIG;
  private overrides: Overrides = Object.freeze({});
  private readonly listeners = new Set<() => void>();
  get(): GameplayConfig { return this.current; }
  getOverrides(): Overrides { return this.overrides; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  setOverride(path: string, value: SettingValue): void { this.replace({ ...this.overrides, [path]: value }); }
  resetOverride(path: string): void { const next = { ...this.overrides }; delete next[path]; this.replace(next); }
  resetSection(category: string): void { this.replace(Object.fromEntries(Object.entries(this.overrides).filter(([path]) => byPath.get(path)?.category !== category))); }
  resetAll(): void { this.replace({}); }
  replace(overrides: Overrides): void {
    const current = resolve(overrides);
    this.overrides = freeze(Object.fromEntries(Object.entries(overrides).filter(([path, value]) => JSON.stringify(value) !== JSON.stringify(settingValue(DEFAULT_GAMEPLAY_CONFIG, path)))));
    this.current = current;
    for (const listener of this.listeners) listener();
  }
  preset(name: string): TuningPreset { return parseTuningPreset({ version: 1, name, overrides: this.overrides }); }
}
