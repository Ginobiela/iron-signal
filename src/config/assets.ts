import type { AnimationClip } from '../rendering/SpriteAnimator';
import type { VisualConfig } from './graphics';
import { VFX_EFFECTS } from './vfx';
import type { VfxConfig } from './vfx';
import { ENVIRONMENT_ASSETS } from './environment';
import type { EnvironmentAsset } from './environment';
import { withArtScale } from '../rendering/artDimensions';

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

// Each animation may point to its own strip, or share a sheet/atlas URL with different frame indices.
export const ASSETS: Record<string, SpriteAsset> = {
  'player.idle': {
  ...withArtScale(
    sprite('sprites/player/player_idle_2x', 32, 32, 4, 6),
    2,
  ),
  url: 'assets/sprites/player/player_idle_2x.png',
  includesWeapon: true,
},
  'player.idle_up': { ...sprite('sprites/player/player_aim_up', 32, 32, 1, 1),
    url: 'assets/sprites/player/player_aim_up.png', includesWeapon: true },
  'player.idle_diagonal': { ...sprite('sprites/player/player_aim_diagonalUp', 32, 32, 1, 1),
    url: 'assets/sprites/player/player_aim_diagonalUp.png', includesWeapon: true },
  'player.run': { ...withArtScale(sprite('sprites/player/player_run_2x', 32, 32, 6, 11), 2),
    url: 'assets/sprites/player/player_run_2x.png', includesWeapon: true },
  'player.jump': { ...sprite('sprites/player/player_jump', 32, 32, 2, 6),
    url: 'assets/sprites/player/player_jump.png', includesWeapon: true },
  'player.fall': { ...sprite('sprites/player/player_fall', 32, 32, 2, 6),
    url: 'assets/sprites/player/player_fall.png', includesWeapon: true },
  'player.crouch': { ...withArtScale(sprite('sprites/player/player_crouch', 32, 32, 2, 7, 'bottom-center', false), 2),
    url: 'assets/sprites/player/player_crouch.png', includesWeapon: true },
  'player.shoot': sprite('sprites/player/player_shoot', 32, 32, 2, 12),
  'player.shoot_horizontal': { ...sprite('sprites/player/player_shoot_horizontal', 32, 32, 2, 12),
    url: 'assets/sprites/player/player_shoot_horizontal.png', includesWeapon: true },
  'player.shoot_up': { ...sprite('sprites/player/player_shoot_up', 32, 32, 2, 12),
    url: 'assets/sprites/player/player_shoot_up.png', includesWeapon: true },
  'player.shoot_diagonal': { ...sprite('sprites/player/player_shoot_diagonalUp', 32, 32, 2, 12),
    url: 'assets/sprites/player/player_shoot_diagonalUp.png', includesWeapon: true },
  'player.runShoot': sprite('sprites/player/player_run_shoot', 32, 32, 6, 10),
  'player.runShoot_horizontal': { ...sprite('sprites/player/player_runShoot_horizontal', 32, 32, 6, 11),
    url: 'assets/sprites/player/player_runShoot_horizontal.png', includesWeapon: true },
  'player.runShoot_up': { ...sprite('sprites/player/player_runShoot_up', 32, 32, 6, 11),
    url: 'assets/sprites/player/player_runShoot_up.png', includesWeapon: true },
  'player.runShoot_diagonal': { ...sprite('sprites/player/player_runShoot_diagonalUp', 32, 32, 6, 11),
    url: 'assets/sprites/player/player_runShoot_diagonalUp.png', includesWeapon: true },
  'player.jumpShoot': sprite('sprites/player/player_jump_shoot', 32, 32, 2, 12),
  'player.jumpShoot_horizontal': { ...sprite('sprites/player/player_jumpShoot_horizontal', 32, 32, 2, 12),
    url: 'assets/sprites/player/player_jumpShoot_horizontal.png', includesWeapon: true },
  'player.jumpShoot_up': { ...sprite('sprites/player/player_jumpShoot_up', 32, 32, 2, 12),
    url: 'assets/sprites/player/player_jumpShoot_up.png', includesWeapon: true },
  'player.jumpShoot_diagonal': { ...sprite('sprites/player/player_jumpShoot_diagonalUp', 32, 32, 2, 12),
    url: 'assets/sprites/player/player_jumpShoot_diagonalUp.png', includesWeapon: true },
  'player.crouchShoot': sprite('sprites/player/player_crouch_shoot', 32, 32, 2, 12),
  'player.crouchShoot_horizontal': { ...sprite('sprites/player/player_crouchShoot_horizontal', 32, 32, 2, 12),
    url: 'assets/sprites/player/player_crouchShoot_horizontal.png', includesWeapon: true },
  'player.death': { ...sprite('sprites/player/player_death', 32, 32, 6, 10, 'bottom-center', false),
    url: 'assets/sprites/player/player_death.png', includesWeapon: true },
  'soldier.idle': { ...sprite('sprites/enemies/soldier/soldier_idle', 32, 32, 4, 6),
    url: 'assets/sprites/enemies/soldier/soldier_idle.png', includesWeapon: true },
  'soldier.run': { ...sprite('sprites/enemies/soldier/soldier_run', 32, 32, 6, 10),
    url: 'assets/sprites/enemies/soldier/soldier_run.png', includesWeapon: true },
  'soldier.shoot': { ...sprite('sprites/enemies/soldier/soldier_shoot', 32, 32, 2, 12),
    url: 'assets/sprites/enemies/soldier/soldier_shoot.png', includesWeapon: true },

  'soldier.death': { ...withArtScale(sprite('sprites/enemies/soldier/soldier_death_x2', 32, 32, 6, 10, 'bottom-center', false), 2),
    url: 'assets/sprites/enemies/soldier/soldier_death_x2.png', includesWeapon: true },

  'runner.run': { ...sprite('sprites/enemies/runner/runner_run', 24, 24, 6, 12),
    url: 'assets/sprites/enemies/runner/runner_run.png' },
  'runner.death': { ...sprite('sprites/enemies/runner/runner_death', 24, 24, 6, 10, 'bottom-center', false),
    url: 'assets/sprites/enemies/runner/runner_death.png' },
  'turret.idle': { ...sprite('sprites/enemies/turret/turret_idle', 24, 24, 2, 6),
    url: 'assets/sprites/enemies/turret/turret_idle.png', includesWeapon: true },
  'turret.shoot': { ...sprite('sprites/enemies/turret/turret_shoot', 24, 24, 3, 10),
    url: 'assets/sprites/enemies/turret/turret_shoot.png', includesWeapon: true },
  'turret.death': { ...sprite('sprites/enemies/turret/turret_death', 24, 24, 6, 10, 'bottom-center', false),
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
for (const [frame, kind] of ['M', 'S', 'L'].entries()) {
  ASSETS[`flying.carrier.${kind}`] = {
    ...sprite('sprites/enemies/flying/flying_carrier_labels', 3, 5, 3, 1),
    url: 'assets/sprites/enemies/flying/flying_carrier_labels.png',
    visual: { ...visual(3, 5), offsetX: 0.5, offsetY: 3 }, clip: { frames: [frame], frameRate: 1, loop: true },
  };
}

export const DRAW = {
  backgroundFar: -6, backgroundMid: -4, backgroundNear: -2,
  level: 0, levelSurface: 1, decoration: 2, pickup: 2.5, entity: 3,
  levelBackDecor: -0.5, levelTiles: 1.2,
  projectile: 4, fxBehind: 2.8, fx: 5, foreground: 6, debug: 7,
  detail: 0.1, trim: 0.2, overlay: 0.3, collider: 0.4, topDetail: 0.5,
} as const;
export const GRAPHICS = { fxCapacity: 24, shootPoseTime: 0.16, pickupRotation: 0.08, pickupFrequency: 8 } as const;
