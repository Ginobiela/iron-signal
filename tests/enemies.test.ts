import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatSystem } from '../src/collision/CombatSystem';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { ENEMIES, PLAYER, TIMING } from '../src/config/constants';
import { GameLoop } from '../src/core/GameLoop';
import type { Enemy, EnemyContext } from '../src/entities/enemies/Enemy';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { FlyingEnemy } from '../src/entities/enemies/FlyingEnemy';
import { Runner } from '../src/entities/enemies/Runner';
import { Soldier } from '../src/entities/enemies/Soldier';
import { Turret } from '../src/entities/enemies/Turret';
import { Player } from '../src/entities/Player';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';

const dt = TIMING.fixedStep;
const floor = { x: 0, y: 0, width: 1536, height: 44 };
const idle = { left: false, right: false, up: false, shoot: false, jumpPressed: false, down: false };

function setup(enemies: readonly Enemy[] = []) {
  const collision = new CollisionSystem();
  const player = new Player(62, 44);
  const pool = new ProjectileManager(collision);
  const context: EnemyContext = { player, projectiles: pool, collision, solids: [floor], worldWidth: 1536 };
  const combat = new CombatSystem(collision, player, enemies);
  for (const enemy of enemies) enemy.active = true;
  return { collision, player, pool, context, combat };
}

afterEach(() => vi.unstubAllGlobals());

describe('distinct enemy behavior', () => {
  it('Soldier walks toward the player, shoots occasionally, and stops nearby', () => {
    const soldier = new Soldier(300, 44);
    const { context, pool } = setup([soldier]);
    for (let i = 0; i < 60; i++) soldier.update(dt, context);
    expect(soldier.position.x).toBeCloseTo(300 - ENEMIES.soldier.speed);
    expect(pool.totalSpawned).toBe(1);
    const bullet = pool.items.find((item) => item.active);
    expect(bullet?.owner).toBe('enemy');
    expect(Math.hypot(bullet?.velocity.x ?? 0, bullet?.velocity.y ?? 0)).toBeCloseTo(ENEMIES.soldier.bulletSpeed);
    expect(bullet?.velocity.x).toBeLessThan(0);
    soldier.position.x = 90;
    soldier.update(dt, context);
    expect(soldier.velocity.x).toBe(0);
    context.player.position.x = 400;
    soldier.update(dt, context);
    expect(soldier.direction).toBe(1);
    expect(soldier.velocity.x).toBe(ENEMIES.soldier.speed);
  });

  it('Runner rushes faster than Soldier and does not shoot', () => {
    const runner = new Runner(300, 44);
    const { context, pool } = setup([runner]);
    for (let i = 0; i < 60; i++) runner.update(dt, context);
    expect(runner.position.x).toBeCloseTo(300 - ENEMIES.runner.speed);
    expect(Math.abs(runner.velocity.x)).toBeGreaterThan(ENEMIES.soldier.speed);
    expect(pool.totalSpawned).toBe(0);
  });

  it('Runner jumps when blocked by a low obstacle', () => {
    const runner = new Runner(240, 44);
    const { context } = setup([runner]);
    context.solids = [floor, { x: 200, y: 44, width: 30, height: 12 }];
    let sawJump = false;
    for (let i = 0; i < 90; i++) {
      runner.update(dt, context);
      sawJump ||= runner.velocity.y > 0;
    }
    expect(sawJump).toBe(true);
    expect(runner.position.x).toBeLessThan(200);
  });

  it('Turret remains stationary, tracks the player and telegraphs its shot', () => {
    const turret = new Turret(300, 44);
    const { context, pool } = setup([turret]);
    context.player.position.y = 120;
    let sawWarning = false;
    for (let i = 0; i < 180; i++) {
      turret.update(dt, context);
      sawWarning ||= turret.warning;
    }
    expect(turret.position).toEqual({ x: 300, y: 44 });
    expect(turret.velocity).toEqual({ x: 0, y: 0 });
    expect(turret.aimDirection.x).toBeLessThan(0);
    expect(turret.aimDirection.y).toBeGreaterThan(0);
    expect(sawWarning).toBe(true);
    expect(pool.totalSpawned).toBe(2);
  });

  it('FlyingEnemy crosses horizontally with a bounded sinusoidal trajectory', () => {
    const flying = new FlyingEnemy(300, 92);
    const { context, pool } = setup([flying]);
    for (let i = 0; i < 60; i++) {
      flying.update(dt, context);
      expect(Math.abs(flying.position.y - 92)).toBeLessThanOrEqual(ENEMIES.flying.amplitude);
    }
    expect(flying.position.x).toBeCloseTo(300 - ENEMIES.flying.speed);
    expect(flying.position.y).toBeCloseTo(92 + Math.sin(ENEMIES.flying.frequency) * ENEMIES.flying.amplitude);
    expect(pool.totalSpawned).toBe(0);
    flying.position.x = -flying.width;
    flying.update(dt, context);
    expect(flying.alive).toBe(false);
  });
});

