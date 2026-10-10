import { afterEach, expect, it, vi } from 'vitest';
import { Mesh, RepeatWrapping, Scene, Texture, TextureLoader } from 'three';
import { AssetManager } from '../src/core/AssetManager';
import { ASSETS, DRAW } from '../src/config/assets';
import { ENVIRONMENT_ASSETS, tileVariant } from '../src/config/environment';
import type { EnvironmentAsset } from '../src/config/environment';
import { groundPieces, platformPieces } from '../src/rendering/environmentPieces';
import { TiledVisual } from '../src/rendering/TiledVisual';
import { EnvironmentView } from '../src/rendering/EnvironmentView';
import { LevelView } from '../src/rendering/LevelView';
import { ParallaxBackground } from '../src/rendering/ParallaxBackground';
import { Level } from '../src/level/Level';
import { SIGNAL_WORKS } from '../src/level/signalWorks';
import { overlaps } from '../src/collision/CollisionSystem';
import { environmentLayout } from '../src/rendering/environmentLayout';
import { CheckpointView } from '../src/rendering/CheckpointView';
import { CheckpointManager } from '../src/level/Checkpoint';

afterEach(() => vi.restoreAllMocks());

it('builds deterministic full-level decoration on existing ground, including the boss arena', () => {
  const before = JSON.stringify(SIGNAL_WORKS);
  const layout = environmentLayout(SIGNAL_WORKS);
  expect(environmentLayout(SIGNAL_WORKS)).toEqual(layout);
  for (const prop of layout.props) {
    const spec = ENVIRONMENT_ASSETS[prop.id];
    expect(SIGNAL_WORKS.ground.some(g => prop.x - spec.width / 2 >= g.x && prop.x + spec.width / 2 <= g.x + g.width)).toBe(true);
    expect(prop.x + spec.width / 2).toBeLessThanOrEqual(SIGNAL_WORKS.width);
  }
  for (const section of SIGNAL_WORKS.sections) {
    expect(layout.props.some(p => p.x >= section.x && p.x < section.x + 1024)).toBe(true);
  }
  expect(layout.walls.some(w => w.x === SIGNAL_WORKS.boss.arenaLeft && w.x + w.width === SIGNAL_WORKS.width)).toBe(true);
  expect(JSON.stringify(SIGNAL_WORKS)).toBe(before);
});

it('uses real backgrounds and checkpoint sprites throughout the level, retaining missing-image fallbacks', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(new Texture({ width: 512, height: 480 } as HTMLImageElement));
  const assets = new AssetManager(); await assets.preload();
  const scene = new Scene(), background = new ParallaxBackground(scene, assets);
  for (const x of [0, 1024, 2400, 4800, 7200, 9088, 9344]) {
    background.update(x);
    for (const layer of [DRAW.backgroundFar, DRAW.backgroundMid, DRAW.backgroundNear]) {
      expect(scene.children.some(root => root.visible && root.children.some(mesh => mesh instanceof Mesh
        && mesh.position.z === layer + DRAW.detail && !Array.isArray(mesh.material) && 'map' in mesh.material && mesh.material.map))).toBe(true);
    }
  }
  const manager = new CheckpointManager({ ...SIGNAL_WORKS.spawn, name: 'Inicio' }, SIGNAL_WORKS.checkpoints);
  const view = new CheckpointView(manager, assets); view.update(0);
  let textured = 0;
  view.root.traverse(mesh => {
    if (mesh instanceof Mesh && mesh.visible && !Array.isArray(mesh.material) && 'map' in mesh.material && mesh.material.map) textured++;
  });
  expect(textured).toBe(SIGNAL_WORKS.checkpoints.length);
  view.dispose(); background.dispose(); assets.dispose();
});

it('chooses stable surface variants from tile coordinates, without randomness', () => {
  const random = vi.spyOn(Math, 'random');
  const variants = Array.from({ length: 60 }, (_, x) => tileVariant(x * 16, 44));
  expect(new Set(variants).size).toBe(3);
  expect(Array.from({ length: 60 }, (_, x) => tileVariant(x * 16, 44))).toEqual(variants);
  expect(random).not.toHaveBeenCalled();
});

it('covers non-grid ground exactly, preserves bounds and avoids overlapping tiles', () => {
  for (const box of [{ x: 564, y: 0, width: 460, height: 44 }, { x: 350, y: 44, width: 40, height: 12 }]) {
    const before = { ...box }, pieces = groundPieces(box);
    expect(pieces.reduce((area, p) => area + p.width * p.height, 0)).toBe(box.width * box.height);
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]!;
      expect(piece.x).toBeGreaterThanOrEqual(box.x); expect(piece.y).toBeGreaterThanOrEqual(box.y);
      expect(piece.x + piece.width).toBeLessThanOrEqual(box.x + box.width);
      expect(piece.y + piece.height).toBeLessThanOrEqual(box.y + box.height);
      for (let j = i + 1; j < pieces.length; j++) expect(overlaps(piece, pieces[j]!)).toBe(false);
    }
    expect(box).toEqual(before);
    expect(pieces.every(p => p.topAligned)).toBe(true);
  }
  const clipped = groundPieces({ x: 564, y: 0, width: 460, height: 44 }, true, false);
  expect(clipped.some(p => p.id.endsWith('topRight') || p.id.endsWith('.right'))).toBe(false);
});

