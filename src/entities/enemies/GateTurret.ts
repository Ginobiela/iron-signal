import { Turret } from './Turret';
import type { EnemyContext } from './Enemy';
import type { GameplayConfigSource } from '../../config/gameplay';
import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';

export class GateTurret extends Turret {
  get visualPrefix(): string { return 'bossGateTurret'; }
  get deathAnimation(): string { return 'destroy'; }
  get shootAnimation(): string { return 'fire'; }
  constructor(x: number, y: number, config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {
    super(x, y, 'aimed', config, 'gateTurret'); this.restore();
  }
  restore(): void { this.reset(); }
  protected override resetBehavior(): void { this.attackTimer = .8; }
  protected override updateBehavior(dt: number, context: EnemyContext): void {
    this.aimAtPlayer(context); this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.attackTimer === 0 && this.fireAtPlayer(context, this.config.get().gate.turretBulletSpeed))
      this.attackTimer = this.config.get().gate.turretFireCooldown;
  }
}
