import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, NearestFilter, Texture, TextureLoader } from 'three';
import { AssetManager } from '../src/core/AssetManager';
import type { SpriteAsset } from '../src/config/assets';
import { SpriteAnimator } from '../src/rendering/SpriteAnimator';
import { SpriteVisual } from '../src/rendering/SpriteVisual';
import { spriteCenterY, writeFrameUV } from '../src/rendering/spriteFrames';
import { Player } from '../src/entities/Player';
import { PlayerView } from '../src/rendering/PlayerView';
import { Soldier } from '../src/entities/enemies/Soldier';
import { EnemyView } from '../src/rendering/EnemyView';
import { CollisionSystem } from '../src/collision/CollisionSystem';

afterEach(() => vi.restoreAllMocks());
const asset = (url = 'assets/test.png'): SpriteAsset => ({
  url, path: url, sheet: { frameWidth: 32, frameHeight: 32, frameCount: 2 },
  visual: { width: 32, height: 32, offsetX: 3, offsetY: 2, scaleX: 1, scaleY: 1, anchor: 'bottom-center' },
  clip: { frames: [0, 1], frameRate: 10 },
});
const texture = (): Texture<HTMLImageElement> => new Texture({ width: 64, height: 32 } as HTMLImageElement);

describe('sprite scheduling', () => {
  it('play does not restart a clip, supports pause/flip and independent FPS', () => {
    const animator = new SpriteAnimator({ run: { frames: [0, 1, 2, 3], frameRate: 10 } });
    animator.play('run'); animator.tick(0.15); animator.play('run'); animator.tick(0.1);
    expect(animator.frame).toBe(2);
    animator.flipX = true; animator.tick(0);
    expect(animator.frame).toBe(2); expect(animator.flipX).toBe(true);
    animator.tick(0.15); expect(animator.frame).toBe(0);
    expect(animator.play('missing')).toBe(false); expect(animator.animation).toBe('run');
  });
  it('non-loop completes once, retains its last frame and can be reset', () => {
    const complete = vi.fn();
    const animator = new SpriteAnimator({ death: { frames: [4, 5], frameRate: 10, loop: false, onComplete: complete } });
    animator.play('death'); animator.tick(0.21); animator.play('death'); animator.tick(10);
    expect(animator.completed).toBe(true); expect(animator.frame).toBe(5); expect(complete).toHaveBeenCalledTimes(1);
    animator.reset(); animator.play('death'); animator.tick(0.21);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});

describe('sheet/atlas UVs and origins', () => {
  it('selects rows/columns with half-texel inset, spacing and margins', () => {
    const uv = { left: 0, right: 0, bottom: 0, top: 0 };
    writeFrameUV({ frameWidth: 8, frameHeight: 8, frameCount: 4, columns: 2, margin: 1, spacing: 2 }, 3, 20, 20, uv);
    expect(uv.left).toBe(11.5 / 20); expect(uv.right).toBe(18.5 / 20);
    expect(uv.top).toBe(1 - 11.5 / 20); expect(uv.bottom).toBe(1 - 18.5 / 20);
  });
  it('accepts atlas rectangles and incomplete strips without sampling outside the image', () => {
    const uv = { left: 0, right: 0, bottom: 0, top: 0 };
    writeFrameUV({ frameWidth: 32, frameHeight: 32, frameCount: 6 }, 5, 32, 32, uv);
    expect(uv.left).toBe(0.5 / 32); expect(uv.right).toBe(31.5 / 32);
    writeFrameUV({ frameWidth: 8, frameHeight: 8, frameCount: 1,
      atlas: [{ x: 12, y: 4, width: 8, height: 8 }] }, 0, 32, 16, uv);
    expect(uv.left).toBe(12.5 / 32); expect(uv.top).toBe(1 - 4.5 / 16);
  });
  it('bottom-center preserves feet when dimensions/scales change; center stays on origin', () => {
    const config = asset().visual;
    expect(spriteCenterY(config) - config.height / 2).toBe(config.offsetY);
    const taller = { ...config, height: 40, scaleY: 2 };
    expect(spriteCenterY(taller) - taller.height).toBe(config.offsetY);
    expect(spriteCenterY({ ...taller, anchor: 'center' })).toBe(config.offsetY);
  });
});

describe('central texture loading and fallback', () => {
  it('loads a shared URL once, uses nearest filtering, and exposes a synchronous registry', async () => {
    const map = texture(); const load = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(map);
    const assets = new AssetManager({ idle: asset(), run: asset(), future: { ...asset(), url: undefined } });
    const first = assets.preload(); expect(assets.preload()).toBe(first); await first;
    expect(load).toHaveBeenCalledTimes(1);
    expect(assets.getTexture('idle')).toBe(map); expect(assets.getTexture('run')).toBe(map);
    expect(map.minFilter).toBe(NearestFilter); expect(map.magFilter).toBe(NearestFilter); expect(map.generateMipmaps).toBe(false);
    expect(assets.getTexture('future')).toBeUndefined(); assets.dispose();
  });
  it('a missing PNG does not reject preload or leave a sprite visible', async () => {
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockRejectedValue(new Error('missing PNG'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const assets = new AssetManager({ idle: asset() });
    await expect(assets.preload()).resolves.toBeUndefined();
    const sprite = new SpriteVisual(assets, asset().visual);
    expect(sprite.update('idle', 0.1)).toBe(false); expect(sprite.mesh.visible).toBe(false);
    sprite.dispose(); assets.dispose();
  });
  it('shared textures have independent per-instance UVs and flip changes only the visual', async () => {
    const map = texture(); vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(map);
    const assets = new AssetManager({ run: asset() }); await assets.preload();
    const first = new SpriteVisual(assets, asset().visual), second = new SpriteVisual(assets, asset().visual);
    first.update('run', 0); second.update('run', 0); first.update('run', 0.1, true);
    expect(first.mesh.material.map).toBe(second.mesh.material.map);
    expect(first.mesh.geometry.getAttribute('uv').getX(0)).not.toBe(second.mesh.geometry.getAttribute('uv').getX(0));
    expect(map.offset.x).toBe(0); expect(map.repeat.x).toBe(1);
    expect(first.mesh.scale.x).toBe(-32); expect(first.root.position.x).toBe(0);
    first.dispose(); second.dispose(); assets.dispose();
  });
  it('an incomplete player animation falls back to idle without changing its collider or weapon', async () => {
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(texture());
    const assets = new AssetManager({ 'player.idle': asset() }); await assets.preload();
    const player = new Player(62, 44), view = new PlayerView(assets);
    const weapon = player.weapon;
    player.update(1 / 60, { left: true, right: false, down: false, up: false, shoot: true, jumpPressed: false },
      new CollisionSystem(), [{ x: 0, y: 0, width: 500, height: 44 }], 500);
    const before = { ...player.position }; view.update(player, 1 / 60);
    expect(player.position).toEqual(before); expect(player.width).toBe(12); expect(player.height).toBe(26);
    expect(player.weapon).toBe(weapon); expect(view.animation).toBe('run');
    const meshes = view.root.children.filter((child) => child.type === 'Group');
    expect(meshes.some((group) => group.children.some((child) => child.type === 'Mesh' && child.visible))).toBe(true);
    view.dispose(); assets.dispose();
  });
  it('enemy death stays visual while logical health/attacks/contact are already disabled', async () => {
    const death = { ...asset(), clip: { frames: [0, 1], frameRate: 10, loop: false } };
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(texture());
    const assets = new AssetManager({ 'soldier.death': death }); await assets.preload();
    const enemy = new Soldier(120, 44); enemy.active = true;
    const view = new EnemyView(enemy, assets); view.update(0);
    enemy.takeDamage(100); view.update(0);
    expect(enemy.alive).toBe(false); expect(enemy.active).toBe(false); expect(view.root.visible).toBe(true);
    view.update(0.21); expect(view.root.visible).toBe(false);
    view.dispose(); assets.dispose();
  });
  it('observes the existing soldier attack timer for a shoot pose without changing AI', async () => {
    const idle = texture(), shoot = texture();
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async (url) => url.includes('shoot') ? shoot : idle);
    const assets = new AssetManager({ 'soldier.idle': asset('idle.png'), 'soldier.shoot': asset('shoot.png') });
    await assets.preload();
    const enemy = new Soldier(120, 44); enemy.active = true;
    const view = new EnemyView(enemy, assets);
    enemy.attackTimer = 0.01; view.update(0.01);
    enemy.attackTimer = 1.6; view.update(0.01);
    let shootVisible = false;
    view.root.traverse((node) => {
      if (node instanceof Mesh && !Array.isArray(node.material) && 'map' in node.material) {
        shootVisible ||= node.visible && node.material.map === shoot;
      }
    });
    expect(shootVisible).toBe(true); expect(enemy.attackTimer).toBe(1.6);
    view.dispose(); assets.dispose();
  });
});
