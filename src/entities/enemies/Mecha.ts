import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';
import { BOSS } from '../../config/constants';
import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';
import { MechaLauncher } from '../../bosses/MechaLauncher';

/** A normal spawned enemy: no campaign completion, camera lock or pursuit barrier. */
export class Mecha extends Enemy {
  private readonly launcher = new MechaLauncher();
  private intro = 0;
  private firePose = 0;
  get visualPrefix(): string { return 'boss.mecha'; }
  get visualAnimation(): string {
    return this.hitFlashTimer > 0 ? 'damage' : this.firePose > 0 ? 'fire' : this.velocity.x !== 0 ? 'move' : 'idle';
  }
  constructor(x: number, y: number, config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {
    super('mecha', x, y, { width: BOSS.width, height: BOSS.height, health: config.get().mecha.health, color: 0x456260 }, config);
    this.resetBehavior();
  }
  protected updateBehavior(dt: number, context: EnemyContext): void {
    this.firePose = Math.max(0, this.firePose - dt);
    this.intro = Math.max(0, this.intro - dt);
    if (this.intro > 0) return;
    const distance = this.distanceToPlayer(context);
    if (distance !== 0) this.direction = distance > 0 ? 1 : -1;
    this.aimDirection.x = this.direction; this.aimDirection.y = 0;
    this.moveOnGround(dt, context, Math.abs(distance) > 80
      ? this.direction * Math.min(this.config.get().mecha.chaseSpeed, this.config.get().player.speed * .95) : 0);
    if (this.launcher.update(dt, this.position.x, this.position.y, this.direction, this.width, context, this.config)) {
      this.visualFireCount++; this.firePose = .2;
    }
  }
  protected resetBehavior(): void {
    this.intro = this.config.get().mecha.introTime; this.firePose = 0; this.launcher.reset(.6);
  }
}
