import type { EnemyContext } from '../entities/enemies/Enemy';
import type { GameplayConfigSource } from '../config/gameplay';

/** Shared missile cadence/origin for the campaign boss and placeable mechas. */
export class MechaLauncher {
  private timer = 0;
  reset(delay = 0): void { this.timer = delay; }
  update(dt: number, x: number, y: number, facing: -1 | 1, width: number,
    context: EnemyContext, config: GameplayConfigSource): boolean {
    this.timer -= dt;
    if (this.timer > 0) return false;
    const tuning = config.get().mecha;
    const fired = context.projectiles.spawnHoming(x + (facing < 0 ? -5 : width + 5), y + 34,
      facing * tuning.missileSpeed, 0, tuning.missileDamage, tuning.missileTurnRate, tuning.missileLifetime);
    this.timer = tuning.missileCooldown;
    return fired;
  }
}
