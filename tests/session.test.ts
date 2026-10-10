import { describe, expect, it } from 'vitest';
import { CollisionSystem, overlaps } from '../src/collision/CollisionSystem';
import { CombatSystem } from '../src/collision/CombatSystem';
import { GAMEPLAY, PLAYER, SCORE, TIMING, WORLD } from '../src/config/constants';
import { GameStateManager } from '../src/core/GameStateManager';
import { formatScore, ScoreManager } from '../src/core/ScoreManager';
import { Player } from '../src/entities/Player';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { CheckpointManager } from '../src/level/Checkpoint';
import { EnemySpawner } from '../src/level/EnemySpawner';
import { Level } from '../src/level/Level';
import { SIGNAL_WORKS } from '../src/level/signalWorks';
import { PowerupManager } from '../src/level/PowerupManager';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';

const dt = TIMING.fixedStep;
const collision = new CollisionSystem();
const floor = { x: 0, y: 0, width: 1536, height: 44 };
const idle = { left: false, right: false, up: false, down: false, shoot: false, jumpPressed: false };
function started() {
  const states = new GameStateManager();
  states.ready();
  states.start();
  return states;
}

describe('centralized game states', () => {
  it('boots into a frozen menu and only starts from allowed terminal states', () => {
    const states = new GameStateManager();
    expect(states.state).toBe('BOOT');
    expect(states.start()).toBe(false);
    states.ready();
    expect(states.state).toBe('MENU');
    states.playerDied();
    states.complete();
    expect(states.lives).toBe(GAMEPLAY.initialLives);
    expect(states.state).toBe('MENU');
    expect(states.start()).toBe(true);
    expect(states.state).toBe('PLAYING');
    expect(states.start()).toBe(false);
    states.ready();
    expect(states.state).toBe('PLAYING');
  });

  it('pauses and resumes without modifying lives, and ignores gameplay transitions in pause', () => {
    const states = started();
    states.pause();
    expect(states.state).toBe('PAUSED');
    expect(states.start()).toBe(false);
    states.playerDied();
    states.complete();
    expect(states.update(100)).toBe(false);
    expect(states.lives).toBe(GAMEPLAY.initialLives);
    expect(states.state).toBe('PAUSED');
    states.togglePause();
    expect(states.state).toBe('PLAYING');
    states.togglePause();
    expect(states.state).toBe('PAUSED');
    states.resume();
    expect(states.state).toBe('PLAYING');
  });

  it('consumes each life once, waits before respawn and reaches game over after exhausting the configured lives', () => {
    const states = started();
    for (let remaining = GAMEPLAY.initialLives - 1; remaining >= 0; remaining--) {
      states.playerDied();
      states.playerDied();
      expect(states.lives).toBe(remaining);
      expect(states.state).toBe('PLAYER_DEAD');
      expect(states.start()).toBe(false);
      states.togglePause();
      expect(states.state).toBe('PLAYER_DEAD');
      expect(states.update(GAMEPLAY.deathDelay - dt)).toBe(false);
      expect(states.update(dt)).toBe(remaining > 0);
      expect(states.state).toBe(remaining > 0 ? 'PLAYING' : 'GAME_OVER');
    }
    states.playerDied();
    states.complete();
    expect(states.lives).toBe(0);
    expect(states.update(100)).toBe(false);
    expect(states.start()).toBe(true);
    expect(states.lives).toBe(GAMEPLAY.initialLives);
    expect(states.state).toBe('PLAYING');
  });

  it('completion freezes the session and allows a new run', () => {
    const states = started();
    states.complete();
    expect(states.state).toBe('LEVEL_COMPLETE');
    states.playerDied();
    states.pause();
    expect(states.state).toBe('LEVEL_COMPLETE');
    expect(states.lives).toBe(GAMEPLAY.initialLives);
    expect(states.start()).toBe(true);
    expect(states.state).toBe('PLAYING');
  });
});

