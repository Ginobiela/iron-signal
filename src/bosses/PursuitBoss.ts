import { Boss } from './Boss';
import type { BossPlacement } from './Boss';
import type { EnemyContext } from '../entities/enemies/Enemy';
import { DEFAULT_CONFIG_SOURCE } from '../config/gameplay';
import type { GameplayConfigSource } from '../config/gameplay';
import { ENEMIES } from '../config/constants';
import { MechaLauncher } from './MechaLauncher';

/** Declarative encounter; uses the same damage, score, collision and projectile pool as arena bosses. */
export class PursuitBoss extends Boss {
  private readonly spawn: { x: number; y: number };
  private readonly launcher = new MechaLauncher();
  get name(): string { return 'CENTINELA DEL SUBSUELO'; }
  get visualPrefix(): string { return 'boss.mecha'; }
  get vulnerable(): boolean { return this.active && this.alive && this.state === 'CHASE'; }

  constructor(placement: BossPlacement, config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {
    super(placement, config);
    if (!placement.encounter) throw new Error('Pursuit boss requires encounter data.');
    this.spawn = { x: placement.x, y: placement.y };
    this.health = this.maxHealth = config.get().mecha.health;
  }

  prepareRespawn(): void {
    if (!this.active) return;
    this.position.x = this.spawn.x; this.position.y = this.spawn.y;
    this.health = this.maxHealth = this.config.get().mecha.health;
    this.state = 'INTRO'; this.attackTimer = this.config.get().mecha.introTime;
    this.launcher.reset(.6);
    this.hitFlashTimer = this.shieldFlashTimer = 0;
  }

  update(dt: number, context: EnemyContext): void {
    if (!this.active || !this.alive || !context.player.alive) return;
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    this.shieldFlashTimer = Math.max(0, this.shieldFlashTimer - dt);
    const tuning = this.config.get().mecha;
    const gap = this.position.x - context.player.position.x;
    const speed = Math.min(tuning.chaseSpeed + Math.max(0, gap - 140) * .1, this.config.get().player.speed * .95);
    this.position.x = Math.max(this.encounter!.retreatLeft + 100, this.position.x - speed * dt);
    this.aimDirection.x = -1; this.aimDirection.y = 0;
    if (this.state === 'INTRO') {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      if (this.attackTimer <= Number.EPSILON) this.state = 'CHASE';
      return;
    }
    if (this.launcher.update(dt, this.position.x, this.position.y, -1, this.width, context, this.config)) this.visualFireCount++;
  }

  takeDamage(damage: number): boolean {
    if (!this.vulnerable || damage <= 0) return false;
    this.health = Math.max(0, this.health - damage); this.hitFlashTimer = ENEMIES.hitFlashTime;
    if (!this.alive) this.die();
    return true;
  }

  reset(): void {
    super.reset();
    this.health = this.maxHealth = this.config.get().mecha.health;
    this.position.x = this.spawn.x; this.position.y = this.spawn.y;
    this.launcher.reset();
  }
}
