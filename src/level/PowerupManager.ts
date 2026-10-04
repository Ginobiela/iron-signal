import { overlaps } from '../collision/CollisionSystem';
import type { AABB, CollisionSystem } from '../collision/CollisionSystem';
import { POWERUPS } from '../config/constants';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/enemies/Enemy';
import { WeaponPickup } from '../entities/WeaponPickup';
import { MachineGun } from '../weapons/MachineGun';
import { SpreadGun } from '../weapons/SpreadGun';
import { Laser } from '../weapons/Laser';

export type PowerupKind = 'M' | 'S' | 'L';

const weapons = { M: MachineGun, S: SpreadGun, L: Laser };

export class PowerupManager {
  readonly items: readonly WeaponPickup[];
  collectedCount = 0;
  spawnedCount = 0;
  private noticeTimer = 0;
  private noticeText = '';
  private dropped = new WeakSet<Enemy>();

  constructor(private readonly collision: CollisionSystem, capacity: number = POWERUPS.maxCount) {
    this.items = Array.from({ length: capacity }, () => new WeaponPickup());
  }

  get message(): string {
    return this.noticeTimer > 0 ? this.noticeText : '';
  }

  get activeCount(): number {
    let count = 0;
    for (const pickup of this.items) if (pickup.active) count++;
    return count;
  }

  dropFromEnemy(enemy: Enemy): WeaponPickup | null {
    if (enemy.alive || enemy.kind !== 'flying' || !enemy.weaponDrop || this.dropped.has(enemy)) return null;
    this.dropped.add(enemy);
    return this.spawn(enemy.weaponDrop, enemy.position.x, enemy.position.y);
  }

  spawn(kind: PowerupKind, x: number, y: number): WeaponPickup | null {
    for (const pickup of this.items) {
      if (pickup.active) continue;
      pickup.spawn(kind, x, y);
      this.spawnedCount++;
      return pickup;
    }
    return null;
  }

  update(dt: number, player: Player, solids: readonly AABB[], oneWays: readonly AABB[], worldWidth: number): void {
    if (dt <= 0) return;
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    for (const pickup of this.items) {
      if (!pickup.active) continue;
      pickup.update(dt, this.collision, solids, oneWays, worldWidth);
      if (!pickup.active || !player.alive || !overlaps(player.collisionBounds, pickup)) continue;
      pickup.active = false;
      player.weapon = new weapons[pickup.kind]();
      this.collectedCount++;
      this.noticeText = `${pickup.kind} · ${player.weapon.name}`;
      this.noticeTimer = POWERUPS.noticeTime;
    }
  }

  reset(): void {
    for (const pickup of this.items) pickup.active = false;
    this.dropped = new WeakSet<Enemy>();
    this.collectedCount = this.spawnedCount = 0;
    this.dismissNotice();
  }

  dismissNotice(): void {
    this.noticeTimer = 0;
    this.noticeText = '';
  }
}
