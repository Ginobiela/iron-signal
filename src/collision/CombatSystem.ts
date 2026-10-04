import { ENEMIES, PROJECTILES } from '../config/constants';
import type { Enemy } from '../entities/enemies/Enemy';
import type { Boss } from '../bosses/Boss';
import type { Player } from '../entities/Player';
import type { Projectile } from '../projectiles/Projectile';
import { overlaps, segmentAABBTime } from './CollisionSystem';
import type { AABB, CollisionSystem } from './CollisionSystem';

export class CombatSystem {
  kills = 0;
  playerHits = 0;
  private readonly playerBounds: AABB = { x: 0, y: 0, width: 0, height: 0 };
  private readonly targetBounds: AABB = { x: 0, y: 0, width: 0, height: 0 };

  constructor(private readonly collision: CollisionSystem, private readonly player: Player,
    private readonly enemies: readonly Enemy[], private readonly onEnemyKilled?: (enemy: Enemy | Boss) => void,
    private readonly boss?: Boss,
    private readonly onImpact?: (target: Enemy | Boss | Player | null, x: number, y: number, damaged: boolean) => void) {}

  resolveProjectile(projectile: Projectile, x: number, y: number, solids: readonly AABB[]): boolean {
    let nearest = this.collision.firstSolidHit(projectile.previousPosition.x, projectile.previousPosition.y,
      x, y, PROJECTILES.size / 2, solids);
    let target: Enemy | Boss | Player | null = null;
    if (projectile.owner === 'player') {
      for (const enemy of this.enemies) {
        if (!enemy.active || !enemy.alive) continue;
        const time = this.hitTime(projectile, x, y, enemy);
        if (time < nearest) {
          nearest = time;
          target = enemy;
        }
      }
      if (this.boss?.active && this.boss.alive) {
        const time = this.hitTime(projectile, x, y, this.boss);
        if (time < nearest) {
          nearest = time;
          target = this.boss;
        }
      }
    } else if (this.player.alive) {
      const time = this.hitTime(projectile, x, y, this.player);
      if (time < nearest) {
        nearest = time;
        target = this.player;
      }
    }
    const damaged = target?.takeDamage(projectile.damage) ?? false;
    if (target && damaged) {
      if (projectile.owner === 'enemy') this.playerHits++;
      else if (!target.alive && 'kind' in target) {
        this.kills++;
        this.onEnemyKilled?.(target);
      }
    }
    if (nearest !== Infinity) this.onImpact?.(target,
      projectile.previousPosition.x + (x - projectile.previousPosition.x) * nearest,
      projectile.previousPosition.y + (y - projectile.previousPosition.y) * nearest, damaged);
    return nearest !== Infinity;
  }

  updateContacts(): void {
    if (!this.player.alive) return;
    this.setBounds(this.playerBounds, this.player);
    for (const enemy of this.enemies) {
      if (!enemy.active || !enemy.alive) continue;
      this.setBounds(this.targetBounds, enemy);
      if (overlaps(this.playerBounds, this.targetBounds) && this.player.takeDamage(ENEMIES.contactDamage)) {
        this.playerHits++;
      }
    }
    if (this.boss?.active && this.boss.alive) {
      this.setBounds(this.targetBounds, this.boss);
      if (overlaps(this.playerBounds, this.targetBounds) && this.player.takeDamage(ENEMIES.contactDamage)) this.playerHits++;
    }
  }

  reset(): void {
    this.kills = this.playerHits = 0;
  }

  private hitTime(projectile: Projectile, x: number, y: number, target: Enemy | Boss | Player): number {
    this.setBounds(this.targetBounds, target);
    return segmentAABBTime(projectile.previousPosition.x, projectile.previousPosition.y,
      x, y, this.targetBounds, PROJECTILES.size / 2);
  }

  private setBounds(bounds: AABB, target: Enemy | Boss | Player): void {
    if (target === this.player) {
      const current = this.player.collisionBounds;
      bounds.x = current.x; bounds.y = current.y;
      bounds.width = current.width; bounds.height = current.height;
      return;
    }
    bounds.x = target.position.x;
    bounds.y = target.position.y;
    bounds.width = target.width;
    bounds.height = target.height;
  }
}
