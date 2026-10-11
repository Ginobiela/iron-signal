import { DEFAULT_CONFIG_SOURCE } from '../config/gameplay';
import type { GameplayConfigSource } from '../config/gameplay';
import { POWERUPS, WORLD } from '../config/constants';
import type { AABB, CollisionSystem } from '../collision/CollisionSystem';
import type { KinematicBody } from './Entity';
import type { PowerupKind } from '../level/PowerupManager';

export class WeaponPickup implements KinematicBody, AABB {
  readonly position = { x: 0, y: 0 };
  readonly velocity = { x: 0, y: 0 };
  readonly width = POWERUPS.size;
  readonly height = POWERUPS.size;
  get gravity(): number { return this.config.get().powerups.gravity; }
  get warningTime(): number { return this.config.get().powerups.warningTime; }
  constructor(private readonly config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {}
  kind: PowerupKind = 'M';
  grounded = false;
  active = false;
  lifeRemaining = 0;
  get x(): number { return this.position.x; }
  get y(): number { return this.position.y; }

  spawn(kind: PowerupKind, x: number, y: number): void {
    this.kind = kind;
    this.position.x = x; this.position.y = y;
    this.velocity.x = (Math.random() * 2 - 1) * POWERUPS.initialXSpeed;
    this.velocity.y = POWERUPS.initialYSpeed;
    this.grounded = false;
    this.lifeRemaining = this.config.get().powerups.lifetime;
    this.active = true;
  }

  update(dt: number, collision: CollisionSystem, solids: readonly AABB[],
    oneWays: readonly AABB[], worldWidth: number): void {
    if (!this.active || dt <= 0) return;
    this.lifeRemaining = Math.max(0, this.lifeRemaining - dt);
    if (this.lifeRemaining <= Number.EPSILON) { this.active = false; return; }
    this.velocity.y = Math.max(-POWERUPS.maxFallSpeed, this.velocity.y - this.gravity * dt);
    collision.move(this, dt, solids, worldWidth, oneWays);
    if (this.grounded) this.velocity.x = 0;
    if (this.position.y < WORLD.killY) this.active = false;
  }
}
