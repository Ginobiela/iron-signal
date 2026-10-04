import { describe, expect, it } from 'vitest';
import { CollisionSystem, overlaps } from '../src/collision/CollisionSystem';
import { PLAYER, TIMING, VIEW, WORLD } from '../src/config/constants';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { Player } from '../src/entities/Player';
import { EnemySpawner } from '../src/level/EnemySpawner';
import { Level } from '../src/level/Level';
import { SIGNAL_WORKS } from '../src/level/signalWorks';
import { parallaxPosition } from '../src/rendering/ParallaxBackground';

const dt = TIMING.fixedStep;
const collision = new CollisionSystem();
const floor = { x: 0, y: 0, width: 1024, height: 44 };
const rail = { x: 0, y: 68, width: 100, height: 6 };
const idle = { left: false, right: false, up: false, shoot: false, jumpPressed: false, down: false };

describe('one-way platforms', () => {
  it('passes from below, then lands on top without clipping', () => {
    const player = new Player(20, 44);
    player.update(dt, idle, collision, [floor], 1024, [rail]);
    player.update(dt, { ...idle, jumpPressed: true }, collision, [floor], 1024, [rail]);
    let passedAbove = false;
    for (let i = 0; i < 60; i++) {
      player.update(dt, idle, collision, [floor], 1024, [rail]);
      passedAbove ||= player.position.y > rail.y + rail.height;
    }
    expect(passedAbove).toBe(true);
    expect(player.position.y).toBe(74);
    expect(player.grounded).toBe(true);
    expect(player.onOneWay).toBe(true);
  });

  it('does not block movement through either side or through the underside', () => {
    const player = new Player(110, 60);
    player.velocity.x = -200;
    collision.move(player, 0.1, [floor], 1024, [rail]);
    expect(player.position.x).toBe(90);
    player.velocity.y = 200;
    collision.move(player, 0.1, [floor], 1024, [rail]);
    expect(player.position.y).toBe(80);
    expect(player.velocity.y).toBe(200);
  });

  it('does not teleport a descending player onto a platform already above their feet', () => {
    const player = new Player(20, 70);
    player.velocity.y = -30;
    collision.move(player, dt, [floor], 1024, [rail]);
    expect(player.position.y).toBeLessThan(70);
    expect(player.grounded).toBe(false);
  });

  it('drops through the support platform with Down + Space and lands on a lower one', () => {
    const lower = { x: 0, y: 48, width: 100, height: 6 };
    const player = new Player(20, 74);
    player.update(dt, idle, collision, [floor], 1024, [rail, lower]);
    player.update(dt, { ...idle, down: true, jumpPressed: true }, collision, [floor], 1024, [rail, lower]);
    expect(player.velocity.y).toBeLessThan(0);
    expect(player.onOneWay).toBe(false);
    for (let i = 0; i < 30; i++) player.update(dt, idle, collision, [floor], 1024, [rail, lower]);
    expect(player.position.y).toBe(54);
    expect(player.onOneWay).toBe(true);
  });

  it('can jump back through the same platform after dropping', () => {
    const player = new Player(20, 74);
    player.update(dt, idle, collision, [floor], 1024, [rail]);
    player.update(dt, { ...idle, down: true, jumpPressed: true }, collision, [floor], 1024, [rail]);
    for (let i = 0; i < 30; i++) player.update(dt, idle, collision, [floor], 1024, [rail]);
    expect(player.position.y).toBe(44);
    player.update(dt, { ...idle, jumpPressed: true }, collision, [floor], 1024, [rail]);
    for (let i = 0; i < 60; i++) player.update(dt, idle, collision, [floor], 1024, [rail]);
    expect(player.position.y).toBe(74);
    expect(player.onOneWay).toBe(true);
  });

  it('keeps a solid platform solid during a drop request', () => {
    const player = new Player(20, 74);
    player.update(dt, idle, collision, [floor, rail], 1024);
    player.update(dt, { ...idle, down: true, jumpPressed: true }, collision, [floor, rail], 1024);
    for (let i = 0; i < 30; i++) player.update(dt, { ...idle, down: true }, collision, [floor, rail], 1024);
    expect(player.position.y).toBe(74);
    expect(player.onOneWay).toBe(false);
    expect(player.grounded).toBe(true);
  });

  it('chooses the highest crossed platform regardless of collider order', () => {
    const lower = { ...rail, y: 48 };
    for (const platforms of [[rail, lower], [lower, rail]]) {
      const player = new Player(20, 110);
      player.velocity.y = -1000;
      const support = collision.move(player, 0.1, [floor], 1024, platforms);
      expect(player.position.y).toBe(74);
      expect(support).toBe(rail);
    }
  });
});

