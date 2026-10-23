import type { AnimationClip } from '../rendering/SpriteAnimator';
import type { VisualConfig } from './graphics';
import { VFX_EFFECTS } from './vfx';
import type { VfxConfig } from './vfx';
import { ENVIRONMENT_ASSETS } from './environment';
import type { EnvironmentAsset } from './environment';
import { withArtScale } from '../rendering/artDimensions';
import { PROJECTILE_ART } from './projectileArt';
import { TURRET_ART } from './turretArt';

export interface AtlasFrame { x: number; y: number; width: number; height: number }
export interface SpriteSheet {
  frameWidth: number; frameHeight: number; frameCount: number;
  columns?: number; margin?: number; spacing?: number;
  atlas?: readonly AtlasFrame[];
}
export interface SpriteAsset {
  /** Source pixel density, independent of render density and visual.scaleX/Y. Legacy defaults to 1. */
  artScale?: 1 | 2;
  /** Set url when the PNG exists; planned paths never cause network requests. */
  url?: string;
  path: string;
  sheet: SpriteSheet;
  visual: VisualConfig;
  clip: AnimationClip;
  /** Aim variants include the weapon; plain body sheets retain the aiming gun fallback. */
  includesWeapon?: boolean;
  /** Internal atlas pieces are used by composed visuals, not standalone viewer clips. */
  internal?: boolean;
  tileable?: boolean;
}
export type AssetManifest = Readonly<Record<string, SpriteAsset>>;

const visual = (width: number, height: number, anchor: VisualConfig['anchor'] = 'bottom-center'): VisualConfig =>
  ({ width, height, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, anchor });
// Legacy registration uses an explicit 1× contract. New sources use withArtScale or explicit sheet + visual.
const sprite = (path: string, worldWidth: number, worldHeight: number, count = 1, fps = 6,
  anchor: VisualConfig['anchor'] = 'bottom-center', loop = true): SpriteAsset => ({
  artScale: 1,
  path: `assets/${path}.png`, sheet: { frameWidth: worldWidth, frameHeight: worldHeight, frameCount: count },
  visual: visual(worldWidth, worldHeight, anchor),
  clip: { frames: Array.from({ length: count }, (_, i) => i), frameRate: fps, loop },
});

// All Player sources use 64px cells while their visual bounds remain 32 world units.
const playerSprite = (file: string, count: number, fps: number, loop = true): SpriteAsset => {
  const asset = withArtScale(sprite(`sprites/player/${file}`, 32, 32, count, fps, 'bottom-center', loop), 2);
  return { ...asset, url: asset.path, includesWeapon: true };
};


