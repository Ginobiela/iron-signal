import { afterEach, expect, it, vi } from 'vitest';
import { Mesh, MeshBasicMaterial, Texture, TextureLoader } from 'three';
import { ASSETS } from '../src/config/assets';
import { AssetManager } from '../src/core/AssetManager';
import { Turret } from '../src/entities/enemies/Turret';
import { EnemyView } from '../src/rendering/EnemyView';

afterEach(() => vi.restoreAllMocks());

it('selects turret sheets, mirrors only the visual and completes death without altering aim or AI timers', async () => {
  const load = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async url =>
    new Texture({ width: url.includes('_idle') ? 96 : url.includes('_shoot') ? 144 : 288, height: 48 } as HTMLImageElement));
  const assets = new AssetManager(Object.fromEntries(Object.entries(ASSETS).filter(([id]) => id.startsWith('turret.'))));
  await assets.preload(); expect(load).toHaveBeenCalledTimes(3);
  const enemy = new Turret(120, 44); enemy.active = true;
  const view = new EnemyView(enemy, assets);
  const sprite = (): Mesh<import('three').BufferGeometry, MeshBasicMaterial> => {
    let found: Mesh<import('three').BufferGeometry, MeshBasicMaterial> | undefined;
    view.root.traverse(node => {
      if (node instanceof Mesh && node.visible && node.material instanceof MeshBasicMaterial && node.material.map) found = node;
    });
    expect(found).toBeDefined(); return found!;
  };
  const position = { ...enemy.position }, aim = { ...enemy.aimDirection }, timer = enemy.attackTimer;
  view.update(0); expect(sprite().material.map).toBe(assets.getTexture('turret.idle'));
  view.update(0.18); expect(sprite().geometry.getAttribute('uv').getX(0)).toBeCloseTo(48.5 / 96);
  for (const facing of [1, -1] as const) {
    enemy.direction = facing; view.update(0); expect(sprite().scale.x).toBe(facing * 24);
  }
  expect(enemy.position).toEqual(position); expect(enemy.aimDirection).toEqual(aim); expect(enemy.attackTimer).toBe(timer);
  expect(enemy.width).toBe(20); expect(enemy.height).toBe(20);
  expect(view.root.position.x).toBe(130); expect(view.root.position.y).toBe(44);
  expect(sprite().position.y).toBe(12);
  enemy.attackTimer = 0; view.update(0); enemy.attackTimer = 2; view.update(0);
  expect(sprite().material.map).toBe(assets.getTexture('turret.shoot'));
  view.update(0.11); expect(sprite().geometry.getAttribute('uv').getX(0)).toBeCloseTo(48.5 / 144);
  enemy.hitFlashTimer = 0.1; view.update(0); expect(sprite().material.color.getHex()).toBe(0xfff3c4);
  enemy.die(); view.update(0);
  expect(enemy.alive).toBe(false); expect(enemy.active).toBe(false); expect(view.root.visible).toBe(true);
  expect(sprite().material.map).toBe(assets.getTexture('turret.death'));
  view.update(0.61); expect(view.root.visible).toBe(false);
  view.dispose(); assets.dispose();
});
