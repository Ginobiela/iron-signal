import { describe, expect, it } from 'vitest';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { CombatSystem } from '../src/collision/CombatSystem';
import { PLAYER, RIFLE, SPREAD_GUN, TIMING } from '../src/config/constants';
import { Player } from '../src/entities/Player';
import type { PlayerControls } from '../src/entities/Player';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { Laser } from '../src/weapons/Laser';
import { MachineGun } from '../src/weapons/MachineGun';
import { Rifle } from '../src/weapons/Rifle';
import { SpreadGun } from '../src/weapons/SpreadGun';

const collision = new CollisionSystem();
const floor = { x: 0, y: 0, width: 500, height: 44 };
const idle: PlayerControls = { left: false, right: false, jumpPressed: false, up: false, shoot: false, down: false };
const dt = TIMING.fixedStep;

function fire(player: Player, controls: PlayerControls, capacity = 32) {
  const pool = new ProjectileManager(collision, capacity);
  player.updateCombat(dt, controls, pool);
  return pool;
}

describe('airborne eight-direction aiming', () => {
  it.each([
    ['down', { down: true }, { x: 0, y: -1 }],
    ['down-right', { down: true, right: true }, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }],
    ['down-left', { down: true, left: true }, { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }],
    ['down overrides up', { down: true, up: true }, { x: 0, y: -1 }],
    ['up-right', { up: true, right: true }, { x: Math.SQRT1_2, y: Math.SQRT1_2 }],
    ['left', { left: true }, { x: -1, y: 0 }],
  ])('aims %s with a unit vector and fires with the equipped weapon', (_name, input, expected) => {
    const player = new Player(100, 120);
    if (_name === 'left') player.direction = -1;
    player.weapon = new Rifle();
    const pool = fire(player, { ...idle, ...input, shoot: true });
    expect(player.aimDirection).toEqual(expected);
    const shots = pool.items.filter((shot) => shot.active);
    expect(shots.length).toBe(1);
    expect(Math.hypot(shots[0]!.velocity.x, shots[0]!.velocity.y)).toBeCloseTo(RIFLE.projectileSpeed);
    expect(shots[0]!.velocity.x / RIFLE.projectileSpeed).toBeCloseTo(expected.x);
    expect(shots[0]!.velocity.y / RIFLE.projectileSpeed).toBeCloseTo(expected.y);
  });

  it.each([Rifle, MachineGun, SpreadGun, Laser])('%s fires lower trajectories from the lower muzzle', (WeaponType) => {
    const player = new Player(100, 120);
    player.weapon = new WeaponType();
    const pool = fire(player, { ...idle, down: true, right: true, shoot: true });
    const shots = pool.items.filter((shot) => shot.active);
    expect(shots.length).toBe(WeaponType === SpreadGun ? 5 : 1);
    for (const shot of shots) {
      expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(player.weapon.projectileSpeed);
      expect(shot.position.x).toBeCloseTo(player.projectileOriginX + shot.velocity.x / player.weapon.projectileSpeed * player.muzzleDistance);
      expect(shot.position.y).toBeCloseTo(player.projectileOriginY + shot.velocity.y / player.weapon.projectileSpeed * player.muzzleDistance);
      expect(shot.previousPosition).toEqual({ x: player.projectileOriginX, y: player.projectileOriginY });
      const muzzleEndX = player.projectileOriginX + shot.velocity.x / player.weapon.projectileSpeed * player.muzzleDistance;
      const muzzleEndY = player.projectileOriginY + shot.velocity.y / player.weapon.projectileSpeed * player.muzzleDistance;
      expect(muzzleEndX < player.position.x || muzzleEndX > player.position.x + player.width
        || muzzleEndY < player.position.y || muzzleEndY > player.position.y + player.height).toBe(true);
    }
    expect(player.muzzleDistance).toBe(PLAYER.muzzleDistance);
    const vertical = new Player(100, 120);
    vertical.updateCombat(dt, { ...idle, down: true, shoot: true }, new ProjectileManager(collision));
    expect(vertical.muzzleDistance).toBe(9);
    expect(vertical.projectileOriginX).toBeCloseTo(vertical.position.x + vertical.width / 2 + 12);
    expect(vertical.projectileOriginY).toBeCloseTo(vertical.position.y + vertical.gunPivotY);
    expect(player.projectileOriginX).toBeCloseTo(player.position.x + player.width / 2 + 4);
  });

  it('rotates the spread cone around down-right and refuses a partial volley when full', () => {
    const player = new Player(100, 120);
    player.weapon = new SpreadGun();
    const pool = fire(player, { ...idle, down: true, right: true, shoot: true });
    const directions = pool.items.filter((shot) => shot.active).map((shot) => ({
      x: shot.velocity.x / player.weapon.projectileSpeed,
      y: shot.velocity.y / player.weapon.projectileSpeed,
    }));
    expect(directions).toHaveLength(5);
    expect(directions[0]!.x).toBeLessThan(Math.SQRT1_2);
    expect(directions[0]!.y).toBeLessThan(-Math.SQRT1_2);
    expect(directions[4]!.x).toBeGreaterThan(Math.SQRT1_2);
    expect(directions[4]!.y).toBeGreaterThan(-Math.SQRT1_2);

    const full = new ProjectileManager(collision, 5);
    for (let i = 0; i < 3; i++) full.spawn(10, 10, 1, 0, 1, 'enemy');
    const blocked = new Player(100, 120);
    blocked.weapon = new SpreadGun();
    blocked.updateCombat(dt, { ...idle, down: true, shoot: true }, full);
    expect(full.playerSpawned).toBe(0);
    expect(full.activeCount).toBe(3);
  });

  it('fires the full Spread volley straight down at configured angles and equal speed', () => {
    const player = new Player(100, 120);
    player.weapon = new SpreadGun();
    const pool = fire(player, { ...idle, down: true, shoot: true });
    const shots = pool.items.filter((shot) => shot.active);
    expect(shots).toHaveLength(SPREAD_GUN.angles.length);
    for (const [index, shot] of shots.entries()) {
      const angle = (-90 + SPREAD_GUN.angles[index]!) * Math.PI / 180;
      expect(shot.velocity.x).toBeCloseTo(Math.cos(angle) * player.weapon.projectileSpeed);
      expect(shot.velocity.y).toBeCloseTo(Math.sin(angle) * player.weapon.projectileSpeed);
      expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(player.weapon.projectileSpeed);
    }
  });

  it('reuses the same pool slots across repeated volleys after clearing', () => {
    const player = new Player(100, 120);
    player.weapon = new SpreadGun();
    const pool = new ProjectileManager(collision, SPREAD_GUN.angles.length);
    const poolItems = pool.items;
    let firstVolley: typeof pool.items[number][] = [];
    for (let volley = 0; volley < 20; volley++) {
      pool.clear(false);
      player.updateCombat(0.25, { ...idle, down: true, shoot: true }, pool);
      const active = pool.items.filter((shot) => shot.active);
      expect(active).toHaveLength(SPREAD_GUN.angles.length);
      if (volley === 0) firstVolley = active;
      else expect(active).toEqual(firstVolley);
      expect(pool.items).toBe(poolItems);
    }
    expect(pool.totalSpawned).toBe(20 * SPREAD_GUN.angles.length);
  });

  it('retains the aim vector object, updates its components, and does not aim or fire when dead', () => {
    const player = new Player(100, 120);
    const aim = player.aimDirection;
    const pool = new ProjectileManager(collision);
    player.updateCombat(dt, { ...idle, down: true }, pool);
    expect(player.aimDirection).toBe(aim);
    expect(aim).toEqual({ x: 0, y: -1 });
    player.updateCombat(dt, { ...idle, up: true }, pool);
    expect(aim).toEqual({ x: 0, y: 1 });
    player.die();
    player.updateCombat(dt, { ...idle, down: true, shoot: true }, pool);
    expect(aim).toEqual({ x: 0, y: 1 });
    expect(pool.activeCount).toBe(0);
    expect(pool.playerSpawned).toBe(0);
  });

  it('tracks horizontal, upper and lower aim changes, and respects facing when straight down', () => {
    const player = new Player(100, 120);
    const pool = new ProjectileManager(collision);
    player.direction = -1;
    player.updateCombat(dt, { ...idle, down: true, shoot: true }, pool);
    expect(player.aimDirection).toEqual({ x: 0, y: -1 });
    player.updateCombat(dt, { ...idle, left: true, down: true, shoot: true }, pool);
    expect(player.aimDirection).toEqual({ x: -Math.SQRT1_2, y: -Math.SQRT1_2 });
    player.updateCombat(dt, { ...idle, up: true, shoot: true }, pool);
    expect(player.aimDirection).toEqual({ x: 0, y: 1 });
    player.updateCombat(dt, { ...idle, shoot: true }, pool);
    expect(player.aimDirection).toEqual({ x: -1, y: 0 });
  });
});

