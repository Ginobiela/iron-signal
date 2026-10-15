import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';
import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';

export class Turret extends Enemy {
  attackTimer: number;

  constructor(x: number, y: number, private readonly firingMode: 'aimed' | 'horizontal' = 'aimed', config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE,
    kind: 'turret' | 'gateTurret' = 'turret') {
    super(kind, x, y, config.get().enemies.turret, config);
    this.attackTimer = config.get().enemies.turret.firstAttackDelay;
  }

  override get warning(): boolean {
    return this.attackTimer <= this.config.get().enemies.turret.warningTime;
  }

  protected updateBehavior(dt: number, context: EnemyContext): void {
    if (this.firingMode === 'aimed') this.aimAtPlayer(context);
    else {
      this.direction = this.distanceToPlayer(context) < 0 ? -1 : 1;
      this.aimDirection.x = this.direction;
      this.aimDirection.y = 0;
    }
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.attackTimer === 0 && (this.firingMode === 'aimed'
      ? this.fireAtPlayer(context, this.config.get().enemies.turret.bulletSpeed)
      : context.projectiles.spawn(this.position.x + this.width / 2, this.position.y + this.gunPivotY,
        this.direction * this.config.get().enemies.turret.bulletSpeed, 0, this.config.get().enemies.bulletDamage, 'enemy', this.width / 2 + 4,
        'bullet', undefined, 0, `projectile.enemy.${this.visualPrefix}`))) {
      this.attackTimer = this.config.get().enemies.turret.attackInterval;
    }
  }

  protected override resetBehavior(): void {
    this.attackTimer = this.config.get().enemies.turret.firstAttackDelay;
  }
}
