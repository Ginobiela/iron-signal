import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { CombatSystem } from '../src/collision/CombatSystem';
import { LASER, MACHINE_GUN, PLAYER, POWERUPS, SPREAD_GUN, TIMING } from '../src/config/constants';
import { GameLoop } from '../src/core/GameLoop';
import { Player } from '../src/entities/Player';
import { Turret } from '../src/entities/enemies/Turret';
import { PowerupManager } from '../src/level/PowerupManager';
import { SIGNAL_WORKS } from '../src/level/signalWorks';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { MachineGun } from '../src/weapons/MachineGun';
import { SpreadGun } from '../src/weapons/SpreadGun';
import { Laser } from '../src/weapons/Laser';
import { Rifle } from '../src/weapons/Rifle';

const collision = new CollisionSystem();
const dt = TIMING.fixedStep;
const aim = { x: 1, y: 0 };
const idle = { left: false, right: false, up: false, down: false, shoot: false, jumpPressed: false };
const floor = { x: 0, y: 0, width: 1536, height: 44 };
const types = [MachineGun, SpreadGun, Laser] as const;

afterEach(() => vi.unstubAllGlobals());

describe('weapon patterns and cooldown', () => {
  it.each(types)('%s fires immediately and respects its own cooldown', (Type) => {
    const weapon = new Type();
    const pool = new ProjectileManager(collision);
    expect(weapon.fire(pool, 50, 100, aim, 'player')).toBe(true);
    const first = pool.totalSpawned;
    weapon.update(1 / weapon.fireRate - dt);
    expect(weapon.fire(pool, 50, 100, aim, 'player')).toBe(false);
    weapon.update(dt);
    expect(weapon.fire(pool, 50, 100, aim, 'player')).toBe(true);
    expect(pool.totalSpawned).toBe(first * 2);
  });

  it('Machine Gun doubles rifle cadence while maintaining a single straight bullet', () => {
    const pool = new ProjectileManager(collision);
    const weapon = new MachineGun();
    for (let i = 0; i < 60; i++) {
      weapon.update(dt);
      weapon.fire(pool, 50, 100, aim, 'player');
    }
    expect(pool.totalSpawned).toBe(MACHINE_GUN.fireRate);
    expect(weapon.fireRate).toBe(new Rifle().fireRate * 2);
    for (const bullet of pool.items.filter((item) => item.active)) {
      expect(bullet.velocity).toEqual({ x: MACHINE_GUN.projectileSpeed, y: 0 });
      expect(bullet.damage).toBe(MACHINE_GUN.damage);
    }
  });

  it.each([0, 45, 90, 135, 180])('Spread rotates all five angles around a %i degree aim', (degrees) => {
    const angle = degrees * Math.PI / 180;
    const pool = new ProjectileManager(collision);
    new SpreadGun().fire(pool, 50, 100, { x: Math.cos(angle), y: Math.sin(angle) }, 'player', PLAYER.muzzleDistance);
    const bullets = pool.items.filter((item) => item.active);
    expect(bullets.length).toBe(5);
    bullets.forEach((bullet, index) => {
      const expectedAngle = angle + (SPREAD_GUN.angles[index] ?? 0) * Math.PI / 180;
      expect(bullet.velocity.x).toBeCloseTo(Math.cos(expectedAngle) * SPREAD_GUN.projectileSpeed);
      expect(bullet.velocity.y).toBeCloseTo(Math.sin(expectedAngle) * SPREAD_GUN.projectileSpeed);
      expect(Math.hypot(bullet.velocity.x, bullet.velocity.y)).toBeCloseTo(SPREAD_GUN.projectileSpeed);
      expect(bullet.damage).toBe(SPREAD_GUN.damage);
      expect(bullet.owner).toBe('player');
      expect(bullet.previousPosition).toEqual({ x: 50, y: 100 });
    });
  });

  it('Spread rejects a partial volley without consuming slots or cooldown', () => {
    const pool = new ProjectileManager(collision, 5);
    pool.spawn(10, 100, 1, 0, 1, 'enemy');
    const weapon = new SpreadGun();
    expect(weapon.fire(pool, 50, 100, aim, 'player')).toBe(false);
    expect(pool.activeCount).toBe(1);
    expect(pool.playerSpawned).toBe(0);
    pool.clear();
    expect(weapon.fire(pool, 50, 100, aim, 'player')).toBe(true);
    expect(pool.activeCount).toBe(5);
    expect(pool.availableCount).toBe(0);
  });

  it('Laser deals heavier damage and respects scenery instead of tunneling through it', () => {
    const turret = new Turret(90, 44);
    turret.active = true;
    const pool = new ProjectileManager(collision);
    const player = new Player(20, 44);
    const combat = new CombatSystem(collision, player, [turret]);
    const weapon = new Laser();
    weapon.fire(pool, 50, 60, aim, 'player');
    pool.update(0.1, [floor], 1536, combat);
    expect(turret.health).toBe(turret.maxHealth - LASER.damage);
    weapon.update(1 / weapon.fireRate);
    weapon.fire(pool, 50, 60, aim, 'player');
    pool.update(0.1, [floor, { x: 70, y: 44, width: 2, height: 40 }], 1536, combat);
    expect(turret.health).toBe(turret.maxHealth - LASER.damage);
    expect(pool.activeCount).toBe(0);
    weapon.update(1 / weapon.fireRate);
    weapon.fire(pool, 50, 60, aim, 'player');
    pool.update(0.1, [floor], 1536, combat);
    expect(turret.alive).toBe(false);
    expect(combat.kills).toBe(1);
    expect(weapon.fireRate).toBeLessThan(new Rifle().fireRate);
  });

  it('pooled laser slots reset style, damage and velocity when reused for normal shots', () => {
    const pool = new ProjectileManager(collision, 1);
    new Laser().fire(pool, 50, 60, aim, 'player');
    const slot = pool.items[0];
    expect(slot?.style).toBe('laser');
    expect(slot?.damage).toBe(LASER.damage);
    pool.clear();
    new Rifle().fire(pool, 50, 60, { x: 0, y: 1 }, 'player');
    expect(pool.items[0]).toBe(slot);
    expect(slot?.style).toBe('bullet');
    expect(slot?.damage).toBe(1);
    expect(slot?.velocity.x).toBe(0);
  });

  it.each(types)('%s preserves player trajectory when running, jumping and firing', (Type) => {
    const player = new Player(62, 44);
    const reference = new Player(62, 44);
    player.weapon = new Type();
    const pool = new ProjectileManager(collision);
    for (let i = 0; i < 120; i++) {
      const controls = { ...idle, right: true, up: true, shoot: true, jumpPressed: i === 1 };
      player.update(dt, controls, collision, [floor], 1536);
      reference.update(dt, controls, collision, [floor], 1536);
      player.updateCombat(dt, controls, pool);
      pool.update(dt, [floor], 1536);
      expect(player.position).toEqual(reference.position);
      expect(player.velocity).toEqual(reference.velocity);
    }
    expect(pool.playerSpawned).toBeGreaterThan(0);
  });

  it.each(types)('%s keeps shot counts identical at 30, 60 and 144 Hz render', (Type) => {
    const counts: number[] = [];
    for (const hz of [30, 60, 144]) {
      let callback: FrameRequestCallback = () => {};
      vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      const weapon = new Type();
      const pool = new ProjectileManager(collision);
      const loop = new GameLoop((step) => {
        weapon.update(step);
        weapon.fire(pool, 50, 100, aim, 'player');
        pool.update(step, [], 1536);
      }, () => {});
      loop.start();
      for (let i = 0; i <= hz; i++) callback(i * 1000 / hz);
      loop.stop();
      counts.push(pool.playerSpawned);
    }
    expect(counts).toEqual(Type === SpreadGun ? [20, 20, 20] : Type === Laser ? [2, 2, 2] : [12, 12, 12]);
  });
});

