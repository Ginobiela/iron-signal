import { PLAYER } from '../config/constants';
import type { Vector2 } from './Entity';
import type { PlayerControls } from './Player';

/** Down aims in air or while position is held; otherwise it preserves grounded crouch. */
export function resolvePlayerAim(out: Vector2, controls: PlayerControls, facing: -1 | 1, grounded: boolean): void {
  const axis = Number(controls.right) - Number(controls.left);
  const vertical = controls.down ? (grounded && !controls.aimLock ? 0 : -1) : controls.up ? 1 : 0;
  out.x = vertical ? axis * (axis ? Math.SQRT1_2 : 0) : facing;
  out.y = vertical * (axis ? Math.SQRT1_2 : 1);
}

export function playerAimPose(aim: Vector2): 'horizontal' | 'up' | 'diagonal' | 'down' | 'diagonalDown' {
  return aim.y < 0 ? (aim.x === 0 ? 'down' : 'diagonalDown')
    : aim.y > 0 ? (aim.x === 0 ? 'up' : 'diagonal') : 'horizontal';
}

// World units relative to the existing gun pivot. Lower origins clear the body,
// including the ±30° Spread cone. ProjectileManager still sweeps the barrel.
const defaultMuzzle = { offsetX: 0, distance: PLAYER.muzzleDistance } as const;
export const PLAYER_LOWER_MUZZLES = {
  down: { offsetX: 12, distance: 9 },
  diagonalDown: { offsetX: 4, distance: PLAYER.muzzleDistance },
} as const;
export function playerAimMuzzle(aim: Vector2) {
  const pose = playerAimPose(aim);
  return pose === 'down' || pose === 'diagonalDown' ? PLAYER_LOWER_MUZZLES[pose] : defaultMuzzle;
}

export function playerAimName(aim: Vector2): string {
  return aim.y === 0 ? (aim.x < 0 ? 'LEFT' : 'RIGHT')
    : aim.x === 0 ? (aim.y < 0 ? 'DOWN' : 'UP')
      : `${aim.x < 0 ? 'LEFT' : 'RIGHT'}_${aim.y < 0 ? 'DOWN' : 'UP'}`;
}
