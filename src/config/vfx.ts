export interface VfxConfig {
  /** width/height and muzzle offsets are world units; only source frames use artScale. */
  artScale?: 1 | 2;
  file: string; width: number; height: number; frames: number; fps: number;
  kind: 'muzzle' | 'spark' | 'burst'; color: number;
  fallbackWidth: number; fallbackHeight: number; particles: number;
  behind?: boolean; shake?: number;
  enabled?: boolean;
}

const muzzle = { width: 8, height: 8, frames: 2, fps: 30, kind: 'muzzle',
  color: 0xffe3a2, fallbackWidth: 4, fallbackHeight: 2, particles: 0, enabled: true } as const;
const spark = { width: 8, height: 8, frames: 3, fps: 30, kind: 'spark',
  color: 0xffe3a2, fallbackWidth: 4, fallbackHeight: 4, particles: 3, enabled: true } as const;
export const VFX_EFFECTS = {
  'fx.muzzle.rifle': { ...muzzle, file: 'muzzle_rifle' },
  'fx.muzzle.machineGun': { ...muzzle, file: 'muzzle_machinegun', fallbackWidth: 3 },
  'fx.muzzle.spread': { ...muzzle, file: 'muzzle_spread', fallbackWidth: 5, fallbackHeight: 3 },
  'fx.muzzle.laser': { ...muzzle, file: 'muzzle_laser', width: 12, color: 0x99edff, fallbackWidth: 6 },
  'fx.hit.enemy': { ...spark, file: 'hit_enemy' },
  'fx.hit.player': { ...spark, file: 'hit_player', color: 0xff997f },
  'fx.impact.default': { ...spark, file: 'impact_default', frames: 2, fps: 24, particles: 2, color: 0x99edff },
  'fx.explosion.small': { ...spark, file: 'explosion_small', kind: 'burst', width: 16, height: 16,
    frames: 4, fps: 20, fallbackWidth: 6, fallbackHeight: 6, particles: 5, behind: true },
  'fx.explosion.medium': { ...spark, file: 'explosion_medium', kind: 'burst', width: 24, height: 24,
    frames: 6, fps: 20, fallbackWidth: 9, fallbackHeight: 9, particles: 8, behind: true, shake: 1 },
  'fx.pickup.drop': { ...spark, file: 'pickup_drop', width: 12, height: 12, frames: 3, fps: 20,
    fallbackWidth: 4, fallbackHeight: 4, particles: 3, color: 0x99edff },
  'fx.pickup.collect': { ...spark, file: 'pickup_collect', width: 16, height: 16, frames: 4, fps: 16,
    fallbackWidth: 6, fallbackHeight: 6, particles: 5, color: 0x99edff },
} as const satisfies Record<string, VfxConfig>;
export type VfxId = keyof typeof VFX_EFFECTS;
export const WEAPON_VFX: Readonly<Record<string, VfxId>> = {
  RIFLE: 'fx.muzzle.rifle', 'MACHINE GUN': 'fx.muzzle.machineGun', SPREAD: 'fx.muzzle.spread', LASER: 'fx.muzzle.laser',
};
export const VFX_SHAKE = { flyingTime: 0.1, playerDeath: 1.5, playerDeathTime: 0.16, boss: 2, bossTime: 0.3 } as const;
export const PLAYER_MUZZLES = {
  standing: { horizontal: { x: 9, y: 13 }, up: { x: 4, y: 21 }, diagonal: { x: 8, y: 17 } },
  running: { horizontal: { x: 11, y: 13 }, up: { x: 6, y: 21 }, diagonal: { x: 10, y: 17 } },
  airborne: { horizontal: { x: 11, y: 9 }, up: { x: 6, y: 20 }, diagonal: { x: 10, y: 16 } },
  crouching: { horizontal: { x: 11, y: 7 }, up: { x: 4, y: 12 }, diagonal: { x: 8, y: 10 } },
} as const;
export const ENEMY_MUZZLES = { soldier: { x: 12, y: 13 }, turret: { x: 11, y: 12 } } as const;
