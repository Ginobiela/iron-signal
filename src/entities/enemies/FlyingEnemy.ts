import { ENEMIES } from '../../config/constants';
import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';
import type { PowerupKind } from '../../level/PowerupManager';

export class FlyingEnemy extends Enemy {
  private elapsed = 0;

  constructor(x: number, private readonly baseY: number, private readonly drop?: PowerupKind) {
    super('flying', x, baseY, ENEMIES.flying);
  }

  override get weaponDrop(): PowerupKind | undefined { return this.drop; }

  protected updateBehavior(dt: number, context: EnemyContext): void {
    this.elapsed += dt;
    this.velocity.x = -ENEMIES.flying.speed;
    this.velocity.y = ENEMIES.flying.amplitude * ENEMIES.flying.frequency
      * Math.cos(this.elapsed * ENEMIES.flying.frequency);
    this.position.x += this.velocity.x * dt;
    this.position.y = this.baseY + Math.sin(this.elapsed * ENEMIES.flying.frequency) * ENEMIES.flying.amplitude;
    if (this.position.x + this.width < 0 || this.position.x > context.worldWidth) this.die();
  }

  protected override resetBehavior(): void {
    this.elapsed = 0;
  }
}
