import type { AssetManager } from '../core/AssetManager';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/enemies/Enemy';
import { PLAYER } from '../config/constants';
import { ENEMY_MUZZLES, PLAYER_MUZZLES } from '../config/vfx';

export interface MuzzlePoint { x: number; y: number; angle: number }
export function playerMuzzle(player: Player, assets: AssetManager, out: MuzzlePoint): void {
  const aim = player.aimDirection.y > 0 ? (player.aimDirection.x === 0 ? 'up' : 'diagonal') : 'horizontal';
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
