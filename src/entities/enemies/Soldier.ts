import { ENEMIES } from '../../config/constants';
import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';

export class Soldier extends Enemy {
  attackTimer: number = ENEMIES.soldier.firstAttackDelay;

  constructor(x: number, y: number) {
    super('soldier', x, y, ENEMIES.soldier);
  }

  protected updateBehavior(dt: number, context: EnemyContext): void {
    const distance = this.distanceToPlayer(context);
    this.aimAtPlayer(context);
    const speed = Math.abs(distance) > ENEMIES.soldier.stopDistance
      ? this.direction * ENEMIES.soldier.speed : 0;
    this.moveOnGround(dt, context, speed);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.attackTimer === 0 && this.fireAtPlayer(context, ENEMIES.soldier.bulletSpeed)) {
      this.attackTimer = ENEMIES.soldier.attackInterval;
    }
  }

  protected override resetBehavior(): void {
    this.attackTimer = ENEMIES.soldier.firstAttackDelay;
  }
}
