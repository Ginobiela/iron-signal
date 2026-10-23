import type { AssetManager } from '../core/AssetManager';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/enemies/Enemy';
import { ENEMY_MUZZLES } from '../config/vfx';
import { playerMuzzleOffset } from '../entities/playerAim';
import { TURRET_ART, turretAimAngle } from '../config/turretArt';

export interface MuzzlePoint { x: number; y: number; angle: number }
export function playerMuzzle(player: Player, out: MuzzlePoint): void {
  const tip = playerMuzzleOffset(player);
  out.x = Math.round(player.position.x + player.width / 2) + tip.x * player.direction;
  out.y = Math.round(player.position.y) + tip.y;
  out.angle = Math.atan2(player.aimDirection.y, player.aimDirection.x);
}

export function enemyMuzzle(enemy: Enemy, assets: AssetManager, out: MuzzlePoint): void {
  if (enemy.kind === 'mecha') {
    out.x = enemy.position.x + (enemy.direction < 0 ? -5 : enemy.width + 5);
    out.y = enemy.position.y + 34; out.angle = enemy.direction < 0 ? Math.PI : 0; return;
  }
  if (enemy.kind === 'turret' || enemy.kind === 'gateTurret') {
    const prefix = enemy.kind === 'turret' ? 'turret' : 'bossGateTurret';
    const asset = assets.getSpriteSheet(`${prefix}.idle`);
    if (asset && assets.getTexture(`${prefix}.idle`)) {
      const joint = TURRET_ART[prefix], sx = asset.visual.width / asset.sheet.frameWidth;
      const sy = asset.visual.height / asset.sheet.frameHeight, angle = turretAimAngle(enemy.aimDirection);
      out.x = Math.round(enemy.position.x + enemy.width / 2)
        + (joint.pivotX - asset.sheet.frameWidth / 2) * sx * enemy.direction + Math.cos(angle) * joint.muzzleLength * sx;
      out.y = Math.round(enemy.position.y) + (asset.sheet.frameHeight - joint.pivotY) * sy + Math.sin(angle) * joint.muzzleLength * sx;
      out.angle = angle; return;
    }
  }
  const tip = enemy.kind === 'soldier' ? ENEMY_MUZZLES.soldier
    : enemy.kind === 'turret' || enemy.kind === 'gateTurret' ? ENEMY_MUZZLES.turret : null;
  const baked = tip && (assets.getTexture(`${enemy.visualPrefix}.${enemy.shootAnimation}`) || assets.getTexture(`${enemy.visualPrefix}.idle`));
  out.x = Math.round(enemy.position.x + enemy.width / 2) + (baked ? tip.x * enemy.direction : enemy.aimDirection.x * (enemy.width / 2 + 4));
  out.y = Math.round(enemy.position.y) + (baked ? tip.y : enemy.gunPivotY + enemy.aimDirection.y * (enemy.width / 2 + 4));
  out.angle = baked ? (enemy.direction < 0 ? Math.PI : 0) : Math.atan2(enemy.aimDirection.y, enemy.aimDirection.x);
}
