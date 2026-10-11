import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';
import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';
import type { PowerupKind } from '../../level/PowerupManager';

export class FlyingEnemy extends Enemy {
  private elapsed = 0;

  constructor(x: number, private readonly baseY: number, private readonly drop?: PowerupKind, config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {
    super('flying', x, baseY, config.get().enemies.flying, config);
  }

  override get weaponDrop(): PowerupKind | undefined { return this.drop; }

  protected updateBehavior(dt: number, context: EnemyContext): void {
    this.elapsed += dt;
    this.velocity.x = -this.config.get().enemies.flying.speed;
    this.velocity.y = this.config.get().enemies.flying.amplitude * this.config.get().enemies.flying.frequency
      * Math.cos(this.elapsed * this.config.get().enemies.flying.frequency);
    this.position.x += this.velocity.x * dt;
    this.position.y = this.baseY + Math.sin(this.elapsed * this.config.get().enemies.flying.frequency) * this.config.get().enemies.flying.amplitude;
    if (this.position.x + this.width < 0 || this.position.x > context.worldWidth) this.die();
  }

  protected override resetBehavior(): void {
    this.elapsed = 0;
  }
}