describe('health and activation', () => {
  it.each([Soldier, Runner, Turret, FlyingEnemy])('%s takes damage, dies once, and resets', (Type) => {
    const enemy = new Type(140, 92);
    const { context } = setup([enemy]);
    expect(enemy.takeDamage(0)).toBe(false);
    expect(enemy.takeDamage(enemy.maxHealth)).toBe(true);
    expect(enemy.health).toBe(0);
    expect(enemy.active).toBe(false);
    expect(enemy.takeDamage(1)).toBe(false);
    const x = enemy.position.x;
    enemy.update(dt, context);
    expect(enemy.position.x).toBe(x);
    enemy.reset();
    expect(enemy.health).toBe(enemy.maxHealth);
    expect(enemy.active).toBe(false);
    expect(enemy.hitFlashTimer).toBe(0);
    expect(enemy.position).toEqual({ x: 140, y: 92 });
  });

  it('freezes offscreen AI and clears the same array used by combat', () => {
    const manager = new EnemyManager();
    manager.spawn({ kind: 'soldier', x: 140, y: 44 });
    manager.spawn({ kind: 'turret', x: 700, y: 44 });
    const { context, pool } = setup();
    const items = manager.items;
    for (let i = 0; i < 60; i++) manager.update(dt, context, 0);
    expect(manager.activeCount).toBe(2);
    const distant = manager.items[1];
    expect(distant?.position.x).toBe(700);
    expect(distant instanceof Turret && distant.attackTimer).toBe(ENEMIES.turret.firstAttackDelay);
    const shots = pool.totalSpawned;
    manager.update(dt, context, 600);
    expect(manager.activeCount).toBe(1);
    expect(manager.items[0]?.alive).toBe(false);
    expect(pool.totalSpawned).toBe(shots);
    manager.items[0]?.takeDamage(100);
    expect(manager.remainingCount).toBe(1);
    manager.clear();
    expect(manager.items).toBe(items);
    expect(manager.remainingCount).toBe(0);
    expect(manager.activeCount).toBe(0);
  });

  it('inactive enemies cannot receive damage or shoot', () => {
    const turret = new Turret(700, 44);
    const { context, pool } = setup();
    turret.update(10, context);
    expect(turret.takeDamage(1)).toBe(false);
    expect(turret.health).toBe(turret.maxHealth);
    expect(pool.totalSpawned).toBe(0);
  });
});

