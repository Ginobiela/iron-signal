import { afterEach, describe, expect, it, vi } from 'vitest';
import { Boss } from '../src/bosses/Boss';
import type { BossState } from '../src/bosses/Boss';
import { CombatSystem } from '../src/collision/CombatSystem';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { BOSS, PLAYER, SCORE, TIMING } from '../src/config/constants';
import { GameLoop } from '../src/core/GameLoop';
import { GameStateManager } from '../src/core/GameStateManager';
import { ScoreManager } from '../src/core/ScoreManager';
import { Player } from '../src/entities/Player';
import type { EnemyContext } from '../src/entities/enemies/Enemy';
import { Soldier } from '../src/entities/enemies/Soldier';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { Laser } from '../src/weapons/Laser';
import { SIGNAL_WORKS } from '../src/level/signalWorks';
import { Level } from '../src/level/Level';

const dt = TIMING.fixedStep;
const phaseTwoHealth = Math.floor(BOSS.health * BOSS.phase2Threshold);
const phaseThreeBoundary = Math.ceil(BOSS.health * BOSS.phase3Threshold);
const floor = { x: 0, y: 0, width: 1536, height: 44 };
const shoot = { left: false, right: false, up: false, down: false, shoot: true, jumpPressed: false };

function setup() {
  const collision = new CollisionSystem();
  const player = new Player(62, 44);
  const pool = new ProjectileManager(collision);
  const boss = new Boss({ x: 200, y: 44, arenaLeft: 0 });
  const context: EnemyContext = { player, collision, projectiles: pool, solids: [floor], worldWidth: 1536 };
  const score = new ScoreManager(null);
  const combat = new CombatSystem(collision, player, [], (target) => score.add(SCORE[target.kind]), boss);
  return { boss, pool, context, combat, score, player, collision };
}

function waitState(boss: Boss, context: EnemyContext, state: BossState): void {
  for (let i = 0; i < 300 && boss.state !== state; i++) boss.update(dt, context);
  expect(boss.state).toBe(state);
}

function phaseTwo(boss: Boss, context: EnemyContext): void {
  boss.activate(0);
  waitState(boss, context, 'RECOVER');
  boss.takeDamage(BOSS.health - phaseTwoHealth);
  expect(boss.phase).toBe(2);
}

afterEach(() => vi.unstubAllGlobals());

