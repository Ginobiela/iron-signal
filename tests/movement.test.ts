import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraController } from '../src/camera/CameraController';
import { CollisionSystem, overlaps } from '../src/collision/CollisionSystem';
import type { AABB } from '../src/collision/CollisionSystem';
import { PLAYER, TIMING, VIEW } from '../src/config/constants';
import { GameLoop } from '../src/core/GameLoop';
import { Player } from '../src/entities/Player';
import type { PlayerControls } from '../src/entities/Player';
import { TEST_LEVEL } from '../src/level/testLevel';

const floor = { x: 0, y: 0, width: 1024, height: 44 };
const idle: PlayerControls = { left: false, right: false, jumpPressed: false, up: false, shoot: false, down: false };
const right: PlayerControls = { ...idle, right: true };
const jump: PlayerControls = { ...idle, jumpPressed: true };
const collision = new CollisionSystem();
const dt = TIMING.fixedStep;

function step(player: Player, controls = idle, solids: readonly AABB[] = [floor]): void {
  player.update(dt, controls, collision, solids, 1024);
}

function standing(): Player {
  const player = new Player(62, 44);
  step(player);
  return player;
}

afterEach(() => vi.unstubAllGlobals());

describe('AABB and solid resolution', () => {
  it('requires area overlap, not just touching edges', () => {
    expect(overlaps(floor, { x: 10, y: 43, width: 12, height: 26 })).toBe(true);
    expect(overlaps(floor, { x: 10, y: 44, width: 12, height: 26 })).toBe(false);
    expect(overlaps(floor, { x: 1024, y: 10, width: 12, height: 26 })).toBe(false);
  });

  it('lands without tunneling through thin ground at high speed', () => {
    const player = new Player(20, 100);
    player.velocity.y = -1000;
    collision.move(player, 0.1, [floor], 1024);
    expect(player.position.y).toBe(44);
    expect(player.velocity.y).toBe(0);
    expect(player.grounded).toBe(true);
  });

  it('blocks walls in both directions and zeroes horizontal velocity', () => {
    const wall = { x: 100, y: 44, width: 20, height: 40 };
    const player = new Player(60, 44);
    player.velocity.x = 1000;
    collision.move(player, 0.1, [wall], 1024);
    expect(player.position.x).toBe(100 - player.width);
    expect(player.velocity.x).toBe(0);
    player.position.x = 150;
    player.velocity.x = -1000;
    collision.move(player, 0.1, [wall], 1024);
    expect(player.position.x).toBe(120);
    expect(player.velocity.x).toBe(0);
  });

  it('stops upward motion at a ceiling without grounding the player', () => {
    const player = new Player(20, 44);
    player.velocity.y = 210;
    collision.move(player, 0.1, [{ x: 0, y: 80, width: 100, height: 5 }], 1024);
    expect(player.position.y).toBe(80 - player.height);
    expect(player.velocity.y).toBe(0);
    expect(player.grounded).toBe(false);
  });

  it('chooses the highest crossed surface regardless of collider order', () => {
    const platform = { x: 0, y: 65, width: 100, height: 5 };
    for (const solids of [[floor, platform], [platform, floor]]) {
      const player = new Player(20, 100);
      player.velocity.y = -1000;
      collision.move(player, 0.1, solids, 1024);
      expect(player.position.y).toBe(70);
      expect(player.grounded).toBe(true);
    }
  });
});

