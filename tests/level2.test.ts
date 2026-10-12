import { describe, expect, it } from 'vitest';
import { PursuitBoss } from '../src/bosses/PursuitBoss';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { GameplayConfigStore } from '../src/config/gameplay';
import { Player } from '../src/entities/Player';
import type { EnemyContext } from '../src/entities/enemies/Enemy';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { MECHA } from '../src/config/mecha';
import level2Json from '../public/levels/level-02.json';
import { parseLevel, validateLevel } from '../src/level/LevelDocument';

const placement = {
  x: 3900, y: 44, arenaLeft: 3680,
  encounter: { type: 'pursuit' as const, retreatLeft: 2560, barrierX: 3808, cameraAnchor: .2 },
};

function setup() {
  const config = new GameplayConfigStore();
  const collision = new CollisionSystem();
  const player = new Player(3800, 44, config);
  const projectiles = new ProjectileManager(collision);
  const context: EnemyContext = { player, projectiles, collision, solids: [], worldWidth: 4096 };
  const boss = new PursuitBoss(placement, config);
  return { config, collision, player, projectiles, context, boss };
}

describe('Level 2 pursuit boss', () => {
  it('parses the Level 2 route, checkpoints, underground skin, pickups, and pursuit placement', () => {
    const level = parseLevel(level2Json);
    expect(level.width).toBe(4096);
    expect(level.checkpoints.map(({ x }) => x)).toEqual([1536, 3616]);
    expect(level.environmentSkin).toBe('underground');
    expect(level.pickups?.map(({ kind }) => kind)).toEqual(['M', 'S']);
    expect(level.boss.encounter).toEqual({ type: 'pursuit', retreatLeft: 2560, barrierX: 3808, cameraAnchor: 0.2 });
  });

  it.each([
    (level: Record<string, any>) => { level.boss.encounter.type = 'arena'; },
    (level: Record<string, any>) => { level.boss.encounter.retreatLeft = level.boss.arenaLeft; },
    (level: Record<string, any>) => { level.boss.encounter.cameraAnchor = 0.9; },
  ])('rejects malformed pursuit encounter data', (mutate) => {
    const invalid: Record<string, any> = structuredClone(level2Json);
    mutate(invalid);
    expect(validateLevel(invalid).errors.join(' ')).toMatch(/pursuit encounter/i);
    expect(() => parseLevel(invalid)).toThrow();
  });

  it('keeps encounter optional for regular arena boss levels', () => {
    const regular: Record<string, any> = structuredClone(level2Json);
    delete regular.boss.encounter;
    expect(parseLevel(regular).boss.encounter).toBeUndefined();
  });

  it('activates at its trigger, stays shielded through intro, then chases below player speed', () => {
    const { config, boss, context, player } = setup();
    config.setOverride('player.speed', 50);
    config.setOverride('mecha.chaseSpeed', 94);
    expect(boss.activate(3679)).toBe(false);
    expect(boss.activate(3680)).toBe(true);
    expect(boss.state).toBe('INTRO');
    expect(boss.vulnerable).toBe(false);
    expect(boss.takeDamage(1)).toBe(false);

    boss.update(MECHA.introTime, context);
    expect(boss.state).toBe('CHASE');
    expect(boss.vulnerable).toBe(true);
    const startX = boss.position.x;
    boss.update(0.5, context);
    expect(boss.position.x).toBeLessThan(startX);
    expect(startX - boss.position.x).toBeLessThanOrEqual(50 * 0.95 * 0.5);
    expect(player.alive).toBe(true);
  });

  it('restores its spawn and full health for checkpoint respawn, while reset returns it dormant', () => {
    const { boss, context } = setup();
    boss.activate(placement.arenaLeft);
    boss.update(MECHA.introTime, context);
    expect(boss.takeDamage(7)).toBe(true);
    boss.position.x -= 200;
    boss.prepareRespawn();
    expect(boss.position).toEqual({ x: placement.x, y: placement.y });
    expect(boss.health).toBe(MECHA.health);
    expect(boss.state).toBe('INTRO');
    expect(boss.active).toBe(true);
    boss.reset();
    expect(boss.state).toBe('DORMANT');
    expect(boss.active).toBe(false);
    expect(boss.position).toEqual({ x: placement.x, y: placement.y });
    expect(boss.health).toBe(MECHA.health);
  });

  it('disables itself on death and stops updating', () => {
    const { boss, context, projectiles } = setup();
    boss.activate(placement.arenaLeft);
    boss.update(MECHA.introTime, context);
    expect(boss.takeDamage(MECHA.health)).toBe(true);
    expect(boss.state).toBe('DEAD');
    expect(boss.active).toBe(false);
    const deadX = boss.position.x;
    boss.update(10, context);
    expect(boss.position.x).toBe(deadX);
    expect(projectiles.activeCount).toBe(0);
  });
});

describe('homing missiles', () => {
  it('turns by at most turnRate × dt without changing speed, expires, and reuses its pool slot', () => {
    const manager = new ProjectileManager(new CollisionSystem(), 1);
    expect(manager.spawnHoming(100, 100, 100, 0, 2, 0.5, 0.2)).toBe(true);
    const missile = manager.items[0]!;
    expect(missile.style).toBe('missile');
    expect(missile.owner).toBe('enemy');
    manager.update(0.1, [], 2000, undefined, { x: 100, y: 1000 });
    expect(Math.atan2(missile.velocity.y, missile.velocity.x)).toBeCloseTo(0.05, 6);
    expect(Math.hypot(missile.velocity.x, missile.velocity.y)).toBeCloseTo(100, 8);
    manager.update(0.1, [], 2000, undefined, { x: 100, y: 1000 });
    expect(manager.activeCount).toBe(0);
    expect(manager.spawnHoming(0, 0, 80, 0, 1, 1, 1)).toBe(true);
    expect(manager.activeCount).toBe(1);
  });
});
