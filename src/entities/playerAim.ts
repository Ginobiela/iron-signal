import { PLAYER } from '../config/constants';
import type { Vector2 } from './Entity';
import type { Player, PlayerControls } from './Player';
import { PLAYER_MUZZLES, PLAYER_LOWER_VISUAL_MUZZLES } from '../config/vfx';

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

/** Shared barrel tip; visual source density never changes these world offsets. */
export function playerMuzzleOffset(player: Player): { readonly x: number; readonly y: number } {
  const aim = playerAimPose(player.aimDirection);
  if (aim === 'down' || aim === 'diagonalDown') return PLAYER_LOWER_VISUAL_MUZZLES[aim];
  const pose = player.crouching ? 'crouching' : !player.grounded ? 'airborne'
    : player.velocity.x !== 0 ? 'running' : 'standing';
  return PLAYER_MUZZLES[pose][aim];
}

// Barrel sweep lengths in world units. Origins are derived backwards from the
// shared tip, so the first collision sweep still covers the barrel.
const defaultMuzzle = { distance: PLAYER.muzzleDistance } as const;
export const PLAYER_LOWER_MUZZLES = {
  down: { distance: 9 },
  diagonalDown: { distance: PLAYER.muzzleDistance },
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
