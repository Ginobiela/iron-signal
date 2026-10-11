import type { Vector2 } from '../entities/Entity';
import type { ProjectileOwner } from '../projectiles/Projectile';
import type { ProjectileManager } from '../projectiles/ProjectileManager';
import { Weapon } from './Weapon';

export class SpreadGun extends Weapon {
  override get projectileLifetime(): number { return this.config.get().weapons.spread.projectileLifetime; }
  readonly name = 'SPREAD';
  private angles: readonly number[] | undefined;
  private rotations: { cos: number; sin: number }[] = [];
  get fireRate(): number { return this.config.get().weapons.spread.fireRate; }
  get projectileSpeed(): number { return this.config.get().weapons.spread.projectileSpeed; }
  get damage(): number { return this.config.get().weapons.spread.damage; }

  protected emit(projectiles: ProjectileManager, x: number, y: number, aim: Vector2,
    owner: ProjectileOwner, muzzleDistance: number): boolean {
    const angles = this.config.get().weapons.spread.angles;
    if (angles !== this.angles) {
      this.angles = angles;
      this.rotations = angles.map(degrees => ({ cos: Math.cos(degrees * Math.PI / 180), sin: Math.sin(degrees * Math.PI / 180) }));
    }
    // Reserve the whole volley: saturation must not produce a partial spread.
    if (projectiles.availableCount < this.rotations.length) return false;
    for (const rotation of this.rotations) {
      const dx = aim.x * rotation.cos - aim.y * rotation.sin;
      const dy = aim.x * rotation.sin + aim.y * rotation.cos;
      projectiles.spawn(x, y, dx * this.projectileSpeed, dy * this.projectileSpeed,
        this.damage, owner, muzzleDistance, this.projectileStyle, this.projectileLifetime);
    }
    return true;
  }
}
