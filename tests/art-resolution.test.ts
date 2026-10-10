import { afterEach, describe, expect, it, vi } from 'vitest';
import { NearestFilter, Texture, TextureLoader } from 'three';
import { ASSETS } from '../src/config/assets';
import type { SpriteAsset } from '../src/config/assets';
import { ART_SCALE, RENDER_VIEW } from '../src/config/art';
import { VIEW } from '../src/config/constants';
import { AssetManager } from '../src/core/AssetManager';
import { SpriteVisual } from '../src/rendering/SpriteVisual';
import { TiledVisual } from '../src/rendering/TiledVisual';
import { assetAnchors, assetArtScale, withArtScale } from '../src/rendering/artDimensions';
import { FxSpritePool } from '../src/rendering/FxSpritePool';
import { getDisplaySize } from '../src/rendering/viewport';
import { PLAYER_MUZZLES } from '../src/config/vfx';

afterEach(() => vi.restoreAllMocks());
const legacyIdle = withArtScale(ASSETS['player.idle']!, 1);

async function load(manifest: Record<string, SpriteAsset>): Promise<AssetManager> {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async url => {
    const asset = Object.values(manifest).find(item => item.url === url)!;
    return new Texture({ width: asset.sheet.frameWidth * asset.sheet.frameCount, height: asset.sheet.frameHeight } as HTMLImageElement);
  });
  const assets = new AssetManager(manifest); await assets.preload(); return assets;
}