describe('boss lifecycle and phases', () => {
  it('remains dormant and immune before the trigger and begins with a safe intro', () => {
    const { boss, context, pool } = setup();
    expect(boss.activate(-1)).toBe(false);
    boss.update(10, context);
    expect(pool.activeCount).toBe(0);
    expect(boss.takeDamage(50)).toBe(false);
    expect(boss.health).toBe(BOSS.health);
    expect(boss.activate(0)).toBe(true);
    expect(boss.state).toBe('INTRO');
    expect(boss.activate(0)).toBe(false);
    boss.update(BOSS.introTime - dt, context);
    expect(boss.state).toBe('INTRO');
    expect(pool.activeCount).toBe(0);
    boss.update(dt, context);
    expect(boss.state).toBe('TELEGRAPH');
  });

  it('absorbs bullets while shielded and only loses health during recovery', () => {
    const { boss, context, pool, combat } = setup();
    boss.activate(0);
    pool.spawn(50, 60, 12000, 0, 3, 'player');
    pool.update(dt, [floor], 1536, combat);
    expect(pool.activeCount).toBe(0);
    expect(boss.health).toBe(BOSS.health);
    expect(boss.shieldFlashTimer).toBeGreaterThan(0);
    waitState(boss, context, 'RECOVER');
    pool.clear();
    pool.spawn(50, 60, 12000, 0, 3, 'player');
    pool.update(dt, [floor], 1536, combat);
    expect(boss.health).toBe(BOSS.health - 3);
    expect(boss.hitFlashTimer).toBeGreaterThan(0);
  });

  it('changes at 66% and below 30%, preserving health and giving an intro at each transition', () => {
    const { boss, context } = setup();
    phaseTwo(boss, context);
    expect(boss.health).toBe(phaseTwoHealth);
    expect(boss.state).toBe('INTRO');
    waitState(boss, context, 'RECOVER');
    boss.takeDamage(phaseTwoHealth - phaseThreeBoundary);
    expect(boss.health).toBe(phaseThreeBoundary);
    expect(boss.phase).toBe(2);
    boss.takeDamage(1);
    expect(boss.health).toBe(phaseThreeBoundary - 1);
    expect(boss.phase).toBe(3);
    expect(boss.state).toBe('INTRO');
    expect(boss.vulnerable).toBe(false);
  });

  it('respawn preserves progress and restarts warning; a new run fully resets the boss', () => {
    const { boss, context } = setup();
    phaseTwo(boss, context);
    waitState(boss, context, 'ATTACK');
    boss.prepareRespawn();
    expect(boss.health).toBe(phaseTwoHealth);
    expect(boss.phase).toBe(2);
    expect(boss.state).toBe('INTRO');
    expect(boss.attackTimer).toBe(BOSS.introTime);
    boss.reset();
    expect(boss.active).toBe(false);
    expect(boss.health).toBe(BOSS.health);
    expect(boss.phase).toBe(1);
    expect(boss.state).toBe('DORMANT');
    expect(boss.aimDirection).toEqual({ x: -1, y: 0 });
  });

  it('does not advance attacks while the player is dead', () => {
    const { boss, context, pool } = setup();
    boss.activate(0);
    context.player.die();
    boss.update(10, context);
    expect(boss.attackTimer).toBe(BOSS.introTime);
    expect(pool.activeCount).toBe(0);
  });
});

describe('boss attack patterns and dodges', () => {
  it('alternates telegraphed high and low bursts with a recovery window after each', () => {
    const { boss, context, pool } = setup();
    boss.activate(0);
    for (const pattern of ['HIGH', 'LOW']) {
      waitState(boss, context, 'TELEGRAPH');
      expect(boss.pattern).toBe(pattern);
      pool.clear();
      waitState(boss, context, 'RECOVER');
      const bullets = pool.items.filter((bullet) => bullet.active);
      expect(bullets.length).toBe(BOSS.burstCount);
      for (const bullet of bullets) {
        expect(bullet.position.y).toBe(44 + (pattern === 'HIGH' ? BOSS.highHeight : BOSS.lowHeight));
        expect(bullet.velocity).toEqual({ x: -BOSS.bulletSpeeds[0], y: 0 });
        expect(bullet.owner).toBe('enemy');
      }
      expect(boss.vulnerable).toBe(true);
    }
  });

  it('high salvos hit a standing player but pass over a crouching one; jumping avoids low shots', () => {
    for (const [height, crouch, jump, expectedAlive] of [
      [BOSS.highHeight, false, false, false], [BOSS.highHeight, true, false, true],
      [BOSS.lowHeight, false, true, true], [BOSS.lowHeight, true, false, false],
    ] as const) {
      const { player, pool, combat, collision } = setup();
      player.update(dt, { ...shoot, shoot: false }, collision, [floor], 1536);
      player.update(dt, { ...shoot, shoot: false, down: crouch, jumpPressed: jump }, collision, [floor], 1536);
      for (let i = 0; i < 10; i++) player.update(dt, { ...shoot, shoot: false, down: crouch }, collision, [floor], 1536);
      pool.spawn(150, 44 + height, -6000, 0, 1, 'enemy');
      pool.update(dt, [floor], 1536, combat);
      expect(player.alive).toBe(expectedAlive);
    }
  });

  it('phase two snapshots the aim during warning and emits a directed fan, not homing bullets', () => {
    const { boss, context, pool } = setup();
    phaseTwo(boss, context);
    waitState(boss, context, 'TELEGRAPH');
    expect(boss.pattern).toBe('AIMED');
    const aim = { ...boss.aimDirection };
    context.player.position.y = 120;
    pool.clear();
    waitState(boss, context, 'RECOVER');
    expect(boss.aimDirection).toEqual(aim);
    const bullets = pool.items.filter((bullet) => bullet.active);
    expect(bullets.length).toBe(BOSS.burstCount * BOSS.aimedAngles.length);
    for (const bullet of bullets) expect(Math.hypot(bullet.velocity.x, bullet.velocity.y)).toBeCloseTo(BOSS.bulletSpeeds[1]);
    expect(bullets[1]?.velocity.x).toBeCloseTo(aim.x * BOSS.bulletSpeeds[1]);
    expect(bullets[1]?.velocity.y).toBeCloseTo(aim.y * BOSS.bulletSpeeds[1]);
  });

  it('phase three cycles high, low and aimed attacks with shorter warning and faster shots', () => {
    const { boss, context, pool } = setup();
    phaseTwo(boss, context);
    waitState(boss, context, 'RECOVER');
    boss.takeDamage(phaseTwoHealth - phaseThreeBoundary + 1);
    expect(boss.phase).toBe(3);
    for (const pattern of ['HIGH', 'LOW', 'AIMED']) {
      waitState(boss, context, 'TELEGRAPH');
      expect(boss.pattern).toBe(pattern);
      expect(boss.attackTimer).toBe(BOSS.telegraphTimes[2]);
      pool.clear();
      waitState(boss, context, 'RECOVER');
      for (const bullet of pool.items.filter((item) => item.active)) {
        expect(Math.hypot(bullet.velocity.x, bullet.velocity.y)).toBeCloseTo(BOSS.bulletSpeeds[2]);
      }
    }
    expect(BOSS.telegraphTimes[2]).toBeLessThan(BOSS.telegraphTimes[0]);
  });
});

