import { validateLighting } from './LevelLighting';
import type { LevelData } from './Level';
import type { CameraZone } from '../camera/CameraZone';
import type { AABB } from '../collision/CollisionSystem';
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
  spawnGroups: { id: string; x: number; y?:number;width?:number;height?:number; enemies: (EnemyPlacement & { id: string; facing?: -1 | 1 })[] }[];
  checkpoints: (LevelData['checkpoints'][number] & { id: string })[];
  boss: LevelData['boss'] & { id: string };
  sections: { id: string; x: number; name: string;area?:AABB }[];
  cameraZones?:CameraZone[];
  killZones?:(AABB&{id:string})[];
  decorations: Decoration[];
  backgrounds: BackgroundLayer[];
  automaticTerrain: boolean;
  pickups?: { id: string; kind: 'M' | 'S' | 'L'; x: number; y: number }[];
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
    pickups: data.pickups?.map(p => ({ ...p })),
    cameraZones:data.cameraZones?.map(z=>({...z})),
    killZones:data.killZones?.map((z,i)=>({...z,id:'id' in z?String(z.id):`kill-${i}`})),
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
  if (value.nextLevel !== undefined && (typeof value.nextLevel !== 'string' || !/^levels\/[a-zA-Z0-9_-]+\.json$/.test(value.nextLevel))) errors.push('Invalid nextLevel: expected levels/<id>.json.');
  if (!num(value.width) || value.width < 256 || value.width > 100000) errors.push('World width must be 256–100000.');
  if (!num(value.height)||value.height<240||value.height>10000) errors.push('World height must be 240–10000.');
  if (typeof value.automaticTerrain !== 'boolean') errors.push('automaticTerrain must be boolean.');
  if (value.environmentSkin !== undefined && !['underground','tower'].includes(String(value.environmentSkin))) errors.push('Unknown environmentSkin.');
  const object = (v: unknown, label: string, size = false) => {
    if (!record(v)) { errors.push(`${label}: object required.`); return false; }
    if (typeof v.id !== 'string' || !v.id || ids.has(v.id)) errors.push(`${label}: missing/duplicate id.`);
    else ids.add(v.id);
    if (!num(v.x) || !num(v.y)) errors.push(`${label}: finite x/y required.`);
    else if (num(value.width) && (v.x < 0 || v.x >= value.width || v.y < 0 || !num(value.height) || v.y > value.height)) errors.push(`${label}: outside world.`);
    if (size && (!num(v.width) || !num(v.height) || v.width <= 0 || v.height <= 0)) errors.push(`${label}: positive width/height required.`);
    if (size && num(v.x) && num(v.width) && num(value.width)) {
      const half = label === 'decoration' && !v.tiled;
      if (v.x + v.width / (half ? 2 : 1) > value.width || (half && v.x - v.width / 2 < 0)) warnings.push(`${label}: extends beyond world.`);
    }
    if (size && num(v.y) && num(v.height) && v.y + v.height > Number(value.height)) warnings.push(`${label}: extends above world.`);
    return true;
  };
  const rect=(v:unknown,label:string):void=>{
    if(!record(v)||!num(v.x)||!num(v.y)||!num(v.width)||!num(v.height)||v.width<=0||v.height<=0
      ||v.x<0||v.y<0||v.x+v.width>Number(value.width)||v.y+v.height>Number(value.height))errors.push(`Invalid ${label} rectangle.`);
  };
  for(const key of ['cameraZones','killZones'])if(value[key]!==undefined){
    if(!Array.isArray(value[key])||value[key].length>1000)errors.push(`Invalid ${key} array.`);
    else for(const zone of value[key]){object(zone,key,true);rect(zone,key);
      if(key==='cameraZones'&&record(zone)&&(!['HORIZONTAL_FOLLOW','VERTICAL_FOLLOW','LOCKED'].includes(String(zone.mode))
        ||(zone.transitionDuration!==undefined&&(!num(zone.transitionDuration)||zone.transitionDuration<0||zone.transitionDuration>2))))errors.push('Invalid camera mode/transition.');}
  }
  if(value.exitArea!==undefined)rect(value.exitArea,'exitArea');
  errors.push(...validateLighting(value.lighting));
  if(record(value.lighting)&&Array.isArray(value.lighting.lights)&&value.lighting.lights.length>24)warnings.push('More than 24 static lights: check lighting performance.');
  if(record(value.lighting)&&Array.isArray(value.lighting.lights))for(const light of value.lighting.lights)if(record(light))object(light,'light');
  if(record(value.boss)){
    if (value.boss.gateLayout !== undefined) {
      const layout = value.boss.gateLayout;
      if (value.boss.kind !== 'gate' || !record(layout)) errors.push('gateLayout requires a gate boss.');
      else for (const key of ['turrets', 'hatches']) {
        const parts = layout[key];
        if (!Array.isArray(parts) || parts.length !== 2) { errors.push(`gateLayout.${key}: exactly two offsets required.`); continue; }
        for (const part of parts) {
          if (!record(part) || !num(part.x) || !num(part.y) || Math.abs(part.x) > 2048 || Math.abs(part.y) > 2048)
            errors.push(`gateLayout.${key}: finite offsets within ±2048 required.`);
          else if (!num(value.boss.x) || !num(value.boss.y) || value.boss.x + part.x < 0 || value.boss.x + part.x >= Number(value.width)
            || value.boss.y + part.y < 0 || value.boss.y + part.y > Number(value.height)) errors.push(`gateLayout.${key}: component outside world.`);
        }
      }
    }
    if(value.boss.kind!==undefined&&value.boss.kind!=='gate')errors.push('Invalid boss kind.');
    if(value.boss.kind==='gate'&&(value.boss.arena===undefined||value.boss.trigger===undefined||value.boss.encounter!==undefined))errors.push('Gate needs arena and trigger.');
    if(value.boss.arena!==undefined)rect(value.boss.arena,'boss arena');
    if(value.boss.trigger!==undefined)rect(value.boss.trigger,'boss trigger');
  }
  object(value.spawn, 'playerSpawn'); object(value.boss, 'boss');
  if (record(value.boss) && (!num(value.boss.arenaLeft) || value.boss.arenaLeft < 0
    || !num(value.width) || value.boss.arenaLeft > value.width - 256
    || !num(value.boss.x) || value.boss.x < value.boss.arenaLeft)) errors.push('Invalid boss trigger/arena.');
  if (record(value.boss) && value.boss.encounter !== undefined) {
    const e = value.boss.encounter;
    if (!record(e) || e.type !== 'pursuit' || !num(e.retreatLeft) || !num(e.barrierX) || !num(e.cameraAnchor)
      || e.retreatLeft < 0 || !num(value.boss.arenaLeft) || e.retreatLeft >= value.boss.arenaLeft
      || e.barrierX <= value.boss.arenaLeft || !num(value.width) || e.barrierX > value.width
      || !num(value.boss.x) || value.boss.x < e.barrierX
      || e.cameraAnchor < .1 || e.cameraAnchor > .5
      || !num(value.exitX) || value.exitX < e.retreatLeft || value.exitX >= value.boss.arenaLeft) errors.push('Invalid pursuit encounter/retreat exit.');
  }
  if (!num(value.exitX) || value.exitX < 0 || !num(value.width) || value.exitX > value.width) errors.push('Invalid exitX.');
  const array = (key: string): unknown[] => {
    if (!Array.isArray(value[key])) { errors.push(`${key}: array required.`); return []; }
    if (value[key].length > 10000) { errors.push(`${key}: maximum 10000 objects.`); return []; }
    return value[key];
  };
  for (const item of array('ground')) object(item, 'ground', true);
  if (value.pickups !== undefined) {
    if (!Array.isArray(value.pickups) || value.pickups.length > 100) errors.push('Invalid pickups array.');
    else for (const item of value.pickups) if (object(item, 'pickup') && record(item) && !['M','S','L'].includes(String(item.kind))) errors.push('Invalid pickup kind.');
  }
  for (const item of array('platforms')) if (object(item, 'platform', true) && record(item)
    && !['solid', 'one-way'].includes(String(item.kind))) errors.push('Invalid platform kind.');
  for (const item of array('checkpoints')) if (object(item, 'checkpoint') && record(item)
    ) {
      if(typeof item.name!=='string')errors.push('Checkpoint name required.');
      if(item.area!==undefined){rect(item.area,'checkpoint');if(!num(item.order)||item.order<0||!Number.isInteger(item.order))errors.push('Checkpoint order required.');}
    }
  for (const item of array('sections')) {
    if (!record(item) || typeof item.id !== 'string' || ids.has(item.id) || !num(item.x) || typeof item.name !== 'string') errors.push('Invalid section.');
    else {ids.add(item.id);if(item.area!==undefined)rect(item.area,'section');}
  }
  for (const group of array('spawnGroups')) {
    if (!record(group) || typeof group.id !== 'string' || ids.has(group.id) || !num(group.x)
      || group.x < 0 || !num(value.width) || group.x >= value.width || !Array.isArray(group.enemies)) { errors.push('Invalid spawn trigger.'); continue; }
    ids.add(group.id);
    if(group.y!==undefined||group.width!==undefined||group.height!==undefined)rect(group,'trigger');
    if (!group.enemies.length) warnings.push(`${group.id}: trigger has no enemies.`);
    if (group.enemies.length > 1000) { errors.push('Too many enemies in trigger.'); continue; }
    for (const enemy of group.enemies) if (object(enemy, 'enemy') && record(enemy)) {
      if (!['soldier', 'runner', 'turret', 'flying','robotDog','mecha','gateTurret','gateHatch'].includes(String(enemy.kind))) errors.push('Invalid enemy kind.');
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
