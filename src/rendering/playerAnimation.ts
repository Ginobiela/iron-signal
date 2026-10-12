import type { PlayerAnimation } from '../config/graphics';
import type { Vector2 } from '../entities/Entity';
import { playerAimPose } from '../entities/playerAim';

const groundedSprites: Partial<Record<PlayerAnimation, Record<'horizontal' | 'up' | 'diagonal', string>>> = {
  idle: { horizontal: 'player.idle', up: 'player.idle_up', diagonal: 'player.idle_diagonal' },
  run: { horizontal: 'player.run', up: 'player.runShoot_up', diagonal: 'player.runShoot_diagonal' },
  shoot: { horizontal: 'player.shoot_horizontal', up: 'player.shoot_up', diagonal: 'player.shoot_diagonal' },
  runShoot: { horizontal: 'player.runShoot_horizontal', up: 'player.runShoot_up', diagonal: 'player.runShoot_diagonal' },
};
export function resolvePlayerSprite(animation: PlayerAnimation, aim: Vector2): string {
  if (animation === 'death') return 'player.death';
  const pose = playerAimPose(aim);
  if (pose === 'down' || pose === 'diagonalDown') {
    return `player.${animation === 'jumpShoot' ? 'jumpShoot' : 'aim'}_${pose}`;
  }
  return groundedSprites[animation]?.[pose] ?? `player.${animation}_${pose}`;
}
