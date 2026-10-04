import type { AABB, CollisionSystem } from '../collision/CollisionSystem';
import type { CombatSystem } from '../collision/CombatSystem';
import { PROJECTILES, VIEW } from '../config/constants';
import { Projectile } from './Projectile';
import type { ProjectileOwner, ProjectileStyle } from './Projectile';

export class ProjectileManager {
  readonly items: readonly Projectile[];
  totalSpawned = 0;
  playerSpawned = 0;
  enemySpawned = 0;
  private count = 0;

  constructor(private readonly collision: CollisionSystem, capacity: number = PROJECTILES.maxCount) {
    this.items = Array.from({ length: capacity }, () => new Projectile());
  }

  get activeCount(): number {
    return this.count;
  }

  get availableCount(): number {
    return this.items.length - this.count;
  }

  spawn(x: number, y: number, vx: number, vy: number, damage: number,
    owner: ProjectileOwner, muzzleDistance = 0, style: ProjectileStyle = 'bullet'): boolean {
    for (const projectile of this.items) {
      if (projectile.active) continue;
      const speed = Math.hypot(vx, vy);
      const offset = speed > 0 ? muzzleDistance / speed : 0;
      projectile.position.x = x + vx * offset;
      projectile.position.y = y + vy * offset;
      // Include the barrel in the first sweep so it cannot fire through a thin wall.
      projectile.previousPosition.x = x;
      projectile.previousPosition.y = y;
      projectile.velocity.x = vx;
      projectile.velocity.y = vy;
      projectile.damage = damage;
      projectile.owner = owner;
      projectile.style = style;
      projectile.lifeRemaining = PROJECTILES.lifetime;
      projectile.active = true;
      projectile.fresh = true;
      this.count++;
      this.totalSpawned++;
      if (owner === 'player') this.playerSpawned++;
      else this.enemySpawned++;
      return true;
    }
    return false;
  }

  update(dt: number, solids: readonly AABB[], worldWidth: number, combat?: CombatSystem): void {
    const margin = PROJECTILES.boundsMargin;
    for (const projectile of this.items) {
      if (!projectile.active) continue;
      if (!projectile.fresh) {
        projectile.previousPosition.x = projectile.position.x;
        projectile.previousPosition.y = projectile.position.y;
      }
      projectile.fresh = false;
      const x = projectile.position.x + projectile.velocity.x * dt;
      const y = projectile.position.y + projectile.velocity.y * dt;
      projectile.lifeRemaining -= dt;
      if (projectile.lifeRemaining <= Number.EPSILON || x < -margin || x > worldWidth + margin
        || y < -margin || y > VIEW.height + margin
        || (combat ? combat.resolveProjectile(projectile, x, y, solids)
          : this.collision.hitsSolidSegment(projectile.previousPosition.x, projectile.previousPosition.y,
            x, y, PROJECTILES.size / 2, solids))) {
        this.deactivate(projectile);
        continue;
      }
      projectile.position.x = x;
      projectile.position.y = y;
    }
  }

  clear(resetCounters = true): void {
    for (const projectile of this.items) this.deactivate(projectile);
    if (resetCounters) {
      this.totalSpawned = 0;
      this.playerSpawned = this.enemySpawned = 0;
    }
  }

  deactivate(projectile: Projectile): void {
    if (!projectile.active) return;
    projectile.active = false;
    this.count--;
  }
}
