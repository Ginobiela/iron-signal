import { afterEach, expect, it, vi } from 'vitest';
import { Mesh, Texture, TextureLoader } from 'three';
import { AssetManager } from '../src/core/AssetManager';
import { ASSETS } from '../src/config/assets';
import { VFX_EFFECTS } from '../src/config/vfx';
import { FxSpritePool } from '../src/rendering/FxSpritePool';
import { ParticleManager } from '../src/rendering/ParticleManager';
import { ScreenShakeManager } from '../src/camera/ScreenShakeManager';
import { playerMuzzle } from '../src/rendering/vfxOrigins';
import { Player } from '../src/entities/Player';
import { Soldier } from '../src/entities/enemies/Soldier';
import { EnemyView } from '../src/rendering/EnemyView';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { CollisionSystem } from '../src/collision/CollisionSystem';

afterEach(() => vi.restoreAllMocks());

it('reuses all VFX meshes/materials, caps saturation, pauses and clears fallback lifecycles', () => {
  const assets = new AssetManager({}), particles = new ParticleManager(16), shake = new ScreenShakeManager();
  const pool = new FxSpritePool(assets, particles, shake, 2);
  const identities: unknown[] = [];
  pool.root.traverse(node => { identities.push(node); if (node instanceof Mesh) identities.push(node.geometry, node.material); });
  pool.spawn('fx.muzzle.rifle', 10, 20); pool.spawn('fx.impact.default', 20, 30);
  expect(pool.activeCount).toBe(2); expect(pool.spawn('fx.hit.enemy', 0, 0)).toBe(false); expect(pool.droppedCount).toBe(1);
  expect(pool.root.children[0]?.visible).toBe(true); expect(pool.capacity).toBe(2);
  pool.update(0); expect(pool.activeCount).toBe(2);
  pool.update(1); expect(pool.activeCount).toBe(0);
  for (let i = 0; i < 100; i++) { pool.spawn('fx.muzzle.machineGun', 30, 40); pool.update(0.1); }
  const after: unknown[] = [];
  pool.root.traverse(node => { after.push(node); if (node instanceof Mesh) after.push(node.geometry, node.material); });
  expect(after).toEqual(identities); expect(pool.spawnedCount).toBe(102);
  pool.spawn('fx.explosion.small', 0, 0); pool.clear();
  expect(pool.activeCount).toBe(0); expect(pool.root.children.every(node => !node.visible)).toBe(true);
  pool.dispose(); assets.dispose();
});

it('returns non-loop sprite effects to the same pool and uses primitives when a PNG fails', async () => {
  const id = 'fx.muzzle.rifle';
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(new Texture({ width: 16, height: 8 } as HTMLImageElement));
  const assets = new AssetManager({ [id]: { ...ASSETS[id]!, url: 'test.png' } }); await assets.preload();
  const pool = new FxSpritePool(assets, undefined, undefined, 1);
  expect(pool.spawn(id, 0, 0)).toBe(true); const node = pool.root.children[0];
  pool.update(0.07); expect(pool.activeCount).toBe(0); expect(node?.visible).toBe(false);
  pool.spawn(id, 1, 1); expect(pool.root.children[0]).toBe(node);
  pool.dispose(); assets.dispose();
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockRejectedValue(new Error('missing'));
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const missing = new AssetManager({ [id]: { ...ASSETS[id]!, url: 'missing.png' } }); await missing.preload();
  const fallback = new FxSpritePool(missing); fallback.spawn(id, 1, 2);
  expect(fallback.activeCount).toBe(1); expect(fallback.root.children[0]?.visible).toBe(true);
  fallback.update(0.1); expect(fallback.activeCount).toBe(0); expect(warn).toHaveBeenCalledTimes(1);
  fallback.dispose(); missing.dispose();
});

it('applies shake only for configured explosions and keeps spark particle life short', () => {
  const assets = new AssetManager({}), particles = new ParticleManager(32), shake = new ScreenShakeManager();
  const trigger = vi.spyOn(shake, 'trigger'), pool = new FxSpritePool(assets, particles, shake);
  for (const id of ['fx.muzzle.rifle', 'fx.hit.enemy', 'fx.impact.default', 'fx.explosion.small'] as const) pool.spawn(id, 0, 0);
  expect(trigger).not.toHaveBeenCalled();
  pool.spawn('fx.explosion.medium', 0, 0); expect(trigger).toHaveBeenCalledWith(1, 0.1);
  expect(particles.items.every(p => p.life <= 0.3)).toBe(true);
  pool.dispose(); assets.dispose();
});

it('visual fire events never spawn bullets or mutate the enemy attack timer', () => {
  const assets = new AssetManager({}), fx = new FxSpritePool(assets);
  const projectiles = new ProjectileManager(new CollisionSystem());
  const enemy = new Soldier(100, 44); enemy.active = true;
  const event = vi.fn(() => fx.spawn('fx.muzzle.rifle', 100, 60));
  const view = new EnemyView(enemy, assets, event);
  enemy.attackTimer = 0; view.update(0); enemy.attackTimer = 1.6; view.update(0); view.update(0);
  expect(event).toHaveBeenCalledTimes(1); expect(enemy.attackTimer).toBe(1.6);
  expect(projectiles.totalSpawned).toBe(0); expect(fx.activeCount).toBe(1);
  view.dispose(); fx.dispose(); assets.dispose();
});

it('visual muzzle offsets preserve player position, aim, shooting and the projectile origin', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(new Texture({ width: 64, height: 32 } as HTMLImageElement));
  const assets = new AssetManager({ 'player.crouchShoot_horizontal': ASSETS['player.crouchShoot_horizontal']! }); await assets.preload();
  const player = new Player(62, 44); player.height = 12; player.direction = -1; player.aimDirection.x = -1;
  const out = { x: 0, y: 0, angle: 0 }, before = { ...player.position }, aim = { ...player.aimDirection };
  const weapon = player.weapon, pivot = player.gunPivotY;
  playerMuzzle(player, assets, out);
  expect(out.x).toBe(57); expect(out.y).toBe(51); expect(out.angle).toBe(Math.PI);
  expect(player.position).toEqual(before); expect(player.aimDirection).toEqual(aim);
  expect(player.shooting).toBe(false); expect(player.weapon).toBe(weapon); expect(player.gunPivotY).toBe(pivot);
  assets.dispose();
});

it('all planned effects have bounded non-loop clips and valid replaceable specs', () => {
  for (const [id, spec] of Object.entries(VFX_EFFECTS)) {
    expect(ASSETS[id]?.clip.loop).toBe(false); expect(ASSETS[id]?.visual.anchor).toBe('center');
    expect(ASSETS[id]?.path).toBe(`assets/sprites/fx/${spec.file}.png`);
    expect(spec.frames / spec.fps).toBeLessThan(0.5);
  }
});
