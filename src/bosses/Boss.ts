import { BOSS, ENEMIES } from '../config/constants';
import type { EnemyContext } from '../entities/enemies/Enemy';

export interface BossPlacement { x: number; y: number; arenaLeft: number }
export type BossState = 'DORMANT' | 'INTRO' | 'TELEGRAPH' | 'ATTACK' | 'RECOVER' | 'DEAD';
export type BossPattern = 'HIGH' | 'LOW' | 'AIMED';

const aimedRotations = BOSS.aimedAngles.map((angle) => {
  const radians = angle * Math.PI / 180;
  return { cos: Math.cos(radians), sin: Math.sin(radians) };
});

export class Boss {
  readonly kind = 'boss';
  readonly position: { x: number; y: number };
  readonly width = BOSS.width;
  readonly height = BOSS.height;
  readonly maxHealth = BOSS.health;
  readonly arenaLeft: number;
  readonly aimDirection = { x: -1, y: 0 };
  health: number = BOSS.health;
  phase: 1 | 2 | 3 = 1;
  state: BossState = 'DORMANT';
  pattern: BossPattern = 'HIGH';
  attackTimer = 0;
  hitFlashTimer = 0;
  shieldFlashTimer = 0;
  active = false;
  private cycle = 0;
  private shotsFired = 0;
  private shotTimer = 0;

  constructor(placement: BossPlacement) {
    this.position = { x: placement.x, y: placement.y };
    this.arenaLeft = placement.arenaLeft;
  }

  get alive(): boolean { return this.health > 0; }
  get vulnerable(): boolean { return this.active && this.state === 'RECOVER'; }
  get firingHeight(): number {
    return this.pattern === 'HIGH' ? BOSS.highHeight : this.pattern === 'LOW' ? BOSS.lowHeight : BOSS.aimedHeight;
  }

  activate(playerX: number): boolean {
    if (this.state !== 'DORMANT' || playerX < this.arenaLeft) return false;
    this.active = true;
    this.prepareRespawn();
    return true;
  }

  prepareRespawn(): void {
    if (!this.active || !this.alive) return;
    this.state = 'INTRO';
    this.attackTimer = BOSS.introTime;
    this.shotsFired = 0;
    this.shotTimer = 0;
    this.hitFlashTimer = this.shieldFlashTimer = 0;
  }

  update(dt: number, context: EnemyContext): void {
    if (!this.active || !this.alive || !context.player.alive) return;
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    this.shieldFlashTimer = Math.max(0, this.shieldFlashTimer - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.state === 'ATTACK') {
      this.shotTimer -= dt;
      if (this.shotsFired < BOSS.burstCount && this.shotTimer <= Number.EPSILON) {
        this.fire(context);
        this.shotsFired++;
        this.shotTimer = BOSS.burstInterval;
      }
      if (this.attackTimer <= Number.EPSILON) {
        this.state = 'RECOVER';
        this.attackTimer = BOSS.recoveryTimes[this.phase - 1] ?? BOSS.recoveryTimes[0];
      }
      return;
    }
    if (this.attackTimer > Number.EPSILON) return;
    if (this.state === 'TELEGRAPH') {
      this.state = 'ATTACK';
      this.attackTimer = BOSS.attackTime;
      this.shotsFired = 0;
      this.shotTimer = 0;
    } else this.telegraph(context);
  }

  takeDamage(damage: number): boolean {
    if (!this.active || !this.alive || damage <= 0) return false;
    if (!this.vulnerable) {
      this.shieldFlashTimer = BOSS.shieldFlashTime;
      return false;
    }
    this.health = Math.max(0, this.health - damage);
    this.hitFlashTimer = ENEMIES.hitFlashTime;
    if (!this.alive) {
      this.die();
      return true;
    }
    const nextPhase = this.health < this.maxHealth * BOSS.phase3Threshold ? 3
      : this.health <= this.maxHealth * BOSS.phase2Threshold ? 2 : 1;
    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      this.cycle = 0;
      this.state = 'INTRO';
      this.attackTimer = BOSS.introTime;
    }
    return true;
  }

  die(): void {
    this.health = 0;
    this.active = false;
    this.state = 'DEAD';
    this.attackTimer = 0;
  }

  reset(): void {
    this.health = this.maxHealth;
    this.phase = 1;
    this.state = 'DORMANT';
    this.pattern = 'HIGH';
    this.active = false;
    this.attackTimer = this.cycle = this.shotsFired = this.shotTimer = 0;
    this.hitFlashTimer = this.shieldFlashTimer = 0;
    this.aimDirection.x = -1;
    this.aimDirection.y = 0;
  }

  private telegraph(context: EnemyContext): void {
    this.pattern = this.phase === 2 || (this.phase === 3 && this.cycle % 3 === 2)
      ? 'AIMED' : this.cycle % 2 === 0 ? 'HIGH' : 'LOW';
    this.cycle++;
    this.aimDirection.x = -1;
    this.aimDirection.y = 0;
    if (this.pattern === 'AIMED') {
      const dx = context.player.position.x + context.player.width / 2 - this.position.x + BOSS.muzzleOffset;
      const dy = context.player.position.y + context.player.height / 2 - this.position.y - this.firingHeight;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        this.aimDirection.x = dx / length;
        this.aimDirection.y = dy / length;
      }
    }
    this.state = 'TELEGRAPH';
    this.attackTimer = BOSS.telegraphTimes[this.phase - 1] ?? BOSS.telegraphTimes[0];
  }

  private fire(context: EnemyContext): void {
    const speed = BOSS.bulletSpeeds[this.phase - 1] ?? BOSS.bulletSpeeds[0];
    const x = this.position.x - BOSS.muzzleOffset;
    const y = this.position.y + this.firingHeight;
    if (this.pattern === 'AIMED') {
      for (const rotation of aimedRotations) {
        const dx = this.aimDirection.x * rotation.cos - this.aimDirection.y * rotation.sin;
        const dy = this.aimDirection.x * rotation.sin + this.aimDirection.y * rotation.cos;
        context.projectiles.spawn(x, y, dx * speed, dy * speed, ENEMIES.bulletDamage, 'enemy');
      }
    } else context.projectiles.spawn(x, y, -speed, 0, ENEMIES.bulletDamage, 'enemy');
  }
}