// Each animation may point to its own strip, or share a sheet/atlas URL with different frame indices.
export const ASSETS: Record<string, SpriteAsset> = {
  'player.idle': playerSprite('player_idle_2x (2)', 4, 6),
  'player.idle_up': playerSprite('player_idle_up_2x', 1, 1),
  'player.idle_diagonal': playerSprite('player_idle_diagonal_2x', 1, 1),
  'player.run': playerSprite('player_run_2x (2)', 6, 11),
  'player.jump': playerSprite('player_jump_2x', 2, 6),
  'player.fall': playerSprite('player_fall_2x', 2, 6),
  'player.crouch': playerSprite('player_crouch_2x', 2, 7, false),
  'player.shoot': playerSprite('player_shoot_horizontal_2x', 2, 12),
  'player.shoot_horizontal': playerSprite('player_shoot_horizontal_2x', 2, 12),
  'player.shoot_up': playerSprite('player_shoot_up_2x', 2, 12),
  'player.shoot_diagonal': playerSprite('player_shoot_diagonal_2x', 2, 12),
  'player.runShoot': playerSprite('player_runShoot_horizontal_2x', 6, 10),
  'player.runShoot_horizontal': playerSprite('player_runShoot_horizontal_2x', 6, 11),
  'player.runShoot_up': playerSprite('player_runShoot_up_2x', 6, 11),
  'player.runShoot_diagonal': playerSprite('player_runShoot_diagonal_2x', 6, 11),
  'player.jumpShoot': playerSprite('player_jumpShoot_horizontal_2x', 2, 12),
  'player.jumpShoot_horizontal': playerSprite('player_jumpShoot_horizontal_2x', 2, 12),
  'player.jumpShoot_up': playerSprite('player_jumpShoot_up_2x', 2, 12),
  'player.jumpShoot_diagonal': playerSprite('player_jumpShoot_diagonal_2x', 2, 12),
  'player.crouchShoot': playerSprite('player_crouchShoot_horizontal_2x', 2, 12),
  'player.crouchShoot_horizontal': playerSprite('player_crouchShoot_horizontal_2x', 2, 12),
  'player.aim_down': playerSprite('player_aim_down', 1, 1),
  'player.aim_diagonalDown': playerSprite('player_aim_diagonalDown', 1, 1),
  'player.jumpShoot_down': playerSprite('player_jumpShoot_down', 2, 12),
  'player.jumpShoot_diagonalDown': playerSprite('player_jumpShoot_diagonalDown', 2, 12),
  'player.death': playerSprite('player_death_2x', 6, 10, false),
  'soldier.idle': { ...withArtScale(sprite('sprites/enemies/soldier/soldier_idle', 32, 32, 4, 6), 2),
    url: 'assets/sprites/enemies/soldier/soldier_idle.png', includesWeapon: true },
  'soldier.run': { ...withArtScale(sprite('sprites/enemies/soldier/soldier_run', 32, 32, 6, 10), 2),
    url: 'assets/sprites/enemies/soldier/soldier_run.png', includesWeapon: true },
  'soldier.shoot': { ...withArtScale(sprite('sprites/enemies/soldier/soldier_shoot', 32, 32, 2, 12), 2),
    url: 'assets/sprites/enemies/soldier/soldier_shoot.png', includesWeapon: true },

  'soldier.death': { ...withArtScale(sprite('sprites/enemies/soldier/soldier_death', 32, 32, 6, 10, 'bottom-center', false), 2),
    url: 'assets/sprites/enemies/soldier/soldier_death.png', includesWeapon: true },

  'runner.run': { ...withArtScale(sprite('sprites/enemies/runner/runner_run', 24, 24, 6, 12), 2),
    url: 'assets/sprites/enemies/runner/runner_run.png' },
  'runner.death': { ...withArtScale(sprite('sprites/enemies/runner/runner_death', 24, 24, 6, 10, 'bottom-center', false), 2),
    url: 'assets/sprites/enemies/runner/runner_death.png' },
  'turret.idle': { ...withArtScale(sprite('sprites/enemies/turret/turret_idle', 24, 24, 2, 6), 2),
    url: 'assets/sprites/enemies/turret/turret_idle.png', includesWeapon: true },
  'turret.shoot': { ...withArtScale(sprite('sprites/enemies/turret/turret_shoot', 24, 24, 3, 10), 2),
    url: 'assets/sprites/enemies/turret/turret_shoot.png', includesWeapon: true },
  'turret.death': { ...withArtScale(sprite('sprites/enemies/turret/turret_death', 24, 24, 6, 10, 'bottom-center', false), 2),
    url: 'assets/sprites/enemies/turret/turret_death.png', includesWeapon: true },
  'flying.fly': { ...sprite('sprites/enemies/flying/flying_fly', 32, 24, 4, 10, 'center'),
    url: 'assets/sprites/enemies/flying/flying_fly.png' },
  'flying.hit': { ...sprite('sprites/enemies/flying/flying_hit', 32, 24, 1, 12, 'center'),
    url: 'assets/sprites/enemies/flying/flying_hit.png' },
  'flying.death': { ...sprite('sprites/enemies/flying/flying_death', 32, 24, 6, 12, 'center', false),
    url: 'assets/sprites/enemies/flying/flying_death.png' },
  'flying.carrier.pod': { ...sprite('sprites/enemies/flying/flying_carrier_pod', 12, 10, 1, 1),
    url: 'assets/sprites/enemies/flying/flying_carrier_pod.png' },
  'pickup.M': sprite('sprites/weapons/machinegun', 16, 16, 4, 8),
  'pickup.S': sprite('sprites/weapons/spread', 16, 16, 4, 8),
  'pickup.L': sprite('sprites/weapons/laser', 16, 16, 4, 8),
  'boss.idle': sprite('sprites/boss/boss_idle', 64, 80),
  'boss.attack': sprite('sprites/boss/boss_attack', 64, 80, 4, 10),
  'boss.damage': sprite('sprites/boss/boss_damage', 64, 80, 2, 12),
  'boss.death': sprite('sprites/boss/boss_death', 64, 80, 6, 10, 'bottom-center', false),
  'projectile.player.bullet': sprite('sprites/weapons/rifle', 4, 4, 1, 1, 'center'),
  'projectile.enemy.bullet': sprite('sprites/weapons/enemy_bullet', 4, 4, 1, 1, 'center'),
  'projectile.player.laser': sprite('sprites/weapons/laser_bullet', 12, 4, 2, 12, 'center'),
  'background.far': sprite('background/layer_far', 256, 240, 1, 1, 'center'),
  'background.mid': sprite('background/layer_mid', 256, 240, 1, 1, 'center'),
  'background.near': sprite('background/layer_near', 256, 240, 1, 1, 'center'),
  'environment.ground': sprite('sprites/environment/ground', 16, 16),
  'environment.platform': sprite('sprites/environment/platform', 16, 8),
  'environment.edge': sprite('sprites/environment/edge', 16, 16),
  'environment.vegetationBack': sprite('sprites/environment/vegetation_back', 32, 32),
  'environment.vegetationFront': sprite('sprites/environment/vegetation_front', 32, 32),
  'environment.decoration': sprite('sprites/environment/decoration', 32, 32),
};
for (const [id, effect] of Object.entries(VFX_EFFECTS)) {
  const spec: VfxConfig = effect;
  const asset = withArtScale(sprite(`sprites/fx/${spec.file}`, spec.width, spec.height, spec.frames, spec.fps, 'center', false), spec.artScale ?? 1);
  if (spec.enabled) asset.url = asset.path;
  ASSETS[id] = asset;
}
for (const [id, definition] of Object.entries(ENVIRONMENT_ASSETS)) {
  const spec: EnvironmentAsset = definition;
  const asset = withArtScale(sprite(`environment/${spec.file}`, spec.width, spec.height, spec.frames ?? 1,
    spec.fps ?? 1, id.startsWith('background.') ? 'center' : 'bottom-center', (spec.frames ?? 1) > 1), spec.artScale ?? 1);
  asset.tileable = spec.tileable;
  if (spec.enabled) asset.url = asset.path;
  ASSETS[id] = asset;
}
for (const [id, asset] of Object.entries(ASSETS)) {
  if (id === 'player.run' || id.startsWith('player.runShoot_')) asset.clip.syncGroup = 'player.run';
  if (id.startsWith('background.') || id === 'environment.ground' || id === 'environment.platform') asset.tileable = true;
}
// Approved underground kit: 2× sources retain the existing world dimensions.
for (const [id, definition] of Object.entries(ENVIRONMENT_ASSETS)) {
  if (!/^environment\.(ground|platform)\./.test(id)) continue;
  const file = definition.file.split('/').at(-1)!.replace('ground_', 'ground_future_');
  const asset = withArtScale(sprite(`environment/tiles/underground/${file}`, definition.width, definition.height, 1, 1), 2);
  asset.url = asset.path;
  asset.tileable = true;
  ASSETS[id.replace('environment.', 'environment.underground.')] = asset;
}
for (const [id, file, width, height] of [
  ['wall.panel', 'panel_wall', 16, 16], ['prop.pipe', 'prop_pipe_large', 32, 48],
  ['prop.console', 'prop_console', 32, 24], ['prop.gate', 'prop_gate', 48, 80],
] as const) {
  const asset = withArtScale(sprite(`environment/props/underground/${file}`, width, height, 1, 1), 2);
  asset.url = asset.path;
  asset.tileable = id.startsWith('wall.'); ASSETS[`environment.underground.${id}`] = asset;
}
for (const layer of ['far','mid','near']) {
  const asset = withArtScale(sprite(`environment/background/underground/bg_underground_${layer}`, 256, 240, 1, 1, 'center'), 2);
  asset.url = asset.path;
  asset.tileable = true; ASSETS[`background.underground.${layer}`] = asset;
}
for (const [clip, frames, fps, loop] of [['idle',4,6,true],['move',6,10,true],['fire',3,12,false],['damage',2,12,false],['death',6,10,false]] as const) {
  ASSETS[`boss.mecha.${clip}`] = withArtScale(sprite(`sprites/boss/mecha/boss_mecha_${clip}`, 64, 80, frames, fps, 'bottom-center', loop), 2);
  ASSETS[`boss.mecha.${clip}`]!.url = ASSETS[`boss.mecha.${clip}`]!.path;
}
// Approved arena boss strips: 128×160 source cells, unchanged 64×80 world visuals.
for (const id of ['boss.idle', 'boss.attack', 'boss.damage', 'boss.death']) {
  const asset = withArtScale(ASSETS[id]!, 2);
  ASSETS[id] = { ...asset, url: asset.path };
}
ASSETS['projectile.enemy.missile'] = withArtScale(sprite('sprites/boss/mecha/boss_missile', 12, 6, 2, 12, 'center'), 2);
ASSETS['projectile.enemy.missile'].url = ASSETS['projectile.enemy.missile'].path;
// Approved tower kit uses 2× sources with the original world sizes and anchors.
for(const [id,asset] of Object.entries(ASSETS))if(id.includes('.underground.')){
  const next=id.replace('.underground.','.tower.');
  const path=asset.path.replace('/underground/','/tower/').replace('ground_future','ground_tower').replace('bg_underground','bg_tower');
  ASSETS[next]={...asset,path,url:path};
}
for(const [prefix,file,w,h,clips] of [
  ['robotDog','enemies/robotDog/robot_dog',24,16,[['run',6,12,true],['attack',2,12,true],['death',5,10,false]]],
  ['bossGate','boss/gate/boss_gate',64,80,[['idle',1,1,true],['damage',2,12,false],['destroy',6,10,false]]],
  ['bossGateTurret','boss/gate/boss_gate_turret',32,32,[['idle',1,1,true],['fire',3,12,false],['destroy',5,10,false]]],
  ['bossGateHatch','boss/gate/boss_gate_hatch',32,32,[['open',3,10,false],['close',3,10,false]]],
] as const)for(const [clip,count,fps,loop] of clips){
  const asset=withArtScale(sprite(`sprites/${file}_${clip}`,w,h,count,fps,'bottom-center',loop),2);
  ASSETS[`${prefix}.${clip}`]={...asset,url:asset.path,includesWeapon:prefix==='bossGateTurret'};
}
ASSETS['environment.tower.animated.light']=withArtScale(sprite('environment/animated/tower/warning_light',16,16,4,6),2);
ASSETS['environment.tower.animated.light'].url=ASSETS['environment.tower.animated.light'].path;
// Placeable variants reference the same definitions/URLs; no duplicate textures.
for (const [prefix, source] of [['mecha','boss.mecha'],['gateTurret','bossGateTurret'],['gateHatch','bossGateHatch']] as const)
  for (const [id, asset] of Object.entries(ASSETS)) if (id.startsWith(source + '.')) ASSETS[prefix + id.slice(source.length)] = asset;
