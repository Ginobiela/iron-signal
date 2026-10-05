import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, MeshBasicMaterial, NearestFilter, Texture, TextureLoader } from 'three';
import { AssetManager } from '../src/core/AssetManager';
import type { SpriteAsset } from '../src/config/assets';
import { ASSETS } from '../src/config/assets';
import { SpriteAnimator } from '../src/rendering/SpriteAnimator';
import { SpriteVisual } from '../src/rendering/SpriteVisual';
import { spriteCenterY, writeFrameUV } from '../src/rendering/spriteFrames';
import { Player } from '../src/entities/Player';
import { PlayerView } from '../src/rendering/PlayerView';
import { Soldier } from '../src/entities/enemies/Soldier';
import { Runner } from '../src/entities/enemies/Runner';
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
  it('preserves frame and partial frame time between compatible running variants', () => {
    const clips = Object.fromEntries(['run', 'diagonal', 'up', 'shoot'].map(name =>
      [name, { frames: [0, 1, 2, 3, 4, 5], frameRate: 11, syncGroup: 'run' }]));
    const animator = new SpriteAnimator({ ...clips, idle: { frames: [0, 1], frameRate: 6 } });
    animator.update('run', 0); animator.update('run', 4.5 / 11);
    for (const name of ['diagonal', 'up', 'shoot', 'run']) {
      animator.update(name, 0); expect(animator.frame).toBe(4);
    }
    animator.update('run', 0.6 / 11); expect(animator.frame).toBe(5);
    animator.update('idle', 0); expect(animator.frame).toBe(0);
  });
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
  it('renders runner sheets and death without altering movement, hitbox or health', async () => {
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () =>
      new Texture({ width: 144, height: 24 } as HTMLImageElement));
    const assets = new AssetManager(Object.fromEntries(Object.entries(ASSETS).filter(([id]) => id.startsWith('runner.'))));
    await assets.preload();
    const enemy = new Runner(120, 44); enemy.active = true; enemy.velocity.x = 80;
    const view = new EnemyView(enemy, assets);
    const sprite = (): Mesh => {
      let found: Mesh | undefined;
      view.root.traverse(node => {
        if (node instanceof Mesh && node.visible && node.material instanceof MeshBasicMaterial && node.material.map) found = node;
      });
      expect(found).toBeDefined(); return found!;
    };
    view.update(0); view.update(0.26);
    expect(sprite().geometry.getAttribute('uv').getX(0)).toBeCloseTo(72.5 / 144);
    for (const direction of [1, -1] as const) {
      enemy.direction = direction; view.update(0); expect(sprite().scale.x).toBe(direction * 24);
    }
    expect(enemy.position).toEqual({ x: 120, y: 44 }); expect(enemy.velocity.x).toBe(80);
    expect(enemy.width).toBe(14); expect(enemy.height).toBe(16); expect(enemy.health).toBe(enemy.maxHealth);
    expect(view.root.position.x).toBe(127); expect(view.root.position.y).toBe(44); expect(sprite().position.y).toBe(12);
    enemy.hitFlashTimer = 0.1; view.update(0);
    const mesh = sprite();
    if (mesh.material instanceof MeshBasicMaterial) expect(mesh.material.color.getHex()).toBe(0xfff3c4);
    enemy.die(); view.update(0); expect(view.root.visible).toBe(true);
    expect((sprite().material as MeshBasicMaterial).map).toBe(assets.getTexture('runner.death'));
    expect(enemy.active).toBe(false); expect(enemy.alive).toBe(false);
    view.update(0.61); expect(view.root.visible).toBe(false);
    view.dispose(); assets.dispose();
  });
  it('uses supplied soldier sheets for idle, run, shoot, death and flip without changing gameplay', async () => {
    const load = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async url =>
      new Texture({ width: url.includes('_idle') ? 128 : url.includes('_shoot') ? 64 : 192, height: 32 } as HTMLImageElement));
    const assets = new AssetManager(Object.fromEntries(Object.entries(ASSETS).filter(([id]) => id.startsWith('soldier.'))));
    await assets.preload(); expect(load).toHaveBeenCalledTimes(4);
    const enemy = new Soldier(120, 44); enemy.active = true;
    const view = new EnemyView(enemy, assets);
    const position = { ...enemy.position }, health = enemy.health;
    const sprite = (): Mesh => {
      let found: Mesh | undefined;
      view.root.traverse(node => {
        if (node instanceof Mesh && node.visible && !Array.isArray(node.material)
          && node.material instanceof MeshBasicMaterial && node.material.map) found = node;
      });
      expect(found).toBeDefined(); return found!;
    };
    view.update(0); expect(sprite().geometry.getAttribute('uv').getX(0)).toBeCloseTo(0.5 / 128);
    expect((sprite().material as MeshBasicMaterial).map).toBe(assets.getTexture('soldier.idle'));
    view.update(0.18); expect(sprite().geometry.getAttribute('uv').getX(0)).toBeCloseTo(32.5 / 128);
    enemy.velocity.x = 32;
    for (const direction of [1, -1] as const) {
      enemy.direction = direction; view.update(0);
      expect(sprite().scale.x).toBe(direction * 32);
      expect((sprite().material as MeshBasicMaterial).map).toBe(assets.getTexture('soldier.run'));
    }
    view.update(0.11); expect(sprite().geometry.getAttribute('uv').getX(0)).toBeCloseTo(32.5 / 192);
    enemy.attackTimer = 0; view.update(0); enemy.attackTimer = 1.6; view.update(0);
    expect(sprite().geometry.getAttribute('uv').getX(0)).toBeCloseTo(0.5 / 64);
    expect((sprite().material as MeshBasicMaterial).map).toBe(assets.getTexture('soldier.shoot'));
    expect(enemy.attackTimer).toBe(1.6); expect(enemy.position).toEqual(position);
    expect(enemy.health).toBe(health); expect(enemy.width).toBe(12); expect(enemy.height).toBe(24);
    enemy.hitFlashTimer = 0.1; view.update(0);
    const mesh = sprite();
    expect(mesh.material).toBeInstanceOf(MeshBasicMaterial);
    if (mesh.material instanceof MeshBasicMaterial) expect(mesh.material.color.getHex()).toBe(0xfff3c4);
    enemy.die(); view.update(0); expect(view.root.visible).toBe(true);
    expect((sprite().material as MeshBasicMaterial).map).toBe(assets.getTexture('soldier.death'));
    expect(enemy.alive).toBe(false); expect(enemy.active).toBe(false);
    view.update(0.2); expect(view.root.visible).toBe(true);
    view.update(0.41); expect(view.root.visible).toBe(false);
    view.dispose(); assets.dispose();
  });
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
