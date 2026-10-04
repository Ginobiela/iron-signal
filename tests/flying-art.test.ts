import { afterEach, expect, it, vi } from 'vitest';
import { Mesh, MeshBasicMaterial, Texture, TextureLoader } from 'three';
import { ASSETS } from '../src/config/assets';
import { AssetManager } from '../src/core/AssetManager';
import { FlyingEnemy } from '../src/entities/enemies/FlyingEnemy';
import { EnemyView } from '../src/rendering/EnemyView';
import { FlyingCargoVisual } from '../src/rendering/FlyingCargoVisual';
import { PowerupManager } from '../src/level/PowerupManager';
import { CollisionSystem } from '../src/collision/CollisionSystem';

afterEach(() => vi.restoreAllMocks());
const visibleMaps = (view: EnemyView | FlyingCargoVisual): Texture[] => {
  const maps: Texture[] = [];
  view.root.traverse(node => {
    if (!(node instanceof Mesh) || !(node.material instanceof MeshBasicMaterial) || !node.material.map) return;
    let parent = node.parent;
    if (!node.visible) return;
    while (parent) { if (!parent.visible) return; parent = parent.parent; }
    maps.push(node.material.map);
  });
  return maps;
};
const flyingManifest = Object.fromEntries(Object.entries(ASSETS).filter(([id]) => id.startsWith('flying.')));

it.each(['M', 'S', 'L'] as const)('renders flying carrier %s and a single drop without changing the collider', async kind => {
  const load = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async url =>
    new Texture({ width: url.includes('labels') ? 9 : url.includes('pod') ? 12 : url.includes('death') ? 192 : url.includes('fly.png') ? 128 : 32,
      height: url.includes('labels') ? 5 : url.includes('pod') ? 10 : 24 } as HTMLImageElement));
  const assets = new AssetManager(flyingManifest); await assets.preload(); expect(load).toHaveBeenCalledTimes(5);
  const enemy = new FlyingEnemy(120, 100, kind); enemy.active = true;
  const view = new EnemyView(enemy, assets), before = { ...enemy.position };
  view.update(0); expect(visibleMaps(view)).toEqual(expect.arrayContaining([
    assets.getTexture('flying.fly'), assets.getTexture('flying.carrier.pod'), assets.getTexture(`flying.carrier.${kind}`),
  ]));
  expect(view.root.position.x).toBe(130); expect(view.root.position.y).toBe(107);
  expect(enemy.width).toBe(20); expect(enemy.height).toBe(14); expect(enemy.position).toEqual(before);
  expect(ASSETS[`flying.carrier.${kind}`]?.clip.frames).toEqual([{ M: 0, S: 1, L: 2 }[kind]]);
  enemy.hitFlashTimer = 0.1; view.update(0);
  expect(visibleMaps(view)).toContain(assets.getTexture('flying.hit'));
  enemy.takeDamage(100); view.update(0);
  expect(enemy.alive).toBe(false); expect(enemy.active).toBe(false);
  expect(visibleMaps(view)).toEqual([assets.getTexture('flying.death')]);
  const pickups = new PowerupManager(new CollisionSystem());
  const pickup = pickups.dropFromEnemy(enemy);
  expect(pickup).not.toBeNull(); expect(pickup?.position).toEqual(before);
  expect(pickups.dropFromEnemy(enemy)).toBeNull(); expect(pickups.spawnedCount).toBe(1);
  view.update(0.51); expect(view.root.visible).toBe(false);
  view.dispose(); assets.dispose();
});

it('keeps the existing M/S/L icon when carrier assets are missing', () => {
  const assets = new AssetManager({}), cargo = new FlyingCargoVisual(assets);
  cargo.setKind('S'); cargo.update(0); expect(cargo.root.children.filter(child => child.visible)).toHaveLength(1);
  expect(visibleMaps(cargo)).toEqual([]);
  cargo.dispose(); assets.dispose();
});
