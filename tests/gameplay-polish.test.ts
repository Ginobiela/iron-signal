import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollisionSystem, segmentHitsAABB } from '../src/collision/CollisionSystem';
import { CombatSystem } from '../src/collision/CombatSystem';
import { PLAYER_COLLISION, POWERUPS, TIMING, WORLD } from '../src/config/constants';
import { Player } from '../src/entities/Player';
import { WeaponPickup } from '../src/entities/WeaponPickup';
import { FlyingEnemy } from '../src/entities/enemies/FlyingEnemy';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { PowerupManager } from '../src/level/PowerupManager';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { MachineGun } from '../src/weapons/MachineGun';
import { SpreadGun } from '../src/weapons/SpreadGun';
import { Laser } from '../src/weapons/Laser';
import { GameLoop } from '../src/core/GameLoop';
import { Level } from '../src/level/Level';
import { gameplayLab } from '../src/level/gameplayLab';
import { PLAYER_ANIMATIONS, PLAYER_VISUAL } from '../src/config/graphics';

const collision = new CollisionSystem();
const dt = TIMING.fixedStep;
const floor = { x: 0, y: 0, width: 768, height: 44 };
const idle = { left: false, right: false, up: false, down: false, shoot: false, jumpPressed: false };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('posture hitboxes', () => {
  it('has separate cached standing/crouching boxes with identical feet and independent visual bounds', () => {
    const player = new Player(62, 44);
    player.update(dt, idle, collision, [floor], 768);
    const standing = player.standingBounds;
    const crouching = player.crouchingBounds;
    expect(crouching.height).toBeLessThan(standing.height * 0.6);
    expect(crouching.y).toBe(standing.y);
    expect(player.collisionBounds).toBe(standing);
    player.update(dt, { ...idle, down: true }, collision, [floor], 768);
    expect(player.position.y).toBe(44);
    expect(player.collisionBounds).toBe(crouching);
    expect(player.invulnerabilityTimer).toBe(0);
    expect(PLAYER_VISUAL.crouchHeight).not.toBe(PLAYER_COLLISION.crouching.height);
    expect(Object.keys(PLAYER_ANIMATIONS)).toEqual(['idle', 'run', 'jump', 'fall', 'crouch', 'shoot', 'runShoot', 'jumpShoot', 'crouchShoot']);
  });

  it('a torso shot intersects standing but clears crouching with the actual bullet radius', () => {
    const player = new Player(62, 44);
    expect(segmentHitsAABB(10, 60, 120, 60, player.standingBounds, 1.5)).toBe(true);
    expect(segmentHitsAABB(10, 60, 120, 60, player.crouchingBounds, 1.5)).toBe(false);
    expect(segmentHitsAABB(10, 52, 120, 52, player.crouchingBounds, 1.5)).toBe(true);
  });

  it.each([[false, 60, true], [true, 60, false], [true, 52, true]] as const)(
    'combat applies crouch=%s at bullet height %i with hit=%s', (crouch, y, hit) => {
      const player = new Player(62, 44);
      player.update(dt, idle, collision, [floor], 768);
      player.update(dt, { ...idle, down: crouch }, collision, [floor], 768);
      const pool = new ProjectileManager(collision);
      const combat = new CombatSystem(collision, player, []);
      pool.spawn(10, y, 6000, 0, 1, 'enemy');
      pool.update(dt, [floor], 768, combat);
      expect(combat.playerHits).toBe(Number(hit));
      expect(player.alive).toBe(!hit);
      expect(player.position.y).toBe(44);
    },
  );

  it('stays crouched under a solid ceiling until clearance exists, then stands without shifting feet', () => {
    const player = new Player(62, 44);
    player.update(dt, idle, collision, [floor], 768);
    player.update(dt, { ...idle, down: true }, collision, [floor], 768);
    const roof = { x: 40, y: 58, width: 70, height: 4 };
    expect(player.canStandUp(collision, [floor, roof])).toBe(false);
    player.update(dt, idle, collision, [floor, roof], 768);
    expect(player.state).toBe('CROUCH');
    expect(player.collisionBounds).toBe(player.crouchingBounds);
    expect(player.position.y).toBe(44);
    player.update(dt, idle, collision, [floor], 768);
    expect(player.state).toBe('IDLE');
    expect(player.collisionBounds).toBe(player.standingBounds);
    expect(player.position.y).toBe(44);
  });

  it.each(['high', 'low'] as const)('lab %s fires real horizontal turret bullets with correct crouch behavior', (mode) => {
    for (const crouch of [false, true]) {
      const level = new Level(gameplayLab(mode));
      const player = new Player(62, 44);
      const enemies = new EnemyManager();
      const placement = level.data.spawnGroups[0]?.enemies[0];
      if (!placement) throw new Error('Missing lab turret');
      const turret = enemies.spawn(placement);
      const pool = new ProjectileManager(collision);
      const combat = new CombatSystem(collision, player, enemies.items);
      const context = { player, projectiles: pool, collision, solids: level.solids, worldWidth: 768 };
      let reachedPlayer = false;
      for (let i = 0; i < 160; i++) {
        player.update(dt, { ...idle, down: crouch }, collision, level.solids, 768);
        turret.update(dt, context);
        pool.update(dt, level.solids, 768, combat);
        reachedPlayer ||= pool.items.some((bullet) => bullet.active && bullet.position.x < player.position.x);
        if (!player.alive) break;
      }
      expect(player.alive).toBe(mode === 'high' && crouch);
      if (player.alive) expect(reachedPlayer).toBe(true);
    }
  });
});

