import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticleManager } from '../src/rendering/ParticleManager';
import { ScreenShakeManager } from '../src/camera/ScreenShakeManager';
import { SpriteAnimator } from '../src/rendering/SpriteAnimator';
import { AudioManager } from '../src/core/AudioManager';
import { AssetManager } from '../src/core/AssetManager';
import { AUDIO, FEEDBACK } from '../src/config/constants';
import { CombatSystem } from '../src/collision/CombatSystem';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { Player } from '../src/entities/Player';
import { Soldier } from '../src/entities/enemies/Soldier';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('pooled feedback', () => {
  it('caps bursts, retains identities, expires and reuses every particle', () => {
    const particles = new ParticleManager(8);
    const identities = [...particles.items];
    particles.burst(10, 20, 50, 0xff0000, true);
    expect(particles.activeCount).toBe(8);
    particles.burst(90, 90, 5, 0xffffff);
    expect(particles.items.every((particle) => particle.x === 10)).toBe(true);
    particles.update(1);
    expect(particles.activeCount).toBe(0);
    particles.burst(20, 40, 3, 0x00ffff);
    expect(particles.items).toEqual(identities);
    expect(particles.activeCount).toBe(3);
    particles.clear();
    expect(particles.activeCount).toBe(0);
  });

  it('freezes particles and shake with a zero timestep and returns shake to zero', () => {
    const particles = new ParticleManager(1);
    particles.burst(10, 20, 1, 0xffffff);
    const before = { ...particles.items[0] };
    particles.update(0);
    expect(particles.items[0]).toEqual(before);
    const shake = new ScreenShakeManager();
    shake.trigger(100, 0.3);
    for (let i = 0; i < 5; i++) {
      shake.update(1 / 60);
      expect(Math.abs(shake.offset.x)).toBeLessThanOrEqual(FEEDBACK.shakeLimit);
      expect(Math.abs(shake.offset.y)).toBeLessThanOrEqual(FEEDBACK.shakeLimit);
    }
    const offset = { ...shake.offset };
    shake.update(0);
    expect(shake.offset).toEqual(offset);
    shake.update(1);
    expect(shake.offset).toEqual({ x: 0, y: 0 });
    shake.trigger(2); shake.clear(); shake.update(0.01);
    expect(shake.offset).toEqual({ x: 0, y: 0 });
  });

  it('produces the same animation frame at different update rates, loops and resets on state changes', () => {
    for (const hz of [30, 60, 144]) {
      const animator = new SpriteAnimator({ run: { frames: [0, 1, 2, 1], frameTime: 0.08 },
        jump: { frames: [4, 5], frameTime: 0.1, loop: false } });
      animator.update('run', 0);
      for (let i = 0; i < hz; i++) animator.update('run', 1 / hz);
      expect(animator.frame).toBe(0);
      expect(animator.update('jump', 0)).toBe(4);
      expect(animator.update('jump', 1)).toBe(5);
      expect(animator.update('run', 0)).toBe(0);
      expect(animator.update('run', 0)).toBe(0);
    }
  });

  it('reports the swept impact point and damage exactly once, including scenery', () => {
    const collision = new CollisionSystem();
    const soldier = new Soldier(40, 0); soldier.active = true;
    const impact = vi.fn();
    const combat = new CombatSystem(collision, new Player(0, 0), [soldier], undefined, undefined, impact);
    const pool = new ProjectileManager(collision, 1);
    pool.spawn(10, 10, 100, 0, 1, 'player');
    pool.update(0.5, [], 256, combat);
    expect(impact).toHaveBeenCalledWith(soldier, 38.5, 10, true);
    pool.update(0.5, [], 256, combat);
    expect(impact).toHaveBeenCalledTimes(1);
    pool.spawn(10, 10, 100, 0, 1, 'player');
    pool.update(0.5, [{ x: 20, y: 0, width: 2, height: 20 }], 256, combat);
    expect(impact).toHaveBeenLastCalledWith(null, 18.5, 10, false);
  });
});

function fakeOscillator() {
  return { type: '', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null };
}

class FakeContext {
  static latest: FakeContext;
  state = 'suspended';
  currentTime = 0;
  destination = {};
  readonly oscillators: ReturnType<typeof fakeOscillator>[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  constructor() { FakeContext.latest = this; }
  createGain() {
    return { gain: { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  }
  createOscillator() {
    const oscillator = fakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

function audioEnvironment(saved = '0.6'): EventTarget {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => saved), setItem: vi.fn() });
  vi.stubGlobal('AudioContext', FakeContext);
  return target;
}

describe('audio lifecycle', () => {
  it('unlocks after interaction, caps voices, disconnects ended nodes and silences on dispose', () => {
    const target = audioEnvironment();
    const audio = new AudioManager();
    expect(audio.volume).toBe(0.6);
    audio.play('shoot');
    target.dispatchEvent(new Event('keydown'));
    const context = FakeContext.latest;
    expect(context.resume).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 30; i++) { context.currentTime += 0.1; audio.play('shoot'); }
    expect(context.oscillators).toHaveLength(AUDIO.maxVoices);
    const first = context.oscillators[0];
    first?.onended?.();
    expect(first?.disconnect).toHaveBeenCalled();
    context.currentTime += 0.1; audio.play('shoot');
    expect(context.oscillators).toHaveLength(AUDIO.maxVoices + 1);
    audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.oscillators.at(-1)?.stop).toHaveBeenCalledTimes(2);
    target.dispatchEvent(new Event('keydown'));
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('persists clamped volume and throttles repeated hits, with mute producing no nodes', () => {
    audioEnvironment('garbage');
    const audio = new AudioManager(); audio.unlock();
    expect(audio.volume).toBe(AUDIO.defaultVolume);
    const context = FakeContext.latest;
    audio.play('enemyHit'); audio.play('enemyHit');
    expect(context.oscillators).toHaveLength(1);
    audio.setVolume(-1); audio.play('jump');
    expect(audio.volume).toBe(0);
    expect(context.oscillators).toHaveLength(1);
    audio.setVolume(10); expect(audio.volume).toBe(1);
    expect(localStorage.setItem).toHaveBeenLastCalledWith('iron-signal.audioVolume', '1');
    audio.setVolume(NaN); expect(audio.volume).toBe(1);
    audio.dispose();
  });

  it('survives unsupported audio and denied storage', () => {
    audioEnvironment();
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('unavailable'); } });
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    const audio = new AudioManager();
    expect(() => { audio.unlock(); audio.play('shoot'); audio.setVolume(0.2); audio.dispose(); }).not.toThrow();
  });
});

it('caches audio assets, retries failed loads and clears caches on disposal', async () => {
  const buffer = {} as AudioBuffer;
  const context = { decodeAudioData: vi.fn(async () => buffer) } as unknown as AudioContext;
  const fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
  vi.stubGlobal('fetch', fetcher);
  const assets = new AssetManager();
  expect(assets.sound('/test.wav', context)).toBe(assets.sound('/test.wav', context));
  expect(await assets.sound('/test.wav', context)).toBe(buffer);
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockRejectedValueOnce(new Error('offline'));
  await expect(assets.sound('/retry.wav', context)).rejects.toThrow('offline');
  expect(await assets.sound('/retry.wav', context)).toBe(buffer);
  assets.dispose();
  await assets.sound('/test.wav', context);
  expect(fetcher).toHaveBeenCalledTimes(4);
});
