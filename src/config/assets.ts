import type { AnimationClip } from '../rendering/SpriteAnimator';
import type { VisualConfig } from './graphics';

export interface AtlasFrame { x: number; y: number; width: number; height: number }
export interface SpriteSheet {
  frameWidth: number; frameHeight: number; frameCount: number;
  columns?: number; margin?: number; spacing?: number;
  atlas?: readonly AtlasFrame[];
}
export interface SpriteAsset {
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
const sprite = (path: string, width: number, height: number, count = 1, fps = 6,
  anchor: VisualConfig['anchor'] = 'bottom-center', loop = true): SpriteAsset => ({
  path: `assets/${path}.png`, sheet: { frameWidth: width, frameHeight: height, frameCount: count },
  visual: visual(width, height, anchor),
  clip: { frames: Array.from({ length: count }, (_, i) => i), frameRate: fps, loop },
});

// Each animation may point to its own strip, or share a sheet/atlas URL with different frame indices.
export const ASSETS: Record<string, SpriteAsset> = {
  'player.idle': { ...sprite('sprites/player/player_idle', 32, 32, 4, 6),
    url: 'assets/sprites/player/player_idle.png', includesWeapon: true },
  'player.idle_up': { ...sprite('sprites/player/player_aim_up', 32, 32, 1, 1),
    url: 'assets/sprites/player/player_aim_up.png', includesWeapon: true },
  'player.idle_diagonal': { ...sprite('sprites/player/player_aim_diagonalUp', 32, 32, 1, 1),
    url: 'assets/sprites/player/player_aim_diagonalUp.png', includesWeapon: true },
  'player.run': { ...sprite('sprites/player/player_run', 32, 32, 6, 11),
    url: 'assets/sprites/player/player_run.png', includesWeapon: true },
  'player.jump': { ...sprite('sprites/player/player_jump', 32, 32, 2, 6),
    url: 'assets/sprites/player/player_jump.png', includesWeapon: true },
  'player.fall': { ...sprite('sprites/player/player_fall', 32, 32, 2, 6),
    url: 'assets/sprites/player/player_fall.png', includesWeapon: true },
  'player.crouch': { ...sprite('sprites/player/player_crouch', 32, 32, 2, 7, 'bottom-center', false),
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
  'soldier.idle': sprite('sprites/enemies/soldier/idle', 32, 32),
  'soldier.run': sprite('sprites/enemies/soldier/run', 32, 32, 6, 10),
  'soldier.shoot': sprite('sprites/enemies/soldier/shoot', 32, 32, 2, 12),
  'soldier.death': sprite('sprites/enemies/soldier/death', 32, 32, 6, 10, 'bottom-center', false),
  'runner.run': sprite('sprites/enemies/runner/run', 24, 24, 6, 12),
  'runner.death': sprite('sprites/enemies/runner/death', 24, 24, 4, 10, 'bottom-center', false),
  'turret.idle': sprite('sprites/enemies/turret/idle', 24, 24),
  'turret.shoot': sprite('sprites/enemies/turret/shoot', 24, 24, 2, 10),
  'turret.death': sprite('sprites/enemies/turret/death', 24, 24, 4, 10, 'bottom-center', false),
  'flying.fly': sprite('sprites/enemies/flying/fly', 32, 24, 4, 10, 'center'),
  'flying.hit': sprite('sprites/enemies/flying/hit', 32, 24, 2, 12, 'center'),
  'flying.death': sprite('sprites/enemies/flying/death', 32, 24, 4, 12, 'center', false),
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
  'fx.muzzle': sprite('sprites/fx/muzzle_flash', 8, 8, 2, 30, 'center', false),
  'fx.hit': sprite('sprites/fx/hit', 8, 8, 3, 18, 'center', false),
  'fx.explosion': sprite('sprites/fx/explosion', 32, 32, 6, 12, 'center', false),
  'fx.pickup': sprite('sprites/fx/powerup_pickup', 24, 24, 4, 12, 'center', false),
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
for (const [id, asset] of Object.entries(ASSETS)) {
  if (id === 'player.run' || id.startsWith('player.runShoot_')) asset.clip.syncGroup = 'player.run';
  if (id.startsWith('background.') || id === 'environment.ground' || id === 'environment.platform') asset.tileable = true;
}

export const DRAW = {
  backgroundFar: -6, backgroundMid: -4, backgroundNear: -2,
  level: 0, levelSurface: 1, decoration: 2, pickup: 2.5, entity: 3,
  projectile: 4, fx: 5, foreground: 6, debug: 7,
  detail: 0.1, trim: 0.2, overlay: 0.3, collider: 0.4, topDetail: 0.5,
} as const;
export const GRAPHICS = { fxCapacity: 24, shootPoseTime: 0.16, pickupRotation: 0.08, pickupFrequency: 8 } as const;
