import { SPREAD_GUN } from '../config/constants';
import type { Vector2 } from '../entities/Entity';
import type { ProjectileOwner } from '../projectiles/Projectile';
import type { ProjectileManager } from '../projectiles/ProjectileManager';
import { Weapon } from './Weapon';

const rotations = SPREAD_GUN.angles.map((degrees) => {
  const radians = degrees * Math.PI / 180;
  return { cos: Math.cos(radians), sin: Math.sin(radians) };
});

export class SpreadGun extends Weapon {
  readonly name = 'SPREAD';
  readonly fireRate = SPREAD_GUN.fireRate;
  readonly projectileSpeed = SPREAD_GUN.projectileSpeed;
  readonly damage = SPREAD_GUN.damage;

  protected emit(projectiles: ProjectileManager, x: number, y: number, aim: Vector2,
    owner: ProjectileOwner, muzzleDistance: number): boolean {
    // Reserve the whole volley: saturation must not produce a partial spread.
    if (projectiles.availableCount < rotations.length) return false;
    for (const rotation of rotations) {
      const dx = aim.x * rotation.cos - aim.y * rotation.sin;
      const dy = aim.x * rotation.sin + aim.y * rotation.cos;
      projectiles.spawn(x, y, dx * this.projectileSpeed, dy * this.projectileSpeed,
        this.damage, owner, muzzleDistance);
    }
    return true;
  }
}
