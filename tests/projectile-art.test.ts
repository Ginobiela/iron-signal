import { afterEach, expect, it, vi } from 'vitest';
import { Texture, TextureLoader } from 'three';
import { ASSETS } from '../src/config/assets';
import { PROJECTILE_ART } from '../src/config/projectileArt';
import { AssetManager } from '../src/core/AssetManager';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { ProjectileView } from '../src/rendering/ProjectileView';
import { Rifle } from '../src/weapons/Rifle';
import { MachineGun } from '../src/weapons/MachineGun';
import { SpreadGun } from '../src/weapons/SpreadGun';
import { Laser } from '../src/weapons/Laser';
import { Soldier } from '../src/entities/enemies/Soldier';
import { Turret } from '../src/entities/enemies/Turret';
import { Player } from '../src/entities/Player';
import { Boss } from '../src/bosses/Boss';
import { FortifiedGateBoss } from '../src/bosses/FortifiedGateBoss';

afterEach(() => vi.restoreAllMocks());

it.each([[Rifle, 'rifle'], [MachineGun, 'machinegun'], [SpreadGun, 'spread'], [Laser, 'laser']] as const)(
  '%s tags its projectiles without changing speed, damage or lifetime', (Type, id) => {
    const pool = new ProjectileManager(new CollisionSystem());
    const weapon = new Type();
    expect(weapon.fire(pool, 100, 120, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, 'player')).toBe(true);
    const shots = pool.items.filter(p => p.active);
    expect(shots).toHaveLength(id === 'spread' ? 5 : 1);
    for (const shot of shots) {
      expect(shot.visualId).toBe(`projectile.player.${id}`);
      expect(Math.hypot(shot.velocity.x, shot.velocity.y)).toBeCloseTo(weapon.projectileSpeed);
      expect(shot.damage).toBe(weapon.damage);
      expect(shot.lifeRemaining).toBe(weapon.projectileLifetime);
      expect(shot.style).toBe(id === 'laser' ? 'laser' : 'bullet');
    }
  });

it('routes Soldier, both Turret modes, arena boss and Gate defenses to their real art', () => {
  const collision = new CollisionSystem(), projectiles = new ProjectileManager(collision);
  const context = { collision, projectiles, player: new Player(40, 44), solids: [], worldWidth: 1000 };
  for (const enemy of [new Soldier(180, 44), new Turret(180, 44), new Turret(180, 44, 'horizontal')]) {
    projectiles.clear(); enemy.active = true; enemy.attackTimer = 0; enemy.update(1 / 60, context);
    expect(projectiles.items.find(p => p.active)?.visualId).toBe(`projectile.enemy.${enemy.kind}`);
  }
  for (const boss of [new Boss({ x: 400, y: 44, arenaLeft: 0 }),
    new FortifiedGateBoss({ x: 400, y: 44, arenaLeft: 0 })]) {
    projectiles.clear(); boss.activate(0);
    for (let i = 0; i < 600 && !projectiles.activeCount; i++) boss.update(1 / 60, context);
    expect(projectiles.activeCount).toBeGreaterThan(0);
    expect(projectiles.items.find(p => p.active)?.visualId).toBe(
      boss instanceof FortifiedGateBoss ? 'projectile.enemy.bossGateTurret' : 'projectile.enemy.arena');
  }
});

it('resets visual identity when a pooled slot is reused for a legacy bullet or missile', () => {
  const pool = new ProjectileManager(new CollisionSystem(), 1), slot = pool.items[0]!;
  pool.spawn(0, 0, 100, 0, 1, 'player', 0, 'bullet', 2, 0, 'projectile.player.spread');
  pool.clear(); pool.spawnHoming(10, 20, 80, 0, 1, .5, 2);
  expect(pool.items[0]).toBe(slot); expect(slot.visualId).toBe(''); expect(slot.style).toBe('missile');
  pool.clear(); pool.spawn(0, 0, 100, 0, 1, 'enemy');
  expect(slot.visualId).toBe(''); expect(slot.style).toBe('bullet');
});

it('loads all eight 2× sources into the existing view, rotates them and preserves geometric fallback', async () => {
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async url =>
    new Texture({ width: String(url).includes('player_laser') ? 24 : 6, height: 6 } as HTMLImageElement));
  const assets = new AssetManager(Object.fromEntries(Object.keys(PROJECTILE_ART).map(id => [id, ASSETS[id]!])));
  await assets.preload();
  const pool = new ProjectileManager(new CollisionSystem(), 1), view = new ProjectileView(1, assets);
  for (const id of Object.keys(PROJECTILE_ART)) {
    const asset = ASSETS[id]!;
    expect(asset.sheet.frameWidth).toBe(asset.visual.width * 2);
    expect(asset.sheet.frameHeight).toBe(asset.visual.height * 2);
    expect(asset.visual.anchor).toBe('center');
    pool.clear(); pool.spawn(70, 80, -100, -100, 1, 'player', 0, 'bullet', 2, 0, id);
    view.update(pool);
    expect(view.mesh.count).toBe(0);
    expect(view.sprites.children[0]!.position.x).toBe(70);
    expect(view.sprites.children[0]!.rotation.z).toBeCloseTo(-Math.PI * .75);
  }
  pool.clear(); pool.spawn(70, 80, 100, 0, 1, 'enemy', 0, 'bullet', 2, 0, 'missing');
  view.update(pool); expect(view.mesh.count).toBe(1);
  view.dispose(); assets.dispose();
});
