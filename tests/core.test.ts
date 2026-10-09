import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../src/core/GameLoop';
import { InputManager } from '../src/core/InputManager';
import { getDisplaySize } from '../src/rendering/viewport';

afterEach(() => vi.unstubAllGlobals());

function simulateFrames(hz: number): { updates: number; renders: number; fps: number } {
  let callback: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  let updates = 0;
  let renders = 0;
  const loop = new GameLoop((dt) => { expect(dt).toBe(1 / 60); updates++; }, (alpha) => {
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
    renders++;
  });
  loop.start();
  for (let i = 0; i <= hz; i++) callback(i * 1000 / hz);
  loop.stop();
  return { updates, renders, fps: loop.fps };
}

describe('fixed timestep', () => {
  it.each([30, 60, 144])('simulates the same second on a %i Hz display', (hz) => {
    const result = simulateFrames(hz);
    expect(result.updates).toBe(60);
    expect(result.renders).toBe(hz + 1);
    expect(result.fps).toBeGreaterThanOrEqual(hz - 2);
    expect(result.fps).toBeLessThanOrEqual(hz + 2);
  });

  it('caps stall recovery, starts only once, and discards time while stopped', () => {
    let callback: FrameRequestCallback = () => {};
    const request = vi.fn((next: FrameRequestCallback) => { callback = next; return 1; });
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const update = vi.fn();
    const loop = new GameLoop(update, () => {});
    loop.start();
    loop.start();
    expect(request).toHaveBeenCalledTimes(1);
    callback(0);
    callback(10_000);
    expect(update).toHaveBeenCalledTimes(6);
    loop.stop();
    callback(20_000);
    expect(update).toHaveBeenCalledTimes(6);
    loop.start();
    callback(30_000);
    expect(update).toHaveBeenCalledTimes(6);
    loop.stop();
  });
});

function key(target: EventTarget, type: string, code: string, repeat = false): void {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, repeat });
  target.dispatchEvent(event);
}

describe('keyboard state', () => {
  it('lets volume inputs use arrows while retaining pause and debug shortcuts', () => {
    const target = new EventTarget();
    Object.assign(target, { tagName: 'INPUT' });
    const input = new InputManager(target as Window);
    key(target, 'keydown', 'ArrowRight');
    key(target, 'keydown', 'Space');
    expect(input.isDown('right')).toBe(false);
    expect(input.wasPressed('jump')).toBe(false);
    key(target, 'keydown', 'Escape');
    key(target, 'keydown', 'F1');
    expect(input.wasPressed('pause')).toBe(true);
    expect(input.wasPressed('debug')).toBe(true);
    input.dispose();
  });
  it('supports simultaneous actions, aliases, key edges, and focus loss', () => {
    const target = new EventTarget();
    // The manager only consumes EventTarget APIs; no browser renderer is required.
    const input = new InputManager(target as Window);
    key(target, 'keydown', 'KeyD');
    key(target, 'keydown', 'ArrowRight');
    key(target, 'keydown', 'KeyJ');
    key(target, 'keydown', 'Space');
    expect(input.isDown('right')).toBe(true);
    expect(input.isDown('shoot')).toBe(true);
    expect(input.wasPressed('jump')).toBe(true);
    input.endStep();
    key(target, 'keydown', 'Space', true);
    expect(input.wasPressed('jump')).toBe(false);
    key(target, 'keyup', 'KeyD');
    expect(input.isDown('right')).toBe(true);
    target.dispatchEvent(new Event('blur'));
    expect(input.isDown('right')).toBe(false);
    expect(input.isDown('jump')).toBe(false);
    input.dispose();
    key(target, 'keydown', 'KeyJ');
    expect(input.isDown('shoot')).toBe(false);
  });

  it('preserves a quick press/release between simulation steps', () => {
    const target = new EventTarget();
    const input = new InputManager(target as Window);
    key(target, 'keydown', 'F1');
    key(target, 'keyup', 'F1');
    expect(input.isDown('debug')).toBe(false);
    expect(input.wasPressed('debug')).toBe(true);
    input.endStep();
    expect(input.wasPressed('debug')).toBe(false);
    input.dispose();
  });
});

describe('display scaling', () => {
  it.each([[1920, 1080], [1920, 1200], [1024, 768], [200, 180]])(
    'fits %i×%i without stretching the logical view', (width, height) => {
      const size = getDisplaySize(width, height);
      expect(size.width).toBeLessThanOrEqual(width);
      expect(size.height).toBeLessThanOrEqual(height);
      expect(size.width / size.height).toBeCloseTo(256 / 240);
      if (width >= 512 && height >= 480) expect(size.width % 512).toBe(0);
    },
  );
});