describe('carrier drops', () => {
  it.each(['M', 'S', 'L'] as const)('%s combat death produces one pickup at the exact final position', (kind) => {
    const carrier = new FlyingEnemy(120, 92, kind); carrier.active = true;
    carrier.position.x = 123.25; carrier.position.y = 97.5;
    const manager = new PowerupManager(collision);
    const pool = new ProjectileManager(collision);
    const kills = new CombatSystem(collision, new Player(10, 44), [carrier], (enemy) => {
      if (enemy.kind === 'flying') manager.dropFromEnemy(enemy);
    });
    pool.spawn(100, 100, 6000, 0, 2, 'player');
    pool.spawn(100, 100, 6000, 0, 2, 'player');
    pool.update(dt, [], 768, kills);
    expect(kills.kills).toBe(1);
    expect(manager.spawnedCount).toBe(1);
    expect(manager.activeCount).toBe(1);
    expect(manager.items[0]?.position).toEqual(carrier.position);
    expect(manager.items[0]?.kind).toBe(kind);
    expect(manager.items[0]?.velocity.y).toBeGreaterThan(0);
    manager.dropFromEnemy(carrier);
    expect(manager.spawnedCount).toBe(1);
  });

  it('ordinary flyers and offscreen retirements do not create drops', () => {
    const enemies = new EnemyManager();
    const plain = enemies.spawn({ kind: 'flying', x: 120, y: 92 });
    const carrier = enemies.spawn({ kind: 'flying', x: 160, y: 92, weaponDrop: 'S' });
    const manager = new PowerupManager(collision);
    plain.takeDamage(100);
    expect(manager.dropFromEnemy(plain)).toBe(null);
    const player = new Player(62, 44);
    enemies.update(dt, { player, projectiles: new ProjectileManager(collision), collision, solids: [], worldWidth: 768 }, 700);
    expect(carrier.alive).toBe(false);
    expect(manager.activeCount).toBe(0);
  });

  it.each([['M', MachineGun], ['S', SpreadGun], ['L', Laser]] as const)('%s fall lands and collection equips the correct weapon', (kind, Type) => {
    const manager = new PowerupManager(collision);
    const pickup = manager.spawn(kind, 120, 100);
    if (!pickup) throw new Error('Pool exhausted');
    const player = new Player(10, 44);
    for (let i = 0; i < 90; i++) manager.update(dt, player, [floor], [], 768);
    expect(pickup.grounded).toBe(true);
    expect(pickup.y).toBe(44);
    expect(pickup.velocity).toEqual({ x: 0, y: 0 });
    player.position.x = pickup.x;
    manager.update(dt, player, [floor], [], 768);
    expect(player.weapon).toBeInstanceOf(Type);
    expect(manager.collectedCount).toBe(1);
    expect(pickup.active).toBe(false);
  });

  it.each(['solid', 'one-way'] as const)('lands without vibration on %s platforms and passes below one-way when rising', (kind) => {
    const pickup = new WeaponPickup(); pickup.spawn('S', 100, 80); pickup.velocity.x = 0;
    const platform = { x: 80, y: 100, width: 100, height: 4 };
    const solids = kind === 'solid' ? [floor, platform] : [floor];
    const rails = kind === 'one-way' ? [platform] : [];
    if (kind === 'one-way') pickup.velocity.y = 200;
    else pickup.position.y = 160;
    let roseThrough = false;
    for (let i = 0; i < 150; i++) {
      pickup.update(dt, collision, solids, rails, 768);
      roseThrough ||= pickup.y > 104;
      if (pickup.grounded && pickup.y === 104) {
        for (let j = 0; j < 60; j++) {
          pickup.update(dt, collision, solids, rails, 768);
          expect(pickup.y).toBe(104);
          expect(pickup.grounded).toBe(true);
          expect(pickup.velocity.y).toBe(0);
        }
        break;
      }
    }
    expect(pickup.y).toBe(104);
    if (kind === 'one-way') expect(roseThrough).toBe(true);
  });

  it('expires at the configured lifetime, freezes at dt=0, retires in pits, and reuses slots', () => {
    const manager = new PowerupManager(collision, 1);
    const pickup = manager.spawn('M', 120, 100);
    expect(manager.spawn('L', 200, 100)).toBe(null);
    const player = new Player(10, 44);
    const before = { ...pickup?.position };
    manager.update(0, player, [floor], [], 768);
    expect(pickup?.position).toEqual(before);
    expect(pickup?.lifeRemaining).toBe(POWERUPS.lifetime);
    for (let i = 0; i < 480; i++) manager.update(dt, player, [floor], [], 768);
    expect(pickup?.lifeRemaining).toBeCloseTo(POWERUPS.warningTime);
    for (let i = 0; i < 121; i++) manager.update(dt, player, [floor], [], 768);
    expect(pickup?.active).toBe(false);
    expect(manager.spawn('L', 100, WORLD.killY - 1)).toBe(pickup);
    manager.update(dt, player, [], [], 768);
    expect(pickup?.active).toBe(false);
    manager.reset();
    expect(manager.spawnedCount).toBe(0);
    expect(manager.collectedCount).toBe(0);
    expect(manager.activeCount).toBe(0);
  });

  it('pickup trajectories and lifetime are independent of display refresh rate', () => {
    const results: number[] = [];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    for (const hz of [30, 60, 144]) {
      let callback: FrameRequestCallback = () => {};
      vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      const pickup = new WeaponPickup(); pickup.spawn('M', 120, 100);
      const loop = new GameLoop((step) => pickup.update(step, collision, [floor], [], 768), () => {});
      loop.start();
      for (let i = 0; i <= hz; i++) callback(i * 1000 / hz);
      loop.stop();
      expect(pickup.grounded).toBe(true);
      expect(pickup.lifeRemaining).toBeCloseTo(9);
      results.push(pickup.y);
    }
    expect(results).toEqual([44, 44, 44]);
  });
});
