import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';
import { advanceHatch } from '../../bosses/gateLayout';
import type { GateHatchState } from '../../bosses/gateLayout';
import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';

export class GateHatch extends Enemy {
  readonly hatch: GateHatchState;
  private readonly dogs: Enemy[] = [];
  get visualPrefix(): string { return 'bossGateHatch'; }
  get deathAnimation(): string { return 'close'; }
  get visualAnimation(): string { return this.hatch.state === 'OPENING' || this.hatch.state === 'OPEN' ? 'open' : 'close'; }
  constructor(x: number, y: number, private readonly spawnDog: (x: number, y: number, facing: -1 | 1) => Enemy,
    config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {
    super('gateHatch', x, y, { width: 32, height: 32, health: config.get().gate.turretHealth, color: 0x456260 }, config);
    this.hatch = { x, y, state: 'CLOSED', timer: 0 };
  }
  protected updateBehavior(dt: number, _context: EnemyContext): void {
    const cooldown = Math.max(this.config.get().enemies.robotDog.spawnCooldown, this.config.get().gate.hatchCooldown);
    if (!advanceHatch(this.hatch, dt, cooldown)) return;
    let count = 0;
    for (const dog of this.dogs) if (dog.spawnOwner === this && dog.active && dog.alive) count++;
    if (count >= this.config.get().gate.maxActiveDogs) return;
    const dog = this.spawnDog(this.position.x + (this.direction < 0 ? -18 : this.width), this.position.y, this.direction);
    dog.spawnOwner = this;
    if (!this.dogs.includes(dog)) this.dogs.push(dog);
  }
  protected resetBehavior(): void {
    this.hatch.state = 'CLOSED'; this.hatch.timer = 0;
    for (const dog of this.dogs) if (dog.spawnOwner === this) dog.die();
    this.dogs.length = 0;
  }
}
