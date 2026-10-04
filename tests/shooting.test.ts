import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollisionSystem, segmentHitsAABB } from '../src/collision/CollisionSystem';
import { PLAYER, PROJECTILES, RIFLE, TIMING } from '../src/config/constants';
import { GameLoop } from '../src/core/GameLoop';
import { Player } from '../src/entities/Player';
import type { PlayerControls } from '../src/entities/Player';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { Rifle } from '../src/weapons/Rifle';

const collision = new CollisionSystem();
const floor = { x: 0, y: 0, width: 1536, height: 44 };
const idle: PlayerControls = { left: false, right: false, jumpPressed: false, up: false, shoot: false, down: false };
const dt = TIMING.fixedStep;
const rightAim = { x: 1, y: 0 };

function firstActive(pool: ProjectileManager) {
  const projectile = pool.items.find((item) => item.active);
  if (!projectile) throw new Error('Expected an active projectile');
  return projectile;
}

function tick(player: Player, controls: PlayerControls, pool: ProjectileManager): void {
  player.update(dt, controls, collision, [floor], 1536);
  player.updateCombat(dt, controls, pool);
  pool.update(dt, [floor], 1536);
}

afterEach(() => vi.unstubAllGlobals());

describe('swept projectile collisions', () => {
  const box = { x: 10, y: 10, width: 5, height: 5 };
  it.each([
    [0, 12, 30, 12, true],
    [30, 12, 0, 12, true],
    [12, 0, 12, 30, true],
    [12, 30, 12, 0, true],
    [0, 0, 30, 30, true],
    [12, 12, 12, 12, true],
    [0, 0, 0, 0, false],
    [0, 20, 30, 20, false],
    [0, 0, 5, 5, false],
    [0, 0, 30, 15, false],
  ])('sweeps (%i,%i) → (%i,%i)', (x0, y0, x1, y1, expected) => {
    expect(segmentHitsAABB(x0, y0, x1, y1, box)).toBe(expected);
  });

  it('includes projectile half-size when checking a grazing hit', () => {
    expect(segmentHitsAABB(0, 9, 30, 9, box)).toBe(false);
    expect(segmentHitsAABB(0, 9, 30, 9, box, 1.5)).toBe(true);
  });

  it('removes a fast projectile when both endpoints miss a thin wall', () => {
    const pool = new ProjectileManager(collision);
    pool.spawn(20, 60, 1000, 0, 1, 'player');
    pool.update(0.1, [{ x: 50, y: 44, width: 2, height: 40 }], 1536);
    expect(pool.activeCount).toBe(0);
  });

  it('includes the gun barrel in the first sweep to prevent firing through walls', () => {
    const pool = new ProjectileManager(collision);
    pool.spawn(20, 60, 320, 0, 1, 'player', 15);
    expect(firstActive(pool).position.x).toBe(35);
    pool.update(dt, [{ x: 30, y: 44, width: 2, height: 40 }], 1536);
    expect(pool.activeCount).toBe(0);
  });
});

describe('projectile pool', () => {
  it('enforces capacity and reuses objects with fresh data', () => {
    const pool = new ProjectileManager(collision, 1);
    expect(pool.spawn(20, 60, 320, 0, 1, 'player')).toBe(true);
    const original = firstActive(pool);
    expect(pool.spawn(30, 60, 320, 0, 1, 'player')).toBe(false);
    expect(pool.activeCount).toBe(1);
    pool.deactivate(original);
    pool.deactivate(original);
    expect(pool.activeCount).toBe(0);
    expect(pool.spawn(90, 100, -80, 20, 3, 'enemy')).toBe(true);
    expect(firstActive(pool)).toBe(original);
    expect(original.position).toEqual({ x: 90, y: 100 });
    expect(original.previousPosition).toEqual({ x: 90, y: 100 });
    expect(original.velocity).toEqual({ x: -80, y: 20 });
    expect(original.owner).toBe('enemy');
    expect(original.damage).toBe(3);
    expect(original.lifeRemaining).toBe(PROJECTILES.lifetime);
    expect(pool.totalSpawned).toBe(2);
  });

  it('advances active projectiles, expires lifetime, and leaves inactive objects untouched', () => {
    const pool = new ProjectileManager(collision, 2);
    pool.spawn(20, 60, 100, 50, 1, 'player');
    const bullet = firstActive(pool);
    pool.update(0.1, [], 1536);
    expect(bullet.position).toEqual({ x: 30, y: 65 });
    pool.update(PROJECTILES.lifetime, [], 1536);
    expect(pool.activeCount).toBe(0);
    pool.update(1, [], 1536);
    expect(bullet.position).toEqual({ x: 30, y: 65 });
  });

  it.each([[-1000, 0], [2000, 0], [0, 1000], [0, -1000]])(
    'recycles projectiles leaving bounds with velocity %i,%i', (vx, vy) => {
      const pool = new ProjectileManager(collision);
      pool.spawn(20, 60, vx, vy, 1, 'player');
      pool.update(1, [], 1536);
      expect(pool.activeCount).toBe(0);
    },
  );
});