describe('checkpoint selection and respawn', () => {
  const initial = { x: 62, y: 44, name: 'Inicio' };
  const first = { x: 620, y: 44, name: 'Puente' };
  const second = { x: 2400, y: 44, name: 'Canal' };

  it('selects the furthest crossed checkpoint even from unsorted data and never regresses', () => {
    const checkpoints = new CheckpointManager(initial, [second, first]);
    const player = new Player(619, 44);
    player.grounded = true;
    checkpoints.update(dt, player);
    expect(checkpoints.current).toBe(initial);
    player.position.x = 620;
    checkpoints.update(dt, player);
    expect(checkpoints.current).toBe(first);
    player.position.x = 2500;
    checkpoints.update(dt, player);
    expect(checkpoints.current).toBe(second);
    player.position.x = 62;
    checkpoints.update(dt, player);
    expect(checkpoints.current).toBe(second);
    checkpoints.reset();
    expect(checkpoints.current).toBe(initial);
    expect(checkpoints.message).toBe('');
  });

  it('requires a live grounded player, announces once and expires on simulation time', () => {
    const checkpoints = new CheckpointManager(initial, [first]);
    const player = new Player(650, 90);
    checkpoints.update(dt, player);
    expect(checkpoints.current).toBe(initial);
    player.grounded = true;
    player.die();
    checkpoints.update(dt, player);
    expect(checkpoints.current).toBe(initial);
    player.reset(650, 44);
    player.grounded = true;
    checkpoints.update(dt, player);
    expect(checkpoints.message).toContain('PUENTE');
    checkpoints.update(GAMEPLAY.checkpointNoticeTime + dt, player);
    expect(checkpoints.message).toBe('');
    checkpoints.update(dt, player);
    expect(checkpoints.message).toBe('');
  });

  it('respawn resets posture, motion and weapon and provides protection; pits remain fatal', () => {
    const player = new Player(62, 44);
    const powerups = new PowerupManager(collision);
    powerups.spawn('S', 62, 48);
    powerups.update(dt, player, [floor], [], 1536);
    player.height = PLAYER.crouchHeight;
    player.velocity.x = 95;
    player.die();
    player.respawn(first.x, first.y);
    expect(player.position).toEqual({ x: 620, y: 44 });
    expect(player.height).toBe(PLAYER.height);
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    expect(player.weapon.name).toBe('RIFLE');
    expect(player.invulnerabilityTimer).toBe(PLAYER.invulnerabilityTime);
    expect(player.takeDamage(1)).toBe(false);
    player.update(PLAYER.invulnerabilityTime + dt, idle, collision, [floor], 1536);
    expect(player.takeDamage(1)).toBe(true);
    expect(player.alive).toBe(false);
    player.respawn(620, WORLD.killY - 1);
    player.update(dt, idle, collision, [], 1536);
    expect(player.alive).toBe(false);
  });

  it('all configured respawns are on safe solid ground and outside obstacles', () => {
    const level = new Level(SIGNAL_WORKS);
    for (const checkpoint of SIGNAL_WORKS.checkpoints) {
      const player = new Player(checkpoint.x, checkpoint.y);
      const bounds = { x: checkpoint.x, y: checkpoint.y, width: PLAYER.width, height: PLAYER.height };
      expect(level.solids.some((solid) => overlaps(solid, bounds))).toBe(false);
      player.update(dt, idle, collision, level.solids, SIGNAL_WORKS.width, level.oneWays);
      expect(player.grounded).toBe(true);
      expect(player.position.y).toBe(checkpoint.y);
    }
  });
});

