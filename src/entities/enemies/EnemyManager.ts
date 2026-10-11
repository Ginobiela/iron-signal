import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';
import { VIEW, WORLD } from '../../config/constants';
import type { Enemy, EnemyContext, EnemyKind } from './Enemy';
import { FlyingEnemy } from './FlyingEnemy';
import { Runner } from './Runner';
import { Soldier } from './Soldier';
import { Turret } from './Turret';
import type { PowerupKind } from '../../level/PowerupManager';

export type EnemyPlacement = { x: number; y: number; facing?: -1 | 1 } & (
  { kind: 'flying'; weaponDrop?: PowerupKind } |
  { kind: 'turret'; firingMode?: 'aimed' | 'horizontal' } |
  { kind: Exclude<EnemyKind, 'flying' | 'turret'> }
);

const constructors = { soldier: Soldier, runner: Runner, turret: Turret, flying: FlyingEnemy };

export class EnemyManager {
  readonly items: Enemy[] = [];

  constructor(private readonly config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {}

  spawn(placement: EnemyPlacement): Enemy {
    const enemy = placement.kind === 'flying' ? new FlyingEnemy(placement.x, placement.y, placement.weaponDrop, this.config)
      : placement.kind === 'turret' ? new Turret(placement.x, placement.y, placement.firingMode, this.config)
      : new constructors[placement.kind](placement.x, placement.y, this.config);
    enemy.active = true;
    if (placement.facing !== undefined) {
      enemy.direction = placement.facing;
      enemy.aimDirection.x = placement.facing;
    }
    this.items.push(enemy);
    return enemy;
  }

  get activeCount(): number {
    let count = 0;
    for (const enemy of this.items) if (enemy.active && enemy.alive) count++;
    return count;
  }

  get remainingCount(): number {
    let count = 0;
    for (const enemy of this.items) if (enemy.alive) count++;
    return count;
  }

  update(dt: number, context: EnemyContext, cameraX: number): void {
    for (const enemy of this.items) {
      if (!enemy.alive) continue;
      if (enemy.position.x + enemy.width < cameraX - WORLD.enemyRetireDistance) {
        enemy.die();
        continue;
      }
      if (enemy.position.x + enemy.width >= cameraX - this.config.get().enemies.activationMargin
        && enemy.position.x <= cameraX + VIEW.width + this.config.get().enemies.activationMargin) enemy.update(dt, context);
    }
  }

  clear(): void {
    this.items.length = 0;
  }
}