describe('combat ownership and closest impact', () => {
  it.each([Soldier, Runner, Turret, FlyingEnemy])('rifle projectiles can kill %s', (Type) => {
    const enemy = new Type(90, 44);
    const { pool, combat } = setup([enemy]);
    for (let i = 0; i < enemy.maxHealth; i++) {
      pool.spawn(20, 50, 6000, 0, 1, 'player');
      pool.update(dt, [floor], 1536, combat);
    }
    expect(enemy.alive).toBe(false);
    expect(combat.kills).toBe(1);
    expect(pool.activeCount).toBe(0);
  });

  it('hits the nearest enemy regardless of array order and never hits the shooter', () => {
    const far = new Soldier(100, 44);
    const near = new Soldier(85, 44);
    const { pool, player, combat } = setup([far, near]);
    pool.spawn(20, 60, 6000, 0, 1, 'player');
    pool.update(dt, [floor], 1536, combat);
    expect(near.health).toBe(near.maxHealth - 1);
    expect(far.health).toBe(far.maxHealth);
    expect(player.health).toBe(PLAYER.maxHealth);
    expect(pool.activeCount).toBe(0);
  });

  it('walls shield enemies behind them', () => {
    const soldier = new Soldier(90, 44);
    const { pool, combat } = setup([soldier]);
    pool.spawn(20, 60, 6000, 0, 1, 'player');
    pool.update(dt, [floor, { x: 50, y: 44, width: 3, height: 50 }], 1536, combat);
    expect(soldier.health).toBe(soldier.maxHealth);
    expect(pool.activeCount).toBe(0);
  });

  it('damages an enemy in front of a wall, even if a fast bullet crosses both', () => {
    const soldier = new Soldier(60, 44);
    const { pool, combat } = setup([soldier]);
    pool.spawn(20, 60, 6000, 0, 1, 'player');
    pool.update(dt, [floor, { x: 100, y: 44, width: 3, height: 50 }], 1536, combat);
    expect(soldier.health).toBe(soldier.maxHealth - 1);
    expect(pool.activeCount).toBe(0);
  });

  it('enemy bullets hit the player, not other enemies; invulnerability consumes repeated hits', () => {
    const soldier = new Soldier(40, 44);
    const { pool, player, combat } = setup([soldier]);
    pool.spawn(20, 60, 6000, 0, 1, 'enemy');
    pool.update(dt, [floor], 1536, combat);
    expect(player.alive).toBe(false);
    expect(combat.playerHits).toBe(1);
    player.respawn(62, 44);
    for (let i = 0; i < 2; i++) {
      pool.spawn(20, 60, 6000, 0, 1, 'enemy');
      pool.update(dt, [floor], 1536, combat);
    }
    expect(player.health).toBe(PLAYER.maxHealth);
    expect(player.invulnerabilityTimer).toBe(PLAYER.invulnerabilityTime);
    expect(soldier.health).toBe(soldier.maxHealth);
    expect(combat.playerHits).toBe(1);
    expect(pool.activeCount).toBe(0);
  });

  it('walls also shield the player from enemy bullets', () => {
    const { pool, player, combat } = setup();
    pool.spawn(20, 60, 6000, 0, 1, 'enemy');
    pool.update(dt, [floor, { x: 40, y: 44, width: 3, height: 50 }], 1536, combat);
    expect(player.health).toBe(PLAYER.maxHealth);
    expect(pool.activeCount).toBe(0);
  });

  it('counts a kill only once when two bullets hit during the same step', () => {
    const runner = new Runner(90, 44);
    const { pool, combat } = setup([runner]);
    pool.spawn(20, 50, 6000, 0, runner.maxHealth, 'player');
    pool.spawn(20, 50, 6000, 0, runner.maxHealth, 'player');
    pool.update(dt, [floor], 1536, combat);
    expect(combat.kills).toBe(1);
    expect(pool.activeCount).toBe(1);
  });

  it('keeps only the latest projectile sweep, including the muzzle only on its first step', () => {
    const { pool } = setup();
    pool.spawn(20, 60, 60, 0, 1, 'player', 15);
    const projectile = pool.items[0];
    pool.update(dt, [], 1536);
    expect(projectile?.previousPosition.x).toBe(20);
    expect(projectile?.position.x).toBe(36);
    pool.update(dt, [], 1536);
    expect(projectile?.previousPosition.x).toBe(36);
    expect(projectile?.position.x).toBe(37);
  });
});