describe('crouch and hazards', () => {
  it('crouches without moving the feet and uses a lower gun pivot; release restores height', () => {
    const player = new Player(20, 44);
    player.update(dt, idle, collision, [floor], 1024);
    player.update(dt, { ...idle, down: true, right: true }, collision, [floor], 1024);
    expect(player.state).toBe('CROUCH');
    expect(player.height).toBe(PLAYER.crouchHeight);
    expect(player.position).toEqual({ x: 20, y: 44 });
    expect(player.gunPivotY).toBeLessThan(PLAYER.gunPivotY);
    player.update(dt, idle, collision, [floor], 1024);
    expect(player.height).toBe(PLAYER.height);
  });

  it('does not stand into a solid ceiling', () => {
    const player = new Player(20, 44);
    player.height = PLAYER.crouchHeight;
    player.grounded = true;
    player.update(dt, idle, collision, [floor, { x: 0, y: 62, width: 100, height: 4 }], 1024);
    expect(player.height).toBe(PLAYER.crouchHeight);
  });

  it('a pit kills regardless of invulnerability; restart restores the player', () => {
    const player = new Player(20, WORLD.killY + 1);
    player.invulnerabilityTimer = 10;
    player.velocity.y = -100;
    player.update(dt, idle, collision, [], 1024);
    expect(player.state).toBe('DEAD');
    expect(player.health).toBe(0);
    player.reset(62, 44);
    player.update(dt, idle, collision, [floor], 1024);
    expect(player.alive).toBe(true);
    expect(player.position.y).toBe(44);
  });
});

describe('spawn triggers', () => {
  it('creates no enemies until crossing a trigger, runs each group once, and supports restart', () => {
    const enemies = new EnemyManager();
    const spawner = new EnemySpawner([
      { x: 100, enemies: [{ kind: 'soldier', x: 300, y: 44 }] },
      { x: 200, enemies: [{ kind: 'runner', x: 400, y: 44 }, { kind: 'turret', x: 450, y: 44 }] },
    ], (placement) => { enemies.spawn(placement); });
    expect(enemies.items.length).toBe(0);
    expect(spawner.pendingEnemies).toBe(3);
    spawner.update(99);
    expect(enemies.items.length).toBe(0);
    spawner.update(100);
    expect(enemies.items.length).toBe(1);
    expect(spawner.pendingEnemies).toBe(2);
    spawner.update(0);
    spawner.update(150);
    expect(enemies.items.length).toBe(1);
    spawner.update(1000);
    expect(enemies.items.length).toBe(3);
    expect(spawner.triggeredCount).toBe(2);
    expect(spawner.pendingEnemies).toBe(0);
    const first = enemies.items[0];
    first?.takeDamage(100);
    spawner.update(0);
    spawner.update(1000);
    expect(enemies.items.length).toBe(3);
    enemies.clear();
    spawner.reset();
    expect(spawner.pendingEnemies).toBe(3);
    spawner.update(100);
    expect(enemies.items.length).toBe(1);
    expect(enemies.items[0]).not.toBe(first);
  });

  it('handles simultaneous triggers and camera jumps without skipping groups', () => {
    const spawned: string[] = [];
    const spawner = new EnemySpawner([
      { x: 200, enemies: [{ kind: 'runner', x: 420, y: 44 }] },
      { x: 100, enemies: [{ kind: 'soldier', x: 300, y: 44 }] },
      { x: 100, enemies: [{ kind: 'turret', x: 350, y: 44 }] },
    ], (placement) => { spawned.push(placement.kind); });
    spawner.update(200);
    expect(spawned).toEqual(['runner', 'soldier', 'turret']);
    expect(spawner.triggeredCount).toBe(3);
    spawner.update(300);
    expect(spawned.length).toBe(3);
  });
});

