import { ENEMIES } from '../../config/constants';
import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';

export class Runner extends Enemy {
  constructor(x: number, y: number) {
    super('runner', x, y, ENEMIES.runner);
  }

  protected updateBehavior(dt: number, context: EnemyContext): void {
    const distance = this.distanceToPlayer(context);
    if (distance !== 0) this.direction = distance > 0 ? 1 : -1;
    this.moveOnGround(dt, context, this.direction * ENEMIES.runner.speed);
    if (this.grounded && this.velocity.x === 0 && Math.abs(distance) > this.width) {
      this.velocity.y = ENEMIES.runner.jumpSpeed;
      this.grounded = false;
    }
  }
}
