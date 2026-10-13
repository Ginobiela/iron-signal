import { describe, expect, it, vi } from 'vitest';
import { FortifiedGateBoss } from '../src/bosses/FortifiedGateBoss';
import type { BossPlacement } from '../src/bosses/Boss';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { Player } from '../src/entities/Player';
import type { EnemyContext } from '../src/entities/enemies/Enemy';
import { RobotDog } from '../src/entities/enemies/RobotDog';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';

const floor = { x: 0, y: 0, width: 1200, height: 44 };
const dt = 1 / 60;
const placement: BossPlacement = {
  kind: 'gate', x: 600, y: 44, arenaLeft: 400,
  arena: { x: 400, y: 44, width: 256, height: 240 },
  trigger: { x: 390, y: 44, width: 10, height: 100 },
};

function context(): EnemyContext {
  const collision = new CollisionSystem();
  const player = new Player(450, 44);
  return { player, collision, projectiles: new ProjectileManager(collision), solids: [floor], worldWidth: 1200 };
}

function activate(boss: FortifiedGateBoss): void {
  expect(boss.activate(placement.trigger!.x + 5, placement.trigger!.y + 10)).toBe(true);
}

function openHatch(boss: FortifiedGateBoss, ctx: EnemyContext, hatchIndex = 0): void {
  const hatch = boss.hatches[hatchIndex]!;
  for (let i = 0; i < 60 && hatch.state !== 'OPEN'; i++) boss.update(dt, ctx);
  expect(hatch.state).toBe('OPEN');
}

describe('level 3 fortified gate boss', () => {
  it('keeps the main gate shielded until both active turrets are destroyed', () => {
    const boss = new FortifiedGateBoss(placement);
    activate(boss);
    expect(boss.turrets).toHaveLength(2);
    expect(boss.turrets.every((turret) => turret.active)).toBe(true);
    expect(boss.vulnerable).toBe(false);
    expect(boss.takeDamage(10)).toBe(false);
    boss.turrets[0]!.takeDamage(boss.turrets[0]!.health);
    boss.update(dt, context());
    expect(boss.vulnerable).toBe(false);
    boss.turrets[1]!.takeDamage(boss.turrets[1]!.health);
    boss.update(dt, context());
    expect(boss.vulnerable).toBe(true);
    expect(boss.phase).toBe(2);
  });

  it('opens hatches and spawns a dog when the hatch reaches OPEN', () => {
    const spawnDog = vi.fn();
    const boss = new FortifiedGateBoss(placement, undefined, spawnDog);
    activate(boss);
    boss.turrets.forEach((turret) => turret.takeDamage(turret.health));
    openHatch(boss, context());
    expect(spawnDog).toHaveBeenCalledTimes(1);
    expect(spawnDog).toHaveBeenCalledWith(boss.hatches[0]!.x, boss.hatches[0]!.y);
  });

  it('respects the maximum active dog count when opening a hatch', () => {
    const spawnDog = vi.fn();
    const boss = new FortifiedGateBoss(placement, undefined, spawnDog, () => 99);
    activate(boss);
    boss.turrets.forEach((turret) => turret.takeDamage(turret.health));
    openHatch(boss, context());
    expect(spawnDog).not.toHaveBeenCalled();
    expect(boss.hatches[0]!.state).toBe('OPEN');
  });

  it('enters phase three at 35 percent health and continues accepting damage', () => {
    const boss = new FortifiedGateBoss(placement);
    activate(boss);
    boss.turrets.forEach((turret) => turret.takeDamage(turret.health));
    boss.update(dt, context());
    boss.takeDamage(boss.maxHealth - Math.floor(boss.maxHealth * 0.35));
    boss.update(dt, context());
    expect(boss.health / boss.maxHealth).toBeLessThanOrEqual(0.35);
    expect(boss.phase).toBe(3);
  });

  it('stops spawning and closes hatches when the main gate dies', () => {
    const spawnDog = vi.fn();
    const boss = new FortifiedGateBoss(placement, undefined, spawnDog);
    activate(boss);
    boss.turrets.forEach((turret) => turret.takeDamage(turret.health));
    const ctx = context();
    openHatch(boss, ctx);
    spawnDog.mockClear();
    boss.takeDamage(boss.health);
    expect(boss.alive).toBe(false);
    expect(boss.active).toBe(false);
    expect(boss.hatches.every((hatch) => hatch.state === 'CLOSED')).toBe(true);
    boss.update(10, ctx);
    expect(spawnDog).not.toHaveBeenCalled();
  });

  it('fully restores the gate and turrets when preparing to respawn', () => {
    const boss = new FortifiedGateBoss(placement);
    activate(boss);
    boss.turrets[0]!.takeDamage(1);
    boss.turrets[1]!.takeDamage(boss.turrets[1]!.health);
    boss.update(dt, context());
    boss.takeDamage(12);
    boss.hatches[0]!.state = 'OPEN';
    boss.prepareRespawn();
    expect(boss.health).toBe(boss.maxHealth);
    expect(boss.phase).toBe(1);
    expect(boss.state).toBe('ATTACK');
    expect(boss.turrets.every((turret) => turret.active && turret.health === turret.maxHealth)).toBe(true);
    expect(boss.hatches.every((hatch) => hatch.state === 'CLOSED')).toBe(true);
  });

  it('activates and moves toward the player while taking damage', () => {
    const dog = new RobotDog(100, 44);
    const ctx = context();
    ctx.player.position.x = 200;
    dog.active = true;
    dog.update(0.5, ctx);
    expect(dog.kind).toBe('robotDog');
    expect(dog.position.x).toBeGreaterThan(100);
    expect(dog.takeDamage(1)).toBe(true);
    expect(dog.health).toBe(dog.maxHealth - 1);
  });

  it('does not move or lose health before the robot dog is active', () => {
    const dog = new RobotDog(100, 44);
    const ctx = context();
    ctx.player.position.x = 300;
    dog.update(1, ctx);
    expect(dog.position.x).toBe(100);
    expect(dog.takeDamage(1)).toBe(false);
    expect(dog.health).toBe(dog.maxHealth);
  });
});
