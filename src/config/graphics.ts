import type { AnimationClip } from '../rendering/SpriteAnimator';
import { FEEDBACK } from './constants';

export type SpriteAnchor = 'bottom-center' | 'center';
export interface VisualConfig {
  width: number; height: number; offsetX: number; offsetY: number; anchor: SpriteAnchor;
}
export const PLAYER_VISUAL = {
  width: 12, height: 26, crouchHeight: 13, offsetX: 0, offsetY: 0, anchor: 'bottom-center',
} as const satisfies VisualConfig & { crouchHeight: number };
export const PICKUP_VISUAL = {
  width: 14, height: 14, offsetX: 0, offsetY: 0, anchor: 'bottom-center',
} as const satisfies VisualConfig;
export const ENEMY_VISUALS = {
  soldier: { width: 12, height: 24, offsetX: 0, offsetY: 0, anchor: 'bottom-center' },
  runner: { width: 14, height: 16, offsetX: 0, offsetY: 0, anchor: 'bottom-center' },
  turret: { width: 20, height: 20, offsetX: 0, offsetY: 0, anchor: 'bottom-center' },
  flying: { width: 20, height: 14, offsetX: 0, offsetY: 0, anchor: 'center' },
} as const satisfies Record<string, VisualConfig>;

export type PlayerAnimation = 'idle' | 'run' | 'jump' | 'fall' | 'crouch' | 'shoot'
  | 'runShoot' | 'jumpShoot' | 'crouchShoot';
export const PLAYER_ANIMATIONS = {
  idle: { frames: [1], frameTime: 1 }, run: { frames: [0, 1, 2, 1], frameTime: FEEDBACK.runFrameTime },
  jump: { frames: [3], frameTime: 1 }, fall: { frames: [4], frameTime: 1 },
  crouch: { frames: [1], frameTime: 1 }, shoot: { frames: [1], frameTime: 1 },
  runShoot: { frames: [0, 1, 2, 1], frameTime: FEEDBACK.runFrameTime }, jumpShoot: { frames: [3], frameTime: 1 },
  crouchShoot: { frames: [1], frameTime: 1 },
} as const satisfies Record<PlayerAnimation, AnimationClip>;
