import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';
import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';

export class Runner extends Enemy {
  constructor(x: number, y: number, config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {
    super('runner', x, y, config.get().enemies.runner, config);
  }

  protected updateBehavior(dt: number, context: EnemyContext): void {
    const distance = this.distanceToPlayer(context);
    if (distance !== 0) this.direction = distance > 0 ? 1 : -1;
    this.moveOnGround(dt, context, this.direction * this.config.get().enemies.runner.speed);
    if (this.grounded && this.velocity.x === 0 && Math.abs(distance) > this.width) {
      this.velocity.y = this.config.get().enemies.runner.jumpSpeed;
      this.grounded = false;
    }
  }
}
