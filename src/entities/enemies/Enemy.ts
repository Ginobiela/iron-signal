import type { AABB, CollisionSystem } from '../../collision/CollisionSystem';
import { ENEMIES, PLAYER, WORLD } from '../../config/constants';
import type { ProjectileManager } from '../../projectiles/ProjectileManager';
import type { KinematicBody } from '../Entity';
import type { Player } from '../Player';
import type { PowerupKind } from '../../level/PowerupManager';

export type EnemyKind = 'soldier' | 'runner' | 'turret' | 'flying';

export interface EnemyContext {
  player: Player;
  projectiles: ProjectileManager;
  collision: CollisionSystem;
  solids: readonly AABB[];
  worldWidth: number;
  oneWays?: readonly AABB[];
}

interface EnemyStats {
  width: number;
  height: number;
  health: number;
  color: number;
}

export abstract class Enemy implements KinematicBody {
  readonly position: { x: number; y: number };
  readonly velocity = { x: 0, y: 0 };
  readonly aimDirection = { x: -1, y: 0 };
  readonly width: number;
  readonly height: number;
  readonly maxHealth: number;
  readonly color: number;
  health: number;
  grounded = false;
  active = false;
  direction: -1 | 1 = -1;
  hitFlashTimer = 0;

  constructor(readonly kind: EnemyKind, private readonly spawnX: number,
    private readonly spawnY: number, stats: EnemyStats) {
    this.position = { x: spawnX, y: spawnY };
    this.width = stats.width;
    this.height = stats.height;
    this.health = this.maxHealth = stats.health;
    this.color = stats.color;
  }

  get alive(): boolean {
    return this.health > 0;
  }

  get gunPivotY(): number {
    return this.height * 0.6;
  }

  get warning(): boolean {
    return false;
  }

  get weaponDrop(): PowerupKind | undefined { return undefined; }

  update(dt: number, context: EnemyContext): void {
    if (!this.active || !this.alive) return;
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    if (context.player.alive) this.updateBehavior(dt, context);
    if (this.position.y < WORLD.killY) this.die();
  }

  takeDamage(damage: number): boolean {
    if (!this.alive || !this.active || damage <= 0) return false;
    this.health = Math.max(0, this.health - damage);
    this.hitFlashTimer = ENEMIES.hitFlashTime;
    if (!this.alive) this.die();
    return true;
  }

  die(): void {
    this.health = 0;
    this.active = false;
    this.velocity.x = this.velocity.y = 0;
  }

  reset(): void {
    this.position.x = this.spawnX;
    this.position.y = this.spawnY;
    this.velocity.x = this.velocity.y = 0;
    this.health = this.maxHealth;
    this.active = false;
    this.grounded = false;
    this.direction = -1;
    this.aimDirection.x = -1;
    this.aimDirection.y = 0;
    this.hitFlashTimer = 0;
    this.resetBehavior();
  }

  protected moveOnGround(dt: number, context: EnemyContext, speed: number): void {
    this.velocity.x = speed;
    this.velocity.y = Math.max(-PLAYER.maxFallSpeed, this.velocity.y - PLAYER.gravity * dt);
    context.collision.move(this, dt, context.solids, context.worldWidth, context.oneWays);
  }

  protected distanceToPlayer(context: EnemyContext): number {
    return context.player.position.x + context.player.width / 2 - this.position.x - this.width / 2;
  }

  protected aimAtPlayer(context: EnemyContext): void {
    const dx = this.distanceToPlayer(context);
    const dy = context.player.position.y + context.player.height / 2 - this.position.y - this.gunPivotY;
    const length = Math.hypot(dx, dy);
    this.aimDirection.x = length > 0 ? dx / length : this.direction;
    this.aimDirection.y = length > 0 ? dy / length : 0;
    if (dx !== 0) this.direction = dx > 0 ? 1 : -1;
  }

  protected fireAtPlayer(context: EnemyContext, speed: number): boolean {
    this.aimAtPlayer(context);
    return context.projectiles.spawn(this.position.x + this.width / 2,
      this.position.y + this.gunPivotY, this.aimDirection.x * speed, this.aimDirection.y * speed,
      ENEMIES.bulletDamage, 'enemy', this.width / 2 + 4);
  }

  protected resetBehavior(): void {}
  protected abstract updateBehavior(dt: number, context: EnemyContext): void;
}