describe('mixed 1×/2× art, same world', () => {
  it('matches all delivered Soldier strips to 64px frames without changing world metrics', async () => {
    const { readFileSync } = await vi.importActual<{ readFileSync(url: URL): Uint8Array }>('node:fs');
    for (const [clip, frames, fps] of [['idle', 4, 6], ['run', 6, 10], ['shoot', 2, 12], ['death', 6, 10]] as const) {
      const asset = ASSETS[`soldier.${clip}`]!;
      const png = readFileSync(new URL(`../public/${asset.path}`, import.meta.url));
      const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
      expect([header.getUint32(16), header.getUint32(20)]).toEqual([frames * 64, 64]);
      expect(asset.sheet).toMatchObject({ frameWidth: 64, frameHeight: 64, frameCount: frames });
      expect(asset.visual).toMatchObject({ width: 32, height: 32, anchor: 'bottom-center', offsetX: 0, offsetY: 0 });
      expect(asset.artScale).toBe(2);
      expect(asset.clip).toMatchObject({ frameRate: fps, loop: clip !== 'death' });
      expect(asset.url).toBe(asset.path);
    }
  });
  it('matches the delivered Runner strips to six 48px frames at the original world size', async () => {
    const { readFileSync } = await vi.importActual<{ readFileSync(url: URL): Uint8Array }>('node:fs');
    for (const [id, fps, loop] of [['runner.run', 12, true], ['runner.death', 10, false]] as const) {
      const asset = ASSETS[id]!;
      const png = readFileSync(new URL(`../public/${asset.path}`, import.meta.url));
      const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
      expect([header.getUint32(16), header.getUint32(20)]).toEqual([288, 48]);
      expect(asset.sheet).toMatchObject({ frameWidth: 48, frameHeight: 48, frameCount: 6 });
      expect(asset.visual).toMatchObject({ width: 24, height: 24, anchor: 'bottom-center', offsetX: 0, offsetY: 0 });
      expect(asset.artScale).toBe(2); expect(asset.clip).toMatchObject({ frameRate: fps, loop });
      expect(asset.url).toBe(asset.path);
    }
  });
  it('renders 512×480 pixels but retains 256×240 world units and compatible asset densities', () => {
    expect(ART_SCALE).toBe(2); expect(RENDER_VIEW).toEqual({ width: 512, height: 480 });
    expect(VIEW).toEqual({ width: 256, height: 240 });
    for (const asset of Object.values(ASSETS)) {
      expect([1, 2]).toContain(assetArtScale(asset));
      expect(asset.sheet.frameWidth).toBe(asset.visual.width * assetArtScale(asset));
      expect(asset.sheet.frameHeight).toBe(asset.visual.height * assetArtScale(asset));
    }
    expect(getDisplaySize(1100, 1000)).toEqual({ width: 1024, height: 960 });
    expect(getDisplaySize(400, 400)).toEqual({ width: 400, height: 375 });
  });
  it('converts only source frames/padding/atlas; preserves visual, anchor, offsets and playback', () => {
    const old = { ...legacyIdle, sheet: { ...legacyIdle.sheet, margin: 1, spacing: 2,
      atlas: [{ x: 1, y: 3, width: 32, height: 32 }] } };
    const next = withArtScale(old, 2);
    expect(next.sheet.frameWidth).toBe(64); expect(next.sheet.frameHeight).toBe(64);
    expect(next.visual).toBe(old.visual); expect(next.clip).toBe(old.clip);
    expect(next.sheet.margin).toBe(2); expect(next.sheet.spacing).toBe(4);
    expect(next.sheet.atlas).toEqual([{ x: 2, y: 6, width: 64, height: 64 }]);
    expect(old.sheet.frameWidth).toBe(32); expect(withArtScale(next, 2).sheet.frameWidth).toBe(64);
    expect(withArtScale(next, 1).sheet).toEqual(old.sheet);
    expect(assetAnchors(old)).toEqual({ source: { x: 16, y: 32 }, world: { x: 0, y: 0 } });
    expect(assetAnchors(next)).toEqual({ source: { x: 32, y: 64 }, world: { x: 0, y: 0 } });
    const flying = withArtScale(ASSETS['flying.fly']!, 2);
    expect(assetAnchors(flying)).toEqual({ source: { x: 32, y: 24 }, world: { x: 0, y: 0 } });
  });
  it('mixes Player 2× and Soldier 1× without moving the feet/origin; flip affects only visual scale', async () => {
    const old = legacyIdle, next = withArtScale({ ...old, url: 'test-2x' }, 2);
    const assets = await load({ old, next, soldier: ASSETS['soldier.run']! });
    const sprites = [old, next, ASSETS['soldier.run']!].map(asset => new SpriteVisual(assets, asset.visual));
    for (const [index, id] of ['old', 'next', 'soldier'].entries()) {
      const sprite = sprites[index]!; sprite.root.position.set(62, 44, 3); sprite.update(id, 0);
      expect(sprite.mesh.scale.x).toBe(32); expect(sprite.mesh.scale.y).toBe(32);
      expect(sprite.mesh.position.y).toBe(16); expect(sprite.root.position.toArray()).toEqual([62, 44, 3]);
      sprite.update(id, 0, true); expect(sprite.mesh.scale.x).toBe(-32);
      expect(sprite.mesh.position.y).toBe(16); expect(sprite.root.position.toArray()).toEqual([62, 44, 3]);
      expect(assets.getTexture(id)?.magFilter).toBe(NearestFilter); sprite.dispose();
    }
    expect(PLAYER_MUZZLES.standing.horizontal).toEqual({ x: 9, y: 13 });
    assets.dispose();
  });
  it('32 source pixels repeat every 16 world units without changing tile geometry or UV frequency', async () => {
    const old = ASSETS['environment.ground.fill']!;
    const assets = await load({ old, next: withArtScale({ ...old, url: 'test-tile-2x' }, 2) });
    const tiles = ['old', 'next'].map(id => {
      const tile = new TiledVisual(assets, id); tile.add(100, 0, 48, 32, 1.2); tile.update(); return tile;
    });
    const first = tiles[0]!.root.children[0]!, second = tiles[1]!.root.children[0]!;
    expect(first.position.toArray()).toEqual(second.position.toArray());
    const meshes = tiles.map(tile => tile.root.children[0] as import('three').Mesh<import('three').PlaneGeometry>);
    expect(meshes[0]!.geometry.parameters).toEqual(meshes[1]!.geometry.parameters);
    expect([...meshes[0]!.geometry.getAttribute('uv').array]).toEqual([...meshes[1]!.geometry.getAttribute('uv').array]);
    expect(meshes[1]!.geometry.getAttribute('uv').getX(1)).toBe(3);
    for (const tile of tiles) tile.dispose(); assets.dispose();
  });
  it('VFX 32 source pixels keep a 16-unit explosion and its existing lifecycle', async () => {
    const id = 'fx.explosion.small', next = withArtScale(ASSETS[id]!, 2);
    expect(next.sheet.frameWidth).toBe(32); expect(next.visual.width).toBe(16);
    const assets = await load({ [id]: next });
    const pool = new FxSpritePool(assets, undefined, undefined, 1);
    expect(pool.spawn(id, 80, 44)).toBe(true);
    const slot = pool.root.children[0]!, spriteRoot = slot.children[0]!;
    expect(spriteRoot.children[0]!.scale.toArray()).toEqual([16, 16, 1]);
    expect(slot.position.x).toBe(80); expect(slot.position.y).toBe(44);
    pool.update(0.19); expect(pool.activeCount).toBe(1);
    pool.update(0.02); expect(pool.activeCount).toBe(0); pool.dispose(); assets.dispose();
  });
  it('background source can double while coverage and texture reuse remain unchanged', async () => {
    const asset = withArtScale({ ...ASSETS['background.far']!, url: 'test-bg-2x', tileable: true }, 2);
    expect(asset.sheet.frameWidth).toBe(512); expect(asset.sheet.frameHeight).toBe(480);
    const assets = await load({ far: asset, shared: asset });
    expect(assets.getTexture('far')).toBe(assets.getTexture('shared'));
    const tile = new TiledVisual(assets, 'far'); tile.add(0, 0, 512, 240, -6); tile.update();
    const mesh = tile.root.children[0] as import('three').Mesh<import('three').PlaneGeometry>;
    expect(mesh.geometry.getAttribute('uv').getX(1)).toBe(2);
    expect(mesh.geometry.getAttribute('uv').getY(0)).toBe(1); tile.dispose(); assets.dispose();
  });
});