describe('grounded down input and muzzle collision', () => {
  it('keeps horizontal facing while grounded down crouches, even when up is also held', () => {
    const player = new Player(100, 44);
    player.grounded = true;
    player.direction = -1;
    player.update(dt, { ...idle, down: true, up: true }, collision, [floor], 500);
    player.updateCombat(dt, { ...idle, down: true, up: true }, new ProjectileManager(collision));
    expect(player.crouching).toBe(true);
    expect(player.state).toBe('CROUCH');
    expect(player.aimDirection).toEqual({ x: -1, y: 0 });
  });

  it('starts lower shots at the muzzle and does not collide with its owner, while the floor still blocks them', () => {
    const player = new Player(100, 80);
    player.weapon = new Rifle();
    const pool = fire(player, { ...idle, down: true, shoot: true });
    const shot = pool.items.find((item) => item.active)!;
    expect(shot.previousPosition).toEqual({ x: player.projectileOriginX, y: player.projectileOriginY });
    expect(player.projectileOriginX).toBeCloseTo(player.position.x + player.width / 2 + 12);
    expect(player.projectileOriginY).toBeCloseTo(player.position.y + player.gunPivotY);
    const combat = new CombatSystem(collision, player, []);
    pool.update(dt, [floor], 500, combat);
    expect(pool.activeCount).toBe(1);

    const nearFloor = new Player(100, 45);
    nearFloor.weapon = new Rifle();
    const floorPool = fire(nearFloor, { ...idle, down: true, shoot: true });
    const floorShot = floorPool.items.find((item) => item.active)!;
    expect(floorShot.previousPosition).toEqual({ x: nearFloor.projectileOriginX, y: nearFloor.projectileOriginY });
    floorPool.update(0.05, [floor], 500, new CombatSystem(collision, nearFloor, []));
    expect(floorPool.activeCount).toBe(0);
    expect(PLAYER.muzzleDistance).toBeGreaterThan(0);
  });
});
