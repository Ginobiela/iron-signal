import type { AABB, CollisionSystem } from '../collision/CollisionSystem';
import type { CombatSystem } from '../collision/CombatSystem';
import { PROJECTILES, VIEW } from '../config/constants';
import { Projectile, steerHoming } from './Projectile';
import type { ProjectileOwner, ProjectileStyle } from './Projectile';

export class ProjectileManager {
  readonly items: readonly Projectile[];
  totalSpawned = 0;
  playerSpawned = 0;
  enemySpawned = 0;
  private count = 0;

  constructor(private readonly collision: CollisionSystem, capacity: number = PROJECTILES.maxCount,
    private readonly onMissileEnd?: (x: number, y: number) => void) {
    this.items = Array.from({ length: capacity }, () => new Projectile());
  }

  get activeCount(): number {
    return this.count;
  }

  get availableCount(): number {
    return this.items.length - this.count;
  }

  spawn(x: number, y: number, vx: number, vy: number, damage: number,
    owner: ProjectileOwner, muzzleDistance = 0, style: ProjectileStyle = 'bullet', lifetime: number = PROJECTILES.lifetime, turnRate = 0): boolean {
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
      projectile.turnRate = turnRate;
      projectile.lifeRemaining = lifetime;
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

  spawnHoming(x: number, y: number, vx: number, vy: number, damage: number, turnRate: number, lifetime: number): boolean {
    return this.spawn(x, y, vx, vy, damage, 'enemy', 0, 'missile', lifetime, turnRate);
  }

  update(dt: number, solids: readonly AABB[], worldWidth: number, combat?: CombatSystem, homingTarget?: { x: number; y: number },worldHeight:number=VIEW.height): void {
    const margin = PROJECTILES.boundsMargin;
    for (const projectile of this.items) {
      if (!projectile.active) continue;
      if (!projectile.fresh) {
        projectile.previousPosition.x = projectile.position.x;
        projectile.previousPosition.y = projectile.position.y;
      }
      projectile.fresh = false;
      if (projectile.style === 'missile' && homingTarget) steerHoming(projectile, homingTarget, dt);
      const x = projectile.position.x + projectile.velocity.x * dt;
      const y = projectile.position.y + projectile.velocity.y * dt;
      projectile.lifeRemaining -= dt;
      if (projectile.lifeRemaining <= Number.EPSILON || x < -margin || x > worldWidth + margin
        || y < -margin || y > worldHeight + margin
        || (combat ? combat.resolveProjectile(projectile, x, y, solids)
          : this.collision.hitsSolidSegment(projectile.previousPosition.x, projectile.previousPosition.y,
            x, y, PROJECTILES.size / 2, solids))) {
        this.deactivate(projectile);
        if (projectile.style === 'missile') this.onMissileEnd?.(x, y);
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