describe('player damage and practice reset', () => {
  it('contact damage respects invulnerability, death blocks controls, and reset restores everything', () => {
    const first = new Soldier(62, 44);
    const second = new Runner(62, 44);
    const { player, pool, combat, context } = setup([first, second]);
    combat.updateContacts();
    expect(player.health).toBe(0);
    expect(combat.playerHits).toBe(1);
    combat.updateContacts();
    expect(combat.playerHits).toBe(1);
    player.respawn(62, 44);
    combat.updateContacts();
    expect(player.alive).toBe(true);
    expect(combat.playerHits).toBe(1);
    player.update(PLAYER.invulnerabilityTime + dt, idle, context.collision, context.solids, context.worldWidth);
    combat.updateContacts();
    expect(combat.playerHits).toBe(2);
    expect(player.alive).toBe(false);
    expect(player.state).toBe('DEAD');
    expect(player.health).toBe(0);
    const position = { ...player.position };
    player.update(dt, { ...idle, right: true, jumpPressed: true }, context.collision, context.solids, context.worldWidth);
    player.updateCombat(dt, { ...idle, shoot: true }, pool);
    expect(player.position).toEqual(position);
    expect(pool.totalSpawned).toBe(0);
    player.reset(62, 44);
    combat.reset();
    expect(player.health).toBe(PLAYER.maxHealth);
    expect(player.state).toBe('IDLE');
    expect(player.invulnerabilityTimer).toBe(0);
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    expect(combat.playerHits).toBe(0);
    player.updateCombat(dt, { ...idle, shoot: true }, pool);
    expect(pool.totalSpawned).toBe(1);
    pool.clear();
    expect(pool.activeCount).toBe(0);
    expect(pool.totalSpawned).toBe(0);
    expect(pool.playerSpawned).toBe(0);
    expect(pool.enemySpawned).toBe(0);
  });

  it('dead players do not receive more damage and enemies stop attacking them', () => {
    const turret = new Turret(300, 44);
    const { player, context, pool } = setup([turret]);
    expect(player.takeDamage(0)).toBe(false);
    player.takeDamage(PLAYER.maxHealth);
    expect(player.takeDamage(1)).toBe(false);
    turret.update(10, context);
    expect(pool.totalSpawned).toBe(0);
  });
});

function simulateCombat(hz: number) {
  let callback: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const enemies = [new Soldier(140, 44), new Turret(250, 44)];
  const { player, pool, context, combat } = setup(enemies);
  const loop = new GameLoop((delta) => {
    player.update(delta, idle, context.collision, context.solids, context.worldWidth);
    player.updateCombat(delta, { ...idle, shoot: true }, pool);
    for (const enemy of enemies) enemy.update(delta, context);
    pool.update(delta, context.solids, context.worldWidth, combat);
    combat.updateContacts();
  }, () => {});
  loop.start();
  for (let i = 0; i <= hz * 2; i++) callback(i * 1000 / hz);
  loop.stop();
  return { shots: pool.totalSpawned, kills: combat.kills, health: player.health,
    enemies: enemies.map((enemy) => enemy.health), bullets: pool.activeCount };
}

it('combat outcomes stay identical with 30, 60 and 144 Hz render', () => {
  const baseline = simulateCombat(60);
  expect(baseline.shots).toBe(13);
  expect(baseline.kills).toBe(1);
  expect(baseline.enemies[0]).toBe(0);
  expect(baseline.enemies[1]).toBeGreaterThan(0);
  expect(baseline.enemies[1]).toBeLessThan(ENEMIES.turret.health);
  expect(simulateCombat(30)).toEqual(baseline);
  expect(simulateCombat(144)).toEqual(baseline);
});
