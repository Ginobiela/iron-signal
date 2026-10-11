import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';
import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';

export class Soldier extends Enemy {
  attackTimer: number;

  constructor(x: number, y: number, config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {
    super('soldier', x, y, config.get().enemies.soldier, config);
    this.attackTimer = config.get().enemies.soldier.firstAttackDelay;
  }

  protected updateBehavior(dt: number, context: EnemyContext): void {
    const distance = this.distanceToPlayer(context);
    this.aimAtPlayer(context);
    const speed = Math.abs(distance) > this.config.get().enemies.soldier.stopDistance
      ? this.direction * this.config.get().enemies.soldier.speed : 0;
    this.moveOnGround(dt, context, speed);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.attackTimer === 0 && this.fireAtPlayer(context, this.config.get().enemies.soldier.bulletSpeed)) {
      this.attackTimer = this.config.get().enemies.soldier.attackInterval;
    }
  }

  protected override resetBehavior(): void {
    this.attackTimer = this.config.get().enemies.soldier.firstAttackDelay;
  }
}