it('joins platform caps/middle without changing a six-pixel one-way collider', () => {
  const box = { x: 180, y: 68, width: 80, height: 6 }, before = { ...box };
  const pieces = platformPieces(box);
  expect(pieces.map(p => p.id)).toEqual(['environment.platform.left', 'environment.platform.right', 'environment.platform.middle']);
  expect(pieces.reduce((width, p) => width + p.width, 0)).toBe(80);
  expect(pieces.every(p => p.y + p.height === 74)).toBe(true); expect(box).toEqual(before);
  expect(platformPieces({ ...box, width: 16 })[0]?.id).toBe('environment.platform.single');
});

it('keeps tile scale, top-crops short pieces, repeats UVs and shares one material per asset', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(new Texture({ width: 16, height: 16 } as HTMLImageElement));
  const id = 'environment.ground.top01';
  const assets = new AssetManager({ [id]: { ...ASSETS[id]!, url: 'tile.png' } });
  const tiles = new TiledVisual(assets, id);
  tiles.add(0, 0, 8, 12, DRAW.levelTiles, true); tiles.add(16, 0, 64, 16, DRAW.levelTiles);
  expect(tiles.update()).toBe(false); expect(tiles.root.visible).toBe(false);
  await assets.preload(); expect(tiles.update()).toBe(true);
  const a = tiles.root.children[0] as Mesh, b = tiles.root.children[1] as Mesh;
  expect(a.material).toBe(b.material); expect(assets.getTexture(id)?.wrapS).toBe(RepeatWrapping);
  const uv = a.geometry.getAttribute('uv'); expect(uv.getY(0)).toBe(1); expect(uv.getY(2)).toBe(0.25); expect(uv.getX(1)).toBe(0.5);
  expect(b.geometry.getAttribute('uv').getX(1)).toBe(4);
  const position = a.position.clone(); for (let i = 0; i < 100; i++) tiles.update();
  expect(a.position).toEqual(position); expect(tiles.root.children).toEqual([a, b]);
  tiles.setDebug(true); const debug = tiles.root.children.at(-1);
  tiles.setDebug(false); tiles.setDebug(true); expect(tiles.root.children.at(-1)).toBe(debug);
  tiles.dispose(); assets.dispose();
});

it('loads all thirty environment PNGs at 2x source resolution with unchanged world sizes', async () => {
  const { readFileSync } = await vi.importActual<{ readFileSync(url: URL): Uint8Array }>('node:fs');
  const tiles = Object.entries(ENVIRONMENT_ASSETS);
  expect(tiles).toHaveLength(30);
  for (const [id, spec] of tiles) {
    const asset = ASSETS[id]!;
    expect(asset.url).toBe(asset.path);
    const png = readFileSync(new URL(`../public/${asset.path}`, import.meta.url));
    expect(new TextDecoder().decode(png.subarray(1, 4))).toBe('PNG');
    const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const contract: EnvironmentAsset = spec;
    expect(asset.artScale).toBe(2);
    expect(asset.visual.width).toBe(spec.width); expect(asset.visual.height).toBe(spec.height);
    expect(asset.sheet.frameWidth).toBe(spec.width * 2); expect(asset.sheet.frameHeight).toBe(spec.height * 2);
    expect(header.getUint32(16)).toBe(asset.sheet.frameWidth * (contract.frames ?? 1));
    expect(header.getUint32(20)).toBe(asset.sheet.frameHeight);
    expect(png[24]).toBe(8); expect(png[25]).toBe(6);
  }
});

it('keeps fallbacks visible and never registers decoration as collision geometry', () => {
  const assets = new AssetManager({}), scene = new Scene(), level = new Level(SIGNAL_WORKS);
  const before = JSON.stringify(level.data), solids = level.solids, platforms = level.oneWays;
  const view = new LevelView(scene, level, assets); view.update(0);
  expect(JSON.stringify(level.data)).toBe(before); expect(level.solids).toBe(solids); expect(level.oneWays).toBe(platforms);
  expect(scene.children.some(n => n instanceof Mesh && n.visible && n.scale.x === 520)).toBe(true);
  const environment = new EnvironmentView(assets, level.data); environment.update(0);
  const children = environment.root.children.slice();
  expect(children.some(n => n.visible && n.children.some(c => c instanceof Mesh))).toBe(true);
  for (let i = 0; i < 100; i++) environment.update(1 / 60);
  expect(environment.root.children).toEqual(children);
  environment.dispose(); view.dispose(); assets.dispose();
});

it('keeps every near-background primitive behind gameplay and repeats without allocating on scroll', () => {
  const assets = new AssetManager({}), scene = new Scene(), view = new ParallaxBackground(scene, assets);
  const children = scene.children.slice();
  for (const x of [0, 256, 512, 768, 1024, 4096, 9344]) {
    view.update(x);
    scene.traverse(n => { if (n instanceof Mesh) expect(n.position.z).toBeLessThan(DRAW.level); });
  }
  expect(scene.children).toEqual(children); view.dispose(); assets.dispose();
});

it('activates the complete delivered kit through the central manifest', () => {
  for (const [id, spec] of Object.entries(ENVIRONMENT_ASSETS)) {
    const contract: EnvironmentAsset = spec;
    expect(ASSETS[id]?.path).toBe(`assets/environment/${spec.file}.png`);
    expect(ASSETS[id]?.url).toBe(contract.enabled ? ASSETS[id]?.path : undefined);
    expect(ASSETS[id]?.visual.width).toBe(spec.width); expect(ASSETS[id]?.visual.height).toBe(spec.height);
    expect(ASSETS[id]?.clip.loop).toBe((contract.frames ?? 1) > 1);
  }
});