ASSETS['gateHatch.idle'] = ASSETS['bossGateHatch.close']!;
for (const [frame, kind] of ['M', 'S', 'L'].entries()) {
  ASSETS[`flying.carrier.${kind}`] = {
    ...sprite('sprites/enemies/flying/flying_carrier_labels', 3, 5, 3, 1),
    url: 'assets/sprites/enemies/flying/flying_carrier_labels.png',
    visual: { ...visual(3, 5), offsetX: 0.5, offsetY: 3 }, clip: { frames: [frame], frameRate: 1, loop: true },
  };
}

// Single-frame 2× projectile art; world envelopes match the previous fallback renderer.
for (const [id, file] of Object.entries(PROJECTILE_ART)) {
  const asset = withArtScale(sprite(`sprites/projectiles/${file}`, file === 'player_laser' ? 12 : 3, 3, 1, 1, 'center'), 2);
  ASSETS[id] = { ...asset, url: asset.path };
}

// Atlas views of existing PNGs: fixed support + rotating head, shared textures.
for (const [prefix, joint] of Object.entries(TURRET_ART)) for (const animation of ['idle', prefix === 'turret' ? 'shoot' : 'fire']) {
  const asset = ASSETS[`${prefix}.${animation}`]!;
  const { frameWidth, frameHeight, frameCount } = asset.sheet;
  const sx = asset.visual.width / frameWidth, sy = asset.visual.height / frameHeight;
  for (const part of ['base', 'head'] as const) {
    const y = part === 'base' ? joint.splitY : 0;
    const height = part === 'base' ? frameHeight - joint.splitY : joint.splitY;
    ASSETS[`${prefix}.parts.${animation}.${part}`] = {
      ...asset, internal: true,
      sheet: { frameWidth, frameHeight: height, frameCount,
        atlas: Array.from({ length: frameCount }, (_, i) => ({ x: i * frameWidth, y, width: frameWidth, height })) },
      visual: { ...asset.visual, height: height * sy,
        anchor: part === 'head' ? 'center' : 'bottom-center',
        offsetX: part === 'head' ? (frameWidth / 2 - joint.pivotX) * sx : 0,
        offsetY: part === 'head' ? (joint.pivotY - height / 2) * sy : 0 },
    };
  }
}

export const DRAW = {
  backgroundFar: -6, backgroundMid: -4, backgroundNear: -2,
  level: 0, levelSurface: 1, decoration: 2, pickup: 2.5, entity: 3,
  levelBackDecor: -0.5, levelTiles: 1.2,
  projectile: 4, fxBehind: 2.8, fx: 5, foreground: 6, debug: 7,
  detail: 0.1, trim: 0.2, overlay: 0.3, collider: 0.4, topDetail: 0.5,
} as const;
export const GRAPHICS = { fxCapacity: 24, shootPoseTime: 0.16, pickupRotation: 0.08, pickupFrequency: 8 } as const;
