import type { AssetManager } from '../core/AssetManager';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/enemies/Enemy';
import { PLAYER } from '../config/constants';
import { ENEMY_MUZZLES, PLAYER_MUZZLES, PLAYER_LOWER_VISUAL_MUZZLES } from '../config/vfx';
import { playerAimPose } from '../entities/playerAim';

export interface MuzzlePoint { x: number; y: number; angle: number }
export function playerMuzzle(player: Player, assets: AssetManager, out: MuzzlePoint): void {
  const aim = playerAimPose(player.aimDirection);
  if (aim === 'down' || aim === 'diagonalDown') {
    const baked = assets.getTexture(`player.jumpShoot_${aim}`);
    const tip = PLAYER_LOWER_VISUAL_MUZZLES[aim];
    out.x = baked ? Math.round(player.position.x + player.width / 2) + tip.x * player.direction
      : player.projectileOriginX + player.aimDirection.x * player.muzzleDistance;
    out.y = baked ? Math.round(player.position.y) + tip.y
      : player.projectileOriginY + player.aimDirection.y * player.muzzleDistance;
    out.angle = Math.atan2(player.aimDirection.y, player.aimDirection.x);
    return;
  }
  const pose = player.crouching ? 'crouching' : !player.grounded ? 'airborne' : player.velocity.x !== 0 ? 'running' : 'standing';
  const animation = pose === 'crouching' ? 'crouchShoot' : pose === 'airborne' ? 'jumpShoot' : pose === 'running' ? 'runShoot' : 'shoot';
  const sprite = assets.getTexture(`player.${animation}_${aim}`);
  const tip = PLAYER_MUZZLES[pose][aim];
  out.x = Math.round(player.position.x + player.width / 2) + (sprite ? tip.x * player.direction : player.aimDirection.x * PLAYER.muzzleDistance);
  out.y = Math.round(player.position.y) + (sprite ? tip.y : player.gunPivotY + player.aimDirection.y * PLAYER.muzzleDistance);
  out.angle = Math.atan2(player.aimDirection.y, player.aimDirection.x);
}

export function enemyMuzzle(enemy: Enemy, assets: AssetManager, out: MuzzlePoint): void {
  const tip = enemy.kind === 'soldier' || enemy.kind === 'turret' ? ENEMY_MUZZLES[enemy.kind] : null;
  const baked = tip && (assets.getTexture(`${enemy.kind}.shoot`) || assets.getTexture(`${enemy.kind}.idle`));
  out.x = Math.round(enemy.position.x + enemy.width / 2) + (baked ? tip.x * enemy.direction : enemy.aimDirection.x * (enemy.width / 2 + 4));
  out.y = Math.round(enemy.position.y) + (baked ? tip.y : enemy.gunPivotY + enemy.aimDirection.y * (enemy.width / 2 + 4));
  out.angle = baked ? (enemy.direction < 0 ? Math.PI : 0) : Math.atan2(enemy.aimDirection.y, enemy.aimDirection.x);
}