describe('score and persistence', () => {
  it('adds configured points, formats eight digits and keeps record after restarting', () => {
    const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); } };
    const score = new ScoreManager(storage);
    score.add(SCORE.soldier);
    score.add(SCORE.turret);
    score.add(SCORE.flying);
    expect(score.value).toBe(600);
    expect(formatScore(score.value)).toBe('00000600');
    expect(new ScoreManager(storage).highScore).toBe(600);
    score.reset();
    expect(score.value).toBe(0);
    expect(score.highScore).toBe(600);
    expect(formatScore(12500)).toBe('00012500');
    expect(SCORE.boss).toBe(5000);
  });

  it.each(['invalid', '-5', 'Infinity', '1.5'])('ignores invalid stored record %s', (value) => {
    const score = new ScoreManager({ getItem: () => value, setItem: () => {} });
    expect(score.highScore).toBe(0);
    score.add(100);
    expect(score.highScore).toBe(100);
  });

  it('works with unavailable or blocked storage and ignores invalid score additions', () => {
    for (const storage of [null, {
      getItem: (): string | null => { throw new Error('Blocked'); },
      setItem: (): void => { throw new Error('Blocked'); },
    }]) {
      const score = new ScoreManager(storage);
      for (const points of [-100, 0, NaN, Infinity, 1.5]) score.add(points);
      expect(score.value).toBe(0);
      score.add(100);
      expect(score.value).toBe(100);
      expect(score.highScore).toBe(100);
    }
  });

  it('only projectile kills award points once; retirement and falling enemies grant none', () => {
    const enemies = new EnemyManager();
    const runner = enemies.spawn({ kind: 'runner', x: 90, y: 44 });
    const retired = enemies.spawn({ kind: 'soldier', x: 10, y: 44 });
    const fallen = enemies.spawn({ kind: 'soldier', x: 130, y: WORLD.killY - 1 });
    retired.die();
    fallen.die();
    const score = new ScoreManager(null);
    const player = new Player(20, 44);
    const pool = new ProjectileManager(collision);
    const combat = new CombatSystem(collision, player, enemies.items, (enemy) => score.add(SCORE[enemy.kind]));
    pool.spawn(20, 50, 6000, 0, runner.maxHealth, 'player');
    pool.spawn(20, 50, 6000, 0, runner.maxHealth, 'player');
    pool.update(dt, [floor], 1536, combat);
    expect(runner.alive).toBe(false);
    expect(score.value).toBe(100);
    expect(combat.kills).toBe(1);
    expect(pool.activeCount).toBe(1);
  });
});

it('death preserves score, pickups and spawn history while clearing shots and repositioning to checkpoint', () => {
  const states = started();
  const score = new ScoreManager(null);
  const player = new Player(620, 44);
  const checkpoints = new CheckpointManager({ x: 62, y: 44, name: 'Inicio' }, [{ x: 620, y: 44, name: 'Puente' }]);
  player.grounded = true;
  checkpoints.update(dt, player);
  const powerups = new PowerupManager(collision);
  powerups.spawn('M', 620, 48);
  powerups.update(dt, player, [floor], [], 1536);
  const enemies = new EnemyManager();
  const spawner = new EnemySpawner([{ x: 500, enemies: [{ kind: 'runner', x: 700, y: 44 }] }], (enemy) => { enemies.spawn(enemy); });
  spawner.update(500);
  const pool = new ProjectileManager(collision);
  const combat = new CombatSystem(collision, player, enemies.items, (enemy) => score.add(SCORE[enemy.kind]));
  pool.spawn(640, 50, 6000, 0, enemies.items[0]!.maxHealth, 'player');
  pool.update(dt, [floor], 1536, combat);
  pool.spawn(680, 60, -6000, 0, 1, 'enemy');
  pool.update(dt, [floor], 1536, combat);
  expect(player.alive).toBe(false);
  states.playerDied();
  pool.clear(false);
  expect(pool.activeCount).toBe(0);
  expect(pool.totalSpawned).toBe(2);
  expect(states.update(GAMEPLAY.deathDelay)).toBe(true);
  player.respawn(checkpoints.current.x, checkpoints.current.y);
  expect(player.position.x).toBe(620);
  expect(player.weapon.name).toBe('RIFLE');
  expect(states.lives).toBe(GAMEPLAY.initialLives - 1);
  expect(score.value).toBe(100);
  expect(powerups.items[0]?.active).toBe(false);
  spawner.update(0);
  spawner.update(500);
  expect(enemies.items.length).toBe(1);
  expect(enemies.items[0]?.alive).toBe(false);
  expect(spawner.triggeredCount).toBe(1);
});