describe('arcade movement', () => {
  it('starts and stops instantly; opposite directions cancel', () => {
    const player = standing();
    step(player, right);
    expect(player.velocity.x).toBe(PLAYER.speed);
    expect(player.state).toBe('RUN');
    const x = player.position.x;
    step(player);
    expect(player.position.x).toBe(x);
    expect(player.state).toBe('IDLE');
    step(player, { ...right, left: true });
    expect(player.velocity.x).toBe(0);
    step(player, { ...idle, left: true });
    expect(player.direction).toBe(-1);
  });

  it('jumps, falls and returns to ground without a midair second jump', () => {
    const player = standing();
    step(player, jump);
    expect(player.state).toBe('JUMP');
    expect(player.grounded).toBe(false);
    const speed = player.velocity.y;
    step(player, jump);
    expect(player.velocity.y).toBeLessThan(speed);
    let peak = player.position.y;
    let sawFall = false;
    for (let i = 0; i < 60; i++) {
      step(player);
      peak = Math.max(peak, player.position.y);
      sawFall ||= player.state === 'FALL';
    }
    expect(peak - 44).toBeGreaterThan(30);
    expect(peak - 44).toBeLessThan(40);
    expect(sawFall).toBe(true);
    expect(player.position.y).toBe(44);
    expect(player.state).toBe('IDLE');
  });

  it('allows coyote jumps shortly after walking off an edge', () => {
    const ledge = { ...floor, width: 80 };
    const player = new Player(79, 44);
    step(player, idle, [ledge]);
    step(player, right, [ledge]);
    expect(player.grounded).toBe(false);
    step(player, idle, [ledge]);
    step(player, jump, [ledge]);
    expect(player.state).toBe('JUMP');
  });

  it('expires coyote time and cannot jump again after jumping off the edge', () => {
    const ledge = { ...floor, width: 80 };
    const player = new Player(79, 44);
    step(player, idle, [ledge]);
    step(player, right, [ledge]);
    for (let i = 0; i < 6; i++) step(player, idle, [ledge]);
    step(player, jump, [ledge]);
    expect(player.state).toBe('FALL');
  });

  it('uses a buffered jump on the landing step', () => {
    const player = new Player(20, 48);
    player.velocity.y = -90;
    step(player, jump);
    for (let i = 0; i < 4 && player.state !== 'JUMP'; i++) step(player);
    expect(player.state).toBe('JUMP');
    expect(player.velocity.y).toBe(PLAYER.jumpSpeed);
    expect(player.grounded).toBe(false);
  });

  it('expires an early buffer before landing', () => {
    const player = new Player(20, 110);
    step(player, jump);
    for (let i = 0; i < 90; i++) step(player);
    expect(player.position.y).toBe(44);
    expect(player.state).toBe('IDLE');
  });

  it('stays inside the world boundaries', () => {
    const player = standing();
    player.position.x = 0;
    step(player, { ...idle, left: true });
    expect(player.position.x).toBe(0);
    player.position.x = 1024 - player.width;
    step(player, right);
    expect(player.position.x).toBe(1024 - player.width);
  });

  it.each([30, 60, 144])('moves and jumps identically with a %i Hz renderer', (hz) => {
    let callback: FrameRequestCallback = () => {};
    vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const player = standing();
    let steps = 0;
    let peak = 44;
    const controls = { ...right, jumpPressed: false };
    const loop = new GameLoop((delta) => {
      controls.jumpPressed = steps === 0;
      player.update(delta, controls, collision, [floor], 1024);
      peak = Math.max(peak, player.position.y);
      steps++;
    }, () => {});
    loop.start();
    for (let i = 0; i <= hz * 2; i++) callback(i * 1000 / hz);
    loop.stop();
    expect(steps).toBe(120);
    expect(player.position.x).toBeCloseTo(62 + PLAYER.speed * 2);
    expect(player.position.y).toBe(44);
    expect(peak).toBeCloseTo(79);
  });
});

describe('lateral camera', () => {
  it('has a dead zone and follows immediately, within world limits', () => {
    const camera = new CameraController(1024);
    camera.update(100);
    expect(camera.x).toBe(0);
    camera.update(300);
    expect(300 - camera.x).toBeCloseTo(VIEW.width * 0.4 + 8);
    const x = camera.x;
    camera.update(298);
    expect(camera.x).toBe(x);
    camera.update(1000);
    expect(camera.x).toBe(1024 - VIEW.width);
    camera.update(0);
    expect(camera.x).toBe(0);
  });

  it('permits limited backtracking and handles levels smaller than the viewport', () => {
    const camera = new CameraController(1024);
    camera.update(500);
    const x = camera.x;
    camera.update(490);
    expect(camera.x).toBe(x);
    camera.update(200);
    expect(200 - camera.x).toBe(56);
    const small = new CameraController(100);
    small.update(90);
    expect(small.x).toBe(0);
  });
});

it('can traverse the whole test course and return by jumping at obstacles', () => {
  const player = new Player(TEST_LEVEL.spawn.x, TEST_LEVEL.spawn.y);
  const camera = new CameraController(TEST_LEVEL.width);
  const controls = { ...right };
  for (const direction of [1, -1]) {
    controls.right = direction === 1;
    controls.left = direction === -1;
    for (let i = 0; i < 1400; i++) {
      controls.jumpPressed = player.grounded && player.velocity.x === 0;
      player.update(dt, controls, collision, TEST_LEVEL.solids, TEST_LEVEL.width);
      camera.update(player.position.x + player.width / 2);
      expect(Number.isFinite(player.position.y)).toBe(true);
      expect(player.position.y).toBeGreaterThanOrEqual(44);
    }
    expect(player.position.x).toBe(direction === 1 ? TEST_LEVEL.width - player.width : 0);
    expect(camera.x).toBe(direction === 1 ? TEST_LEVEL.width - VIEW.width : 0);
  }
});