describe('boss collision and arena', () => {
  it('awards 5000 points once on death even if more shots arrive in the same step', () => {
    const { boss, context, pool, combat, score } = setup();
    boss.activate(0);
    waitState(boss, context, 'RECOVER');
    pool.clear();
    pool.spawn(50, 60, 12000, 0, BOSS.health, 'player');
    pool.spawn(50, 60, 12000, 0, BOSS.health, 'player');
    pool.update(dt, [floor], 1536, combat);
    expect(boss.state).toBe('DEAD');
    expect(boss.active).toBe(false);
    expect(score.value).toBe(5000);
    expect(combat.kills).toBe(1);
    expect(pool.activeCount).toBe(1);
    expect(boss.takeDamage(1)).toBe(false);
    expect(boss.activate(0)).toBe(false);
  });

  it('scenery and nearer enemies protect the boss and enemy bullets cannot damage it', () => {
    const { boss, context, pool, combat } = setup();
    boss.activate(0);
    waitState(boss, context, 'RECOVER');
    pool.clear();
    pool.spawn(50, 60, 12000, 0, 3, 'player');
    pool.update(dt, [floor, { x: 150, y: 44, width: 2, height: 40 }], 1536, combat);
    expect(boss.health).toBe(BOSS.health);
    const soldier = new Soldier(150, 44);
    soldier.active = true;
    const shielded = new CombatSystem(context.collision, context.player, [soldier], undefined, boss);
    pool.spawn(50, 60, 12000, 0, soldier.maxHealth, 'player');
    pool.update(dt, [floor], 1536, shielded);
    expect(soldier.alive).toBe(false);
    expect(boss.health).toBe(BOSS.health);
    pool.spawn(150, 60, 12000, 0, 3, 'enemy');
    pool.update(dt, [floor], 1536, combat);
    expect(boss.health).toBe(BOSS.health);
  });

  it('body contact damages the player, respects respawn invulnerability, and disappears after death', () => {
    const { boss, combat, player } = setup();
    boss.activate(0);
    player.position.x = boss.position.x;
    combat.updateContacts();
    expect(player.alive).toBe(false);
    player.respawn(boss.position.x, 44);
    combat.updateContacts();
    expect(player.alive).toBe(true);
    expect(combat.playerHits).toBe(1);
    boss.die();
    player.invulnerabilityTimer = 0;
    combat.updateContacts();
    expect(player.alive).toBe(true);
  });

  it('arena clamps motion at its entry and boss body, keeping the checkpoint and camera safe', () => {
    const { collision, player } = setup();
    const boss = new Boss(SIGNAL_WORKS.boss);
    const checkpoint = SIGNAL_WORKS.checkpoints.find((item) => item.x === boss.arenaLeft);
    expect(checkpoint?.y).toBe(44);
    expect(boss.arenaLeft).toBe(SIGNAL_WORKS.width - 256);
    player.position.x = boss.arenaLeft - 10;
    player.velocity.x = -PLAYER.speed;
    collision.constrainHorizontal(player, boss.arenaLeft, boss.position.x - player.width);
    expect(player.position.x).toBe(boss.arenaLeft);
    expect(player.velocity.x).toBe(0);
    player.position.x = boss.position.x + 10;
    player.velocity.x = PLAYER.speed;
    collision.constrainHorizontal(player, boss.arenaLeft, boss.position.x - player.width);
    expect(player.position.x).toBe(boss.position.x - player.width);
    expect(player.velocity.x).toBe(0);
    const level = new Level(SIGNAL_WORKS);
    expect(level.solids.some((solid) => solid.x <= boss.arenaLeft && solid.x + solid.width >= boss.position.x + boss.width)).toBe(true);
  });
});

