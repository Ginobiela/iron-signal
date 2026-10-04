import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, Texture, TextureLoader } from 'three';
import { AssetManager } from '../src/core/AssetManager';
import { PlayerView } from '../src/rendering/PlayerView';
import { Player } from '../src/entities/Player';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { ASSETS } from '../src/config/assets';

afterEach(() => vi.restoreAllMocks());

describe('supplied player art', () => {
  it('uses art for crouch, crouchShoot, flip and jump with unchanged physical bounds', async () => {
    const map = new Texture({ width: 192, height: 32 } as HTMLImageElement);
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(map);
    const assets = new AssetManager(); await assets.preload();
    const player = new Player(62, 44), view = new PlayerView(assets), collision = new CollisionSystem();
    const pool = new ProjectileManager(collision);
    const floor = [{ x: 0, y: 0, width: 500, height: 44 }];
    const controls = { left: false, right: false, down: true, up: false, shoot: false, jumpPressed: false };
    player.update(1 / 60, { ...controls, down: false }, collision, floor, 500);
    player.update(1 / 60, controls, collision, floor, 500); player.direction = -1;
    const hasArt = (): boolean => {
      let visible = false;
      view.root.traverse((node) => {
        if (node instanceof Mesh && !Array.isArray(node.material) && 'map' in node.material) {
          visible ||= node.visible && node.material.map === map;
        }
      });
      return visible;
    };
    view.update(player, 0); expect(hasArt()).toBe(true); expect(player.height).toBe(12); expect(player.position.y).toBe(44);
    const position = { ...player.position }, weapon = player.weapon;
    player.updateCombat(1 / 60, { ...controls, shoot: true }, pool); view.update(player, 1 / 60);
    expect(hasArt()).toBe(true); expect(view.animation).toBe('crouchShoot');
    expect(player.position).toEqual(position); expect(player.weapon).toBe(weapon); expect(player.collisionBounds.height).toBe(12);
    player.shooting = false;
    player.update(1 / 60, { ...controls, down: false, jumpPressed: true }, collision, floor, 500);
    view.update(player, 0);
    expect(hasArt()).toBe(true); expect(view.animation).toBe('jump');
    view.dispose(); assets.dispose();
  });
  it.each([
    ['idle', 'up', 0, 0, 1], ['idle', 'diagonal', 0, Math.SQRT1_2, Math.SQRT1_2],
    ['shoot', 'horizontal', 0, 1, 0], ['shoot', 'up', 0, 0, 1], ['shoot', 'diagonal', 0, Math.SQRT1_2, Math.SQRT1_2],
    ['runShoot', 'horizontal', 95, 1, 0], ['runShoot', 'up', 95, 0, 1],
    ['runShoot', 'diagonal', 95, Math.SQRT1_2, Math.SQRT1_2],
    ['jumpShoot', 'horizontal', 95, 1, 0], ['jumpShoot', 'up', 95, 0, 1],
    ['jumpShoot', 'diagonal', 95, Math.SQRT1_2, Math.SQRT1_2],
  ] as const)('selects %s_%s from gameplay without changing position, aim or colliders', async (animation, aim, speed, ax, ay) => {
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
      new Texture({ width: 192, height: 32 } as HTMLImageElement));
    const assets = new AssetManager(); await assets.preload();
    const player = new Player(62, 44), view = new PlayerView(assets);
    player.grounded = animation !== 'jumpShoot'; player.shooting = animation !== 'idle'; player.velocity.x = speed;
    player.aimDirection.x = ax; player.aimDirection.y = ay;
    const expected = assets.getTexture(`player.${animation}_${aim}`);
    const position = { ...player.position }, bounds = { ...player.collisionBounds }, direction = { ...player.aimDirection };
    for (const facing of [1, -1] as const) {
      player.direction = facing; view.update(player, 1 / 60);
      let matchingSprite = false;
      view.root.traverse((node) => {
        if (node instanceof Mesh && !Array.isArray(node.material) && 'map' in node.material && node.visible && node.material.map === expected) {
          matchingSprite = true; expect(node.scale.x).toBe(facing * 32);
        }
      });
      expect(matchingSprite).toBe(true); expect(view.animation).toBe(animation);
      expect(player.position).toEqual(position); expect(player.collisionBounds).toEqual(bounds); expect(player.aimDirection).toEqual(direction);
    }
    expect(ASSETS[`player.${animation}_${aim}`]?.includesWeapon).toBe(true);
    view.dispose(); assets.dispose();
  });
  it.each([[1, 0], [0, 1], [Math.SQRT1_2, Math.SQRT1_2]] as const)(
    'plays death once regardless of the last aim (%s, %s) and restores the visual on respawn', async (ax, ay) => {
      vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
        new Texture({ width: 192, height: 32 } as HTMLImageElement));
      const assets = new AssetManager(); await assets.preload();
      const player = new Player(62, 44), view = new PlayerView(assets);
      player.aimDirection.x = ax; player.aimDirection.y = ay; player.die();
      const position = { ...player.position };
      view.update(player, 0);
      expect(view.animation).toBe('death'); expect(view.root.visible).toBe(true);
      let hasDeath = false;
      view.root.traverse((node) => {
        if (node instanceof Mesh && !Array.isArray(node.material) && 'map' in node.material) {
          hasDeath ||= node.visible && node.material.map === assets.getTexture('player.death');
        }
      });
      expect(hasDeath).toBe(true); expect(ASSETS['player.death']?.clip.loop).toBe(false);
      view.update(player, 0.61);
      expect(view.root.visible).toBe(false); expect(player.alive).toBe(false); expect(player.position).toEqual(position);
      player.respawn(62, 44); view.resetFeedback(); view.update(player, 0);
      expect(view.root.visible).toBe(true); expect(view.animation).not.toBe('death');
      view.dispose(); assets.dispose();
    });
});