describe('rifle cadence', () => {
  it('fires immediately, respects cooldown, and keeps speed and damage in the weapon', () => {
    const rifle = new Rifle();
    const pool = new ProjectileManager(collision);
    expect(rifle.fire(pool, 20, 60, rightAim, 'player')).toBe(true);
    expect(firstActive(pool).velocity).toEqual({ x: RIFLE.projectileSpeed, y: 0 });
    expect(firstActive(pool).damage).toBe(RIFLE.damage);
    expect(rifle.fire(pool, 20, 60, rightAim, 'player')).toBe(false);
    rifle.update(1 / rifle.fireRate - dt);
    expect(rifle.fire(pool, 20, 60, rightAim, 'player')).toBe(false);
    rifle.update(dt);
    expect(rifle.fire(pool, 20, 60, rightAim, 'player')).toBe(true);
  });

  it('does not consume cooldown when the pool is full', () => {
    const rifle = new Rifle();
    const pool = new ProjectileManager(collision, 1);
    pool.spawn(10, 60, 1, 0, 1, 'player');
    expect(rifle.fire(pool, 20, 60, rightAim, 'player')).toBe(false);
    pool.deactivate(firstActive(pool));
    expect(rifle.fire(pool, 20, 60, rightAim, 'player')).toBe(true);
  });
});

describe('player aiming and simultaneous controls', () => {
  it.each([
    [false, false, false, 1, 0],
    [true, false, false, -1, 0],
    [false, false, true, 0, 1],
    [false, true, true, Math.SQRT1_2, Math.SQRT1_2],
    [true, false, true, -Math.SQRT1_2, Math.SQRT1_2],
    [true, true, true, 0, 1],
  ])('aims with left=%s right=%s up=%s', (left, right, up, x, y) => {
    const player = new Player(62, 44);
    const pool = new ProjectileManager(collision);
    tick(player, { ...idle, left, right, up, shoot: true }, pool);
    expect(player.aimDirection).toEqual({ x, y });
    const bullet = firstActive(pool);
    expect(Math.hypot(bullet.velocity.x, bullet.velocity.y)).toBeCloseTo(RIFLE.projectileSpeed);
    expect(bullet.velocity.x).toBeCloseTo(x * RIFLE.projectileSpeed);
    expect(bullet.velocity.y).toBeCloseTo(y * RIFLE.projectileSpeed);
    expect(bullet.position.x).toBeCloseTo(player.position.x + player.width / 2
      + x * PLAYER.muzzleDistance + bullet.velocity.x * dt);
    expect(bullet.position.y).toBeCloseTo(player.position.y + PLAYER.gunPivotY
      + y * PLAYER.muzzleDistance + bullet.velocity.y * dt);
  });

  it('keeps facing direction after releasing movement and shoots from idle', () => {
    const player = new Player(62, 44);
    const pool = new ProjectileManager(collision);
    tick(player, { ...idle, left: true }, pool);
    tick(player, { ...idle, shoot: true }, pool);
    expect(player.direction).toBe(-1);
    expect(player.aimDirection).toEqual({ x: -1, y: 0 });
    expect(player.state).toBe('SHOOT');
    expect(player.velocity.x).toBe(0);
    tick(player, idle, pool);
    expect(player.state).toBe('IDLE');
    expect(player.shooting).toBe(false);
  });

  it('never changes the trajectory while firing through running and jumping', () => {
    const player = new Player(62, 44);
    const reference = new Player(62, 44);
    const pool = new ProjectileManager(collision);
    const silentPool = new ProjectileManager(collision);
    for (let i = 0; i < 120; i++) {
      const controls = { ...idle, right: true, up: true, jumpPressed: i === 1, shoot: true };
      tick(player, controls, pool);
      tick(reference, { ...controls, shoot: false }, silentPool);
      expect(player.position).toEqual(reference.position);
      expect(player.velocity).toEqual(reference.velocity);
      if (i === 1) expect(player.state).toBe('JUMP');
    }
    expect(pool.totalSpawned).toBe(12);
  });

  it('stops firing on release and does not accumulate bursts during idle time', () => {
    const player = new Player(62, 44);
    const pool = new ProjectileManager(collision);
    for (let i = 0; i < 60; i++) tick(player, { ...idle, shoot: true }, pool);
    expect(pool.totalSpawned).toBe(6);
    for (let i = 0; i < 60; i++) tick(player, idle, pool);
    expect(pool.totalSpawned).toBe(6);
    tick(player, { ...idle, shoot: true }, pool);
    expect(pool.totalSpawned).toBe(7);
  });

  it.each([30, 60, 144])('keeps cadence and bullet trajectories with a %i Hz renderer', (hz) => {
    let callback: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const player = new Player(62, 44);
    const pool = new ProjectileManager(collision);
    const loop = new GameLoop(() => tick(player, { ...idle, shoot: true, up: true }, pool), () => {});
    loop.start();
    for (let i = 0; i <= hz; i++) callback(i * 1000 / hz);
    loop.stop();
    expect(pool.totalSpawned).toBe(6);
    expect(pool.activeCount).toBe(3);
    const heights = pool.items.filter((item) => item.active).map((item) => item.position.y).sort((a, b) => a - b);
    for (let i = 0; i < heights.length; i++) {
      expect(heights[i]).toBeCloseTo(75 + RIFLE.projectileSpeed * (i + 1) / 6);
    }
  });
});