describe('level data and parallax', () => {
  const level = new Level(SIGNAL_WORKS);

  it('separates projectile-blocking solids from one-way grates and locates sectors', () => {
    expect(level.oneWays.length).toBeGreaterThan(0);
    expect(level.solids.length).toBeGreaterThan(SIGNAL_WORKS.ground.length);
    expect(level.solids.some((solid) => level.oneWays.includes(solid as typeof level.oneWays[number]))).toBe(false);
    expect(level.sectionAt(0)).toBe('Estación Umbral');
    expect(level.sectionAt(2400)).toBe('Canal Frío');
    expect(level.sectionAt(9600)).toBe('Acceso al Núcleo');
  });

  it('all triggers can be reached before the camera limit, and no ground enemy spawns inside terrain', () => {
    const manager = new EnemyManager();
    const spawner = new EnemySpawner(SIGNAL_WORKS.spawnGroups, (placement) => {
      const enemy = manager.spawn(placement);
      if (enemy.kind === 'flying') return;
      expect(level.solids.some((solid) => overlaps(solid, {
        x: enemy.position.x, y: enemy.position.y, width: enemy.width, height: enemy.height,
      }))).toBe(false);
      expect(SIGNAL_WORKS.ground.some((ground) => enemy.position.y === ground.height
        && enemy.position.x >= ground.x && enemy.position.x + enemy.width <= ground.x + ground.width)).toBe(true);
    });
    spawner.update(SIGNAL_WORKS.width - VIEW.width);
    expect(spawner.pendingEnemies).toBe(0);
    expect(manager.items.length).toBe(spawner.totalEnemies);
  });

  it('has visible, jumpable pits and a reachable exit on solid ground', () => {
    const grounds = SIGNAL_WORKS.ground;
    for (let i = 1; i < grounds.length; i++) {
      const left = grounds[i - 1];
      const right = grounds[i];
      if (!left || !right) continue;
      const gap = right.x - left.x - left.width;
      expect(gap).toBeGreaterThanOrEqual(40);
      expect(gap).toBeLessThanOrEqual(44);
    }
    const player = new Player(SIGNAL_WORKS.exitX, 44);
    player.update(dt, idle, collision, level.solids, SIGNAL_WORKS.width, level.oneWays);
    expect(level.reachedExit(player)).toBe(true);
    player.die();
    expect(level.reachedExit(player)).toBe(false);
  });

  it('moves three layers at independent speeds with bounded pixel offsets across wrapping', () => {
    expect(parallaxPosition(100, 0.15) - 100).toBe(-15);
    expect(parallaxPosition(100, 0.40) - 100).toBe(-40);
    expect(parallaxPosition(100, 0.75) - 100).toBe(-75);
    for (const speed of [0.15, 0.4, 0.75]) {
      for (const cameraX of [0, 500, 1500, 4096, 9344]) {
        const position = parallaxPosition(cameraX, speed);
        expect(Number.isInteger(position)).toBe(true);
        expect(position - cameraX).toBeLessThanOrEqual(0);
        expect(position - cameraX).toBeGreaterThanOrEqual(-512);
      }
    }
  });

  it('the whole route is traversable in both directions using ordinary jumps', () => {
    const player = new Player(SIGNAL_WORKS.spawn.x, SIGNAL_WORKS.spawn.y);
    const controls = { ...idle };
    let jumps = 0;
    for (const direction of [1, -1]) {
      controls.right = direction === 1;
      controls.left = direction === -1;
      for (let i = 0; i < 9000; i++) {
        const ground = SIGNAL_WORKS.ground.find((item) => player.position.x < item.x + item.width
          && player.position.x + player.width > item.x);
        const nearEdge = ground ? (direction === 1
          ? ground.x + ground.width - player.position.x - player.width < 7
          : player.position.x - ground.x < 7) : false;
        controls.jumpPressed = player.grounded && (player.velocity.x === 0 || nearEdge);
        if (controls.jumpPressed) jumps++;
        player.update(dt, controls, collision, level.solids, SIGNAL_WORKS.width, level.oneWays);
        expect(player.alive).toBe(true);
        if (direction === 1 && player.position.x === SIGNAL_WORKS.width - player.width) break;
        if (direction === -1 && player.position.x === 0) break;
      }
      expect(player.position.x).toBe(direction === 1 ? SIGNAL_WORKS.width - player.width : 0);
    }
    expect(jumps).toBeGreaterThan(24);
  });
});
