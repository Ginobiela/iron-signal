import { describe, expect, it } from 'vitest';
import { ASSETS } from '../src/config/assets';
import type { SpriteAsset } from '../src/config/assets';
import { assetStatus, discoverAnimations, ViewerPlayback } from '../src/devtools/animationViewerRegistry';

const run = ASSETS['player.run']!;
describe('animation viewer registry', () => {
  it('discovers all character clips, including planned ones, without loading gameplay', () => {
    const entities = discoverAnimations();
    expect(entities.map(entity => entity.id)).toEqual(['player', 'soldier', 'runner', 'turret', 'flying', 'boss']);
    expect(entities.find(entity => entity.id === 'player')?.animations.find(animation => animation.id === 'player.run')?.asset).toBe(run);
    expect(entities.find(entity => entity.id === 'player')?.animations.some(animation => animation.id === 'player.shoot')).toBe(true);
    expect(entities.some(entity => entity.id === 'fx' || entity.id === 'environment')).toBe(false);
  });
  it('automatically includes new characters and respects sparse atlas frame metadata', () => {
    const atlas: SpriteAsset = { ...run, path: 'assets/sprites/enemies/scout/scout_run.png',
      sheet: { ...run.sheet, atlas: [{ x: 8, y: 4, width: 12, height: 16 }] }, clip: { frames: [0], frameRate: 9 } };
    const entities = discoverAnimations({ 'scout.run': atlas });
    expect(entities[0]?.id).toBe('scout'); expect(entities[0]?.animations[0]?.asset).toBe(atlas);
  });
  it('distinguishes real textures, planned fallbacks and failed loads', () => {
    expect(assetStatus(run, true)).toBe('LOADED'); expect(assetStatus(run, false)).toBe('MISSING');
    expect(assetStatus(ASSETS['player.shoot']!, false)).toBe('FALLBACK');
  });
});

describe('viewer-only playback', () => {
  it('steps both directions with wrapping and pauses without mutating the asset', () => {
    const player = new ViewerPlayback(run);
    player.seek(-1); expect(player.index).toBe(5); expect(player.playing).toBe(false);
    player.seek(6); expect(player.index).toBe(0);
    player.tick(1); expect(player.index).toBe(0);
    expect(run.clip.frameRate).toBe(11);
  });
  it('uses registered FPS, supports override/reset, preserves partial frame time', () => {
    const player = new ViewerPlayback(run);
    player.tick(0.1); expect(player.index).toBe(1);
    player.overrideFps(20); player.tick(0.05); expect(player.index).toBe(2);
    expect(run.clip.frameRate).toBe(11); player.resetFps(); expect(player.fps).toBe(11);
    player.overrideFps(100); expect(player.fps).toBe(30); player.overrideFps(0); expect(player.fps).toBe(1);
  });
  it('ends a non-loop clip at its last frame and restarts on play; switching resets overrides', () => {
    const player = new ViewerPlayback(ASSETS['player.death']!);
    player.tick(1); expect(player.index).toBe(5); expect(player.playing).toBe(false);
    player.toggle(); expect(player.index).toBe(0); expect(player.playing).toBe(true);
    player.overrideFps(30); player.select(run);
    expect(player.index).toBe(0); expect(player.fps).toBe(11); expect(player.playing).toBe(true);
  });
  it('handles frameTime clips and empty definitions without NaN', () => {
    const player = new ViewerPlayback({ ...run, clip: { frames: [4, 7], frameTime: 0.5 } });
    expect(player.originalFps).toBe(2); player.tick(0.5); expect(player.index).toBe(1);
    player.select({ ...run, clip: { frames: [] } }); player.seek(2); player.tick(1); expect(player.index).toBe(0);
  });
});
