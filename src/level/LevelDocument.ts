import type { LevelData } from './Level';
import type { EnemyPlacement } from '../entities/enemies/EnemyManager';
import { ASSETS } from '../config/assets';
import { PARALLAX } from '../config/constants';
import { environmentLayout } from '../rendering/environmentLayout';

export interface Decoration {
  id: string; asset: string; x: number; y: number; width: number; height: number;
  layer: 'back' | 'terrain' | 'front'; flipX: boolean; tiled: boolean;
}
export interface BackgroundLayer { asset: string; speed: number; offsetX: number; offsetY: number }
export interface LevelDocument extends LevelData {
  version: 1; id: string; height: number;
  spawn: { id: string; x: number; y: number };
  ground: (LevelData['ground'][number] & { id: string })[];
  platforms: (LevelData['platforms'][number] & { id: string })[];
  spawnGroups: { id: string; x: number; enemies: (EnemyPlacement & { id: string; facing?: -1 | 1 })[] }[];
  checkpoints: (LevelData['checkpoints'][number] & { id: string })[];
  boss: LevelData['boss'] & { id: string };
  sections: { id: string; x: number; name: string }[];
  decorations: Decoration[];
  backgrounds: BackgroundLayer[];
  automaticTerrain: boolean;
}
export const defaultBackgrounds = (): BackgroundLayer[] => [
  { asset: 'background.far', speed: PARALLAX.background, offsetX: 0, offsetY: 0 },
  { asset: 'background.mid', speed: PARALLAX.midground, offsetX: 0, offsetY: 0 },
  { asset: 'background.near', speed: PARALLAX.foreground, offsetX: 0, offsetY: 0 },
];
export function convertLegacyLevel(data: LevelData, id = 'level-01'): LevelDocument {
  const layout = environmentLayout(data);
  return {
    ...structuredClone(data), version: 1, id, height: 240, automaticTerrain: true,
    spawn: { ...data.spawn, id: 'player-spawn' }, boss: { ...data.boss, id: 'boss' },
    ground: data.ground.map((o, i) => ({ ...o, id: `ground-${i + 1}` })),
    platforms: data.platforms.map((o, i) => ({ ...o, id: `platform-${i + 1}` })),
    checkpoints: data.checkpoints.map((o, i) => ({ ...o, id: `checkpoint-${i + 1}` })),
    sections: data.sections.map((o, i) => ({ ...o, id: `section-${i + 1}` })),
    spawnGroups: data.spawnGroups.map((g, i) => ({ ...g, id: `trigger-${i + 1}`,
      enemies: g.enemies.map((e, j) => ({ ...e, id: `enemy-${i + 1}-${j + 1}` })) })),
    decorations: [...layout.walls.map((w, i): Decoration => ({ ...w, id: `wall-${i + 1}`, asset: w.id, layer: 'back', tiled: true, flipX: false })),
      ...layout.props.map((p, i): Decoration => ({ id: `decor-${i + 1}`, asset: p.id, x: p.x, y: p.y,
        width: ASSETS[p.id]!.visual.width, height: ASSETS[p.id]!.visual.height,
        layer: p.id.includes('branch') ? 'front' : 'back', tiled: false, flipX: false }))],
    backgrounds: defaultBackgrounds(),
  };
}
export function createLevel(id: string, name: string, width: number, height = 240): LevelDocument {
  return { version: 1, id, name, width, height, spawn: { id: 'player-spawn', x: 32, y: 44 },
    ground: [], platforms: [], spawnGroups: [], checkpoints: [], sections: [],
    boss: { id: 'boss', x: width - 100, y: 44, arenaLeft: width - 256 }, exitX: width - 64,
    decorations: [], backgrounds: defaultBackgrounds(), automaticTerrain: true };
}
export interface Validation { errors: string[]; warnings: string[] }
/** Import is an untrusted boundary; reject malformed data before constructing runtime objects. */
export function validateLevel(value: unknown): Validation {
  const errors: string[] = [], warnings: string[] = [], ids = new Set<string>();
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!record(value)) return { errors: ['Level must be a JSON object.'], warnings };
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (value.version !== 1) errors.push('Unsupported schema version; expected 1.');
  if (typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value.id)) errors.push('Invalid level id.');
  if (typeof value.name !== 'string' || !value.name.trim()) errors.push('Level name required.');
  if (!num(value.width) || value.width < 256 || value.width > 100000) errors.push('World width must be 256–100000.');
  if (value.height !== 240) errors.push('Current runtime supports height 240 only; vertical camera modes are not implemented.');
  if (typeof value.automaticTerrain !== 'boolean') errors.push('automaticTerrain must be boolean.');
  const object = (v: unknown, label: string, size = false) => {
    if (!record(v)) { errors.push(`${label}: object required.`); return false; }
    if (typeof v.id !== 'string' || !v.id || ids.has(v.id)) errors.push(`${label}: missing/duplicate id.`);
    else ids.add(v.id);
    if (!num(v.x) || !num(v.y)) errors.push(`${label}: finite x/y required.`);
    else if (num(value.width) && (v.x < 0 || v.x >= value.width || v.y < 0 || v.y > 240)) errors.push(`${label}: outside world.`);
    if (size && (!num(v.width) || !num(v.height) || v.width <= 0 || v.height <= 0)) errors.push(`${label}: positive width/height required.`);
    if (size && num(v.x) && num(v.width) && num(value.width)) {
      const half = label === 'decoration' && !v.tiled;
      if (v.x + v.width / (half ? 2 : 1) > value.width || (half && v.x - v.width / 2 < 0)) warnings.push(`${label}: extends beyond world.`);
    }
    if (size && num(v.y) && num(v.height) && v.y + v.height > 240) warnings.push(`${label}: extends above world.`);
    return true;
  };
  object(value.spawn, 'playerSpawn'); object(value.boss, 'boss');
  if (record(value.boss) && (!num(value.boss.arenaLeft) || value.boss.arenaLeft < 0
    || !num(value.width) || value.boss.arenaLeft > value.width - 256
    || !num(value.boss.x) || value.boss.x < value.boss.arenaLeft)) errors.push('Invalid boss trigger/arena.');
  if (!num(value.exitX) || value.exitX < 0 || !num(value.width) || value.exitX > value.width) errors.push('Invalid exitX.');
  const array = (key: string): unknown[] => {
    if (!Array.isArray(value[key])) { errors.push(`${key}: array required.`); return []; }
    if (value[key].length > 10000) { errors.push(`${key}: maximum 10000 objects.`); return []; }
    return value[key];
  };
  for (const item of array('ground')) object(item, 'ground', true);
  for (const item of array('platforms')) if (object(item, 'platform', true) && record(item)
    && !['solid', 'one-way'].includes(String(item.kind))) errors.push('Invalid platform kind.');
  for (const item of array('checkpoints')) if (object(item, 'checkpoint') && record(item)
    && typeof item.name !== 'string') errors.push('Checkpoint name required.');
  for (const item of array('sections')) {
    if (!record(item) || typeof item.id !== 'string' || ids.has(item.id) || !num(item.x) || typeof item.name !== 'string') errors.push('Invalid section.');
    else ids.add(item.id);
  }
  for (const group of array('spawnGroups')) {
    if (!record(group) || typeof group.id !== 'string' || ids.has(group.id) || !num(group.x)
      || group.x < 0 || !num(value.width) || group.x >= value.width || !Array.isArray(group.enemies)) { errors.push('Invalid spawn trigger.'); continue; }
    ids.add(group.id);
    if (!group.enemies.length) warnings.push(`${group.id}: trigger has no enemies.`);
    if (group.enemies.length > 1000) { errors.push('Too many enemies in trigger.'); continue; }
    for (const enemy of group.enemies) if (object(enemy, 'enemy') && record(enemy)) {
      if (!['soldier', 'runner', 'turret', 'flying'].includes(String(enemy.kind))) errors.push('Invalid enemy kind.');
      if (enemy.facing !== undefined && enemy.facing !== -1 && enemy.facing !== 1) errors.push('Invalid facing.');
      if (enemy.weaponDrop !== undefined && (enemy.kind !== 'flying' || !['M', 'S', 'L'].includes(String(enemy.weaponDrop)))) errors.push('Invalid FlyingEnemy drop.');
      if (enemy.firingMode !== undefined && (enemy.kind !== 'turret' || !['aimed', 'horizontal'].includes(String(enemy.firingMode)))) errors.push('Invalid Turret firingMode.');
    }
  }
  for (const item of array('decorations')) if (object(item, 'decoration', true) && record(item)) {
    if (typeof item.asset !== 'string' || !Object.hasOwn(ASSETS, item.asset)
      || !/^(environment\.|background\.)/.test(item.asset)) errors.push('Unknown environment asset.');
    if (!['back', 'terrain', 'front'].includes(String(item.layer)) || typeof item.flipX !== 'boolean' || typeof item.tiled !== 'boolean') errors.push('Invalid decoration layer/flags.');
    if (item.tiled && typeof item.asset === 'string' && !ASSETS[item.asset]?.tileable) errors.push('Asset does not support tiling.');
  }
  const backgrounds = array('backgrounds');
  if (backgrounds.length !== 3) errors.push('Exactly FAR/MID/NEAR layers required.');
  for (const layer of backgrounds) if (!record(layer) || typeof layer.asset !== 'string'
    || !Object.hasOwn(ASSETS, layer.asset) || !layer.asset.startsWith('background.') || !num(layer.speed)
    || layer.speed < 0 || layer.speed > 1 || !num(layer.offsetX) || !num(layer.offsetY)) errors.push('Invalid background configuration.');
  if (Array.isArray(value.ground) && !value.ground.length) warnings.push('No ground: player will fall until the existing kill plane.');
  return { errors, warnings };
}
/** Central migration boundary: add explicit old-version transforms here when version 2 exists. */
export function parseLevel(value: unknown): LevelDocument {
  const result = validateLevel(value);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  return structuredClone(value) as LevelDocument;
}
export function exportLevel(data: LevelDocument): string { return JSON.stringify(parseLevel(data), null, 2); }
export async function loadLevel(url: string): Promise<LevelDocument> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Level load failed: ${response.status}`);
  return parseLevel(await response.json());
}
