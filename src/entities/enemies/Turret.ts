import { ENEMIES } from '../../config/constants';
import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';

export class Turret extends Enemy {
  attackTimer: number = ENEMIES.turret.firstAttackDelay;

  constructor(x: number, y: number, private readonly firingMode: 'aimed' | 'horizontal' = 'aimed') {
    super('turret', x, y, ENEMIES.turret);
  }

  override get warning(): boolean {
    return this.attackTimer <= ENEMIES.turret.warningTime;
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
      ? this.fireAtPlayer(context, ENEMIES.turret.bulletSpeed)
      : context.projectiles.spawn(this.position.x + this.width / 2, this.position.y + this.gunPivotY,
        this.direction * ENEMIES.turret.bulletSpeed, 0, ENEMIES.bulletDamage, 'enemy', this.width / 2 + 4))) {
      this.attackTimer = ENEMIES.turret.attackInterval;
    }
  }

  protected override resetBehavior(): void {
    this.attackTimer = ENEMIES.turret.firstAttackDelay;
  }
}