describe('boss timestep and pacing', () => {
  it.each([false, true])('rifle/laser firing benchmark stays within 30–60 seconds (laser=%s)', (laser) => {
    const { boss, context, pool, combat, score, player } = setup();
    if (laser) player.weapon = new Laser();
    player.invulnerabilityTimer = 1000;
    boss.activate(0);
    const phases = new Set<number>();
    let seconds = 0;
    for (let i = 0; i < 3600 && boss.alive; i++) {
      boss.update(dt, context);
      player.updateCombat(dt, shoot, pool);
      pool.update(dt, [floor], 1536, combat);
      phases.add(boss.phase);
      seconds += dt;
    }
    expect(boss.alive).toBe(false);
    expect(score.value).toBe(5000);
    expect(phases).toEqual(new Set([1, 2, 3]));
    expect(seconds).toBeGreaterThanOrEqual(30);
    expect(seconds).toBeLessThanOrEqual(60);
  });

  it('attacks and warning timers remain identical with 30, 60 and 144 Hz render', () => {
    const results: unknown[] = [];
    for (const hz of [30, 60, 144]) {
      let callback: FrameRequestCallback = () => {};
      vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      const { boss, context, pool } = setup();
      boss.activate(0);
      const loop = new GameLoop((step) => {
        boss.update(step, context);
        pool.update(step, [floor], 1536);
      }, () => {});
      loop.start();
      for (let i = 0; i <= hz * 8; i++) callback(i * 1000 / hz);
      loop.stop();
      results.push({ shots: pool.enemySpawned, phase: boss.phase, pattern: boss.pattern,
        state: boss.state, attackTimer: boss.attackTimer, activeBullets: pool.activeCount });
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it('pausing freezes boss timers, and victory stops updates instead of requiring the old exit', () => {
    const states = new GameStateManager();
    states.ready();
    states.start();
    const { boss, context } = setup();
    boss.activate(0);
    const timer = boss.attackTimer;
    states.pause();
    for (let i = 0; i < 60; i++) if (states.state === 'PLAYING') boss.update(dt, context);
    expect(boss.attackTimer).toBe(timer);
    states.resume();
    waitState(boss, context, 'RECOVER');
    boss.takeDamage(BOSS.health);
    if (!boss.alive) states.complete();
    expect(states.state).toBe('LEVEL_COMPLETE');
  });
});