describe('weapon pickups', () => {
  it.each([['M', MachineGun], ['S', SpreadGun], ['L', Laser]] as const)(
    '%s requires overlap, equips once, announces briefly and can fire in the collection step', (kind, Type) => {
      const manager = new PowerupManager(collision);
      const pickup = manager.spawn(kind, 100, 48);
      if (pickup) pickup.velocity.x = 0;
      const player = new Player(62, 44);
      const pool = new ProjectileManager(collision);
      manager.update(dt, player, [floor], [], 1536);
      expect(player.weapon).toBeInstanceOf(Rifle);
      player.position.x = 100 - player.width;
      manager.update(dt, player, [floor], [], 1536);
      expect(player.weapon).toBeInstanceOf(Rifle);
      player.position.x++;
      manager.update(dt, player, [floor], [], 1536);
      expect(player.weapon).toBeInstanceOf(Type);
      expect(manager.collectedCount).toBe(1);
      expect(manager.message).toContain(kind);
      expect(manager.items[0]?.active).toBe(false);
      player.updateCombat(dt, { ...idle, shoot: true }, pool);
      expect(pool.playerSpawned).toBe(kind === 'S' ? 5 : 1);
      const equipped = player.weapon;
      manager.update(POWERUPS.noticeTime + dt, player, [floor], [], 1536);
      expect(player.weapon).toBe(equipped);
      expect(manager.collectedCount).toBe(1);
      expect(manager.message).toBe('');
    },
  );

  it('dead players cannot collect; reset clears drops and notification state', () => {
    const manager = new PowerupManager(collision);
    manager.spawn('L', 62, 48);
    const player = new Player(62, 44);
    player.die();
    manager.update(dt, player, [floor], [], 1536);
    expect(manager.collectedCount).toBe(0);
    player.reset(62, 44);
    manager.update(dt, player, [floor], [], 1536);
    expect(player.weapon).toBeInstanceOf(Laser);
    manager.reset();
    player.reset(20, 44);
    expect(manager.items[0]?.active).toBe(false);
    expect(manager.message).toBe('');
    expect(manager.collectedCount).toBe(0);
    expect(player.weapon).toBeInstanceOf(Rifle);
  });

  it('changing weapons leaves already-fired bullets unchanged and allows crouched collection', () => {
    const player = new Player(62, 44);
    player.grounded = true;
    const pool = new ProjectileManager(collision);
    player.updateCombat(dt, { ...idle, shoot: true }, pool);
    const bullet = pool.items.find((item) => item.active);
    const velocity = { ...bullet?.velocity };
    const manager = new PowerupManager(collision);
    manager.spawn('L', 62, 48);
    player.update(dt, { ...idle, down: true }, collision, [floor], 1536);
    manager.update(dt, player, [floor], [], 1536);
    expect(player.weapon).toBeInstanceOf(Laser);
    expect(bullet?.damage).toBe(1);
    expect(bullet?.style).toBe('bullet');
    expect(bullet?.velocity).toEqual(velocity);
    player.updateCombat(dt, { ...idle, down: true, shoot: true }, pool);
    const laser = pool.items.find((item) => item.active && item.style === 'laser');
    expect(laser?.position.y).toBeCloseTo(player.position.y + player.gunPivotY);
  });

  it('campaign starts without pickups and distributes scarce M/S/L carriers among ordinary flyers', () => {
    expect('powerups' in SIGNAL_WORKS).toBe(false);
    const enemies = new EnemyManager();
    for (const group of SIGNAL_WORKS.spawnGroups) for (const placement of group.enemies) enemies.spawn(placement);
    const flyers = enemies.items.filter((enemy) => enemy.kind === 'flying');
    const carriers = flyers.filter((enemy) => enemy.weaponDrop);
    expect(carriers).toHaveLength(6);
    expect(carriers.length).toBeLessThan(flyers.length);
    expect(new Set(carriers.map((enemy) => enemy.weaponDrop))).toEqual(new Set(['M', 'S', 'L']));
    expect(new PowerupManager(collision).activeCount).toBe(0);
  });
});
