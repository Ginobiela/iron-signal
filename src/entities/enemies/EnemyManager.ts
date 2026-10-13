import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';
import { VIEW, WORLD } from '../../config/constants';
import type { Enemy, EnemyContext, EnemyKind } from './Enemy';
import { FlyingEnemy } from './FlyingEnemy';
import { Runner } from './Runner';
import { Soldier } from './Soldier';
import { Turret } from './Turret';
import { RobotDog } from './RobotDog';
import type { PowerupKind } from '../../level/PowerupManager';

export type EnemyPlacement = { x: number; y: number; facing?: -1 | 1 } & (
  { kind: 'flying'; weaponDrop?: PowerupKind } |
  { kind: 'turret'; firingMode?: 'aimed' | 'horizontal' } |
  { kind: Exclude<EnemyKind, 'flying' | 'turret'> }
);

const constructors = { soldier: Soldier, runner: Runner, turret: Turret, flying: FlyingEnemy,robotDog:RobotDog };

export class EnemyManager {
  readonly items: Enemy[] = [];

  constructor(private readonly config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {}

  spawn(placement: EnemyPlacement): Enemy {
    // Hatch waves are unbounded in time; recycle dead dogs instead of accumulating visuals.
    const recycled=placement.kind==='robotDog'?this.items.find(enemy=>enemy.kind==='robotDog'&&!enemy.alive):undefined;
    if(recycled){
      recycled.reset();recycled.position.x=placement.x;recycled.position.y=placement.y;recycled.active=true;
      recycled.direction=placement.facing??-1;recycled.aimDirection.x=recycled.direction;return recycled;
    }
    const enemy = placement.kind === 'flying' ? new FlyingEnemy(placement.x, placement.y, placement.weaponDrop, this.config)
      : placement.kind === 'turret' ? new Turret(placement.x, placement.y, placement.firingMode, this.config)
      : new constructors[placement.kind](placement.x, placement.y, this.config);
    enemy.active = true;
    if (placement.facing !== undefined) {
      enemy.direction = placement.facing;
      enemy.aimDirection.x = placement.facing;
    }
    this.items.push(enemy);
    return enemy;
  }

  get activeCount(): number {
    let count = 0;
    for (const enemy of this.items) if (enemy.active && enemy.alive) count++;
    return count;
  }

  get remainingCount(): number {
    let count = 0;
    for (const enemy of this.items) if (enemy.alive) count++;
    return count;
  }

  update(dt: number, context: EnemyContext, cameraX: number,cameraY?:number): void {
    for (const enemy of this.items) {
      if (!enemy.alive) continue;
      if(cameraY!==undefined){
        const margin=this.config.get().enemies.activationMargin;
        if(enemy.position.x+enemy.width>=cameraX-margin&&enemy.position.x<=cameraX+VIEW.width+margin
          &&enemy.position.y+enemy.height>=cameraY-margin&&enemy.position.y<=cameraY+VIEW.height+margin)enemy.update(dt,context);
        continue;
      }
      if (enemy.position.x + enemy.width < cameraX - WORLD.enemyRetireDistance) {
        enemy.die();
        continue;
      }
      if (enemy.position.x + enemy.width >= cameraX - this.config.get().enemies.activationMargin
        && enemy.position.x <= cameraX + VIEW.width + this.config.get().enemies.activationMargin) enemy.update(dt, context);
    }
  }

  clear(): void {
    this.items.length = 0;
  }
}
