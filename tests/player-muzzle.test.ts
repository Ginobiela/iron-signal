import { expect, it } from 'vitest';
import { AssetManager } from '../src/core/AssetManager';
import { Player } from '../src/entities/Player';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { FxSpritePool } from '../src/rendering/FxSpritePool';
import { LightingSystem } from '../src/rendering/LightingSystem';
import { playerMuzzle } from '../src/rendering/vfxOrigins';
import { WEAPON_VFX } from '../src/config/vfx';
import { Rifle } from '../src/weapons/Rifle';
import { MachineGun } from '../src/weapons/MachineGun';
import { SpreadGun } from '../src/weapons/SpreadGun';
import { Laser } from '../src/weapons/Laser';

it.each([
  ['standing', true, 0, false, false, false, 14, 15],
  ['running', true, 95, false, false, false, 15, 14],
  ['airborne', false, 0, false, false, false, 13, 11],
  ['crouching', true, 0, true, false, false, 14, 8],
  ['up', true, 0, false, true, false, 6, 26],
  ['diagonal up', true, 95, false, true, true, 14, 21],
  ['down', false, 0, true, false, false, 8, 4],
  ['diagonal down', false, 95, true, false, true, 14, 7],
] as const)('%s shares one barrel tip between bullets, muzzle flash and lighting', (_pose, grounded, speed, down, up, diagonal, tipX, tipY) => {
  const assets = new AssetManager({}), lights = new LightingSystem(); lights.enabled = true;
  const fx = new FxSpritePool(assets, undefined, undefined, 1);
  fx.onSpawn = (id, x, y) => lights.onVfx(id, x, y);
  for (const facing of [1, -1] as const) for (const WeaponType of [Rifle, MachineGun, SpreadGun, Laser]) {
    const player = new Player(100, 80), projectiles = new ProjectileManager(new CollisionSystem());
    player.grounded = grounded; player.velocity.x = speed * facing; player.direction = facing;
    if (_pose === 'crouching') player.height = 12;
    player.weapon = new WeaponType();
    player.updateCombat(1 / 60, { left: diagonal && facing < 0, right: diagonal && facing > 0,
      up, down, jumpPressed: false, shoot: true }, projectiles);
    const central = projectiles.items.find(p => p.active
      && Math.abs(p.velocity.x / player.weapon.projectileSpeed - player.aimDirection.x) < 1e-8
      && Math.abs(p.velocity.y / player.weapon.projectileSpeed - player.aimDirection.y) < 1e-8)!;
    const expected = { x: 106 + tipX * facing, y: 80 + tipY };
    expect(central).toBeDefined();
    expect(central.position.x).toBeCloseTo(expected.x); expect(central.position.y).toBeCloseTo(expected.y);
    expect(central.previousPosition).toEqual({ x: player.projectileOriginX, y: player.projectileOriginY });
    const muzzle = { x: 0, y: 0, angle: 0 }; playerMuzzle(player, muzzle);
    expect(muzzle.x).toBe(expected.x); expect(muzzle.y).toBe(expected.y);
    expect(muzzle.angle).toBe(Math.atan2(player.aimDirection.y, player.aimDirection.x));
    fx.spawn(WEAPON_VFX[player.weapon.name]!, muzzle.x, muzzle.y, muzzle.angle);
    expect(fx.root.children[0]!.position.x).toBe(expected.x); expect(fx.root.children[0]!.position.y).toBe(expected.y);
    const light = lights.slots.find(s => s.active)!;
    expect(light.x).toBe(expected.x); expect(light.y).toBe(expected.y);
    fx.clear(); lights.clear();
  }
  fx.dispose(); lights.dispose(); assets.dispose();
});

it('keeps the first barrel sweep so a thin wall still blocks the aligned shot', () => {
  const player = new Player(100, 44), collision = new CollisionSystem(), pool = new ProjectileManager(collision);
  player.grounded = true;
  player.updateCombat(1 / 60, { left: false, right: false, up: false, down: false, jumpPressed: false, shoot: true }, pool);
  expect(pool.activeCount).toBe(1);
  pool.update(0, [{ x: 113, y: 50, width: 1, height: 20 }], 500);
  expect(pool.activeCount).toBe(0);
});

it('keeps the pooled flash and its temporary light on a moving muzzle until expiration or death', () => {
  const assets = new AssetManager({}), lights = new LightingSystem(); lights.enabled = true;
  const fx = new FxSpritePool(assets, undefined, undefined, 1);
  fx.onSpawn = (id, x, y, source) => lights.onVfx(id, x, y, source);
  const source = { position: { x: 100, y: 80 }, angle: 0, active: true };
  fx.spawn('fx.muzzle.rifle', 100, 80, 0, source);
  const root = fx.root.children[0]!, light = lights.slots.find(s => s.active)!;
  // Match the runtime order: age lights, move Player, update VFX, sync/render.
  lights.update(1 / 60); source.position.x += 3; source.position.y += 2;
  fx.update(1 / 60); lights.syncAttached();
  expect(root.position.x).toBe(103); expect(root.position.y).toBe(82);
  expect(light.x).toBe(103); expect(light.y).toBe(82); expect(light.life).toBeCloseTo(.06 - 1 / 60);
  source.active = false; fx.update(1 / 60); lights.syncAttached();
  expect(root.visible).toBe(false); expect(lights.temporaryCount).toBe(0);
  source.active = true; fx.spawn('fx.muzzle.rifle', 103, 82, 0, source);
  expect(fx.root.children[0]).toBe(root);
  fx.update(.1); lights.update(.1);
  expect(fx.activeCount).toBe(0); expect(lights.temporaryCount).toBe(0);
  // A reused slot must not make a later, fixed explosion follow the Player.
  fx.spawn('fx.explosion.small', 20, 30); source.position.x = 500;
  fx.update(.01); lights.update(.01);
  expect(root.position.x).toBe(20); expect(lights.slots.find(s => s.active)!.x).toBe(20);
  fx.clear(); lights.clear();
  expect(lights.slots.every(s => s.source === undefined)).toBe(true);
  fx.dispose(); lights.dispose(); assets.dispose();
});
