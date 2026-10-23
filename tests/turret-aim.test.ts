import { afterEach, expect, it, vi } from 'vitest';
import { Texture, TextureLoader, Vector3 } from 'three';
import type { Group } from 'three';
import { ASSETS } from '../src/config/assets';
import { TURRET_ART, turretAimAngle } from '../src/config/turretArt';
import { AssetManager } from '../src/core/AssetManager';
import { Turret } from '../src/entities/enemies/Turret';
import { GateTurret } from '../src/entities/enemies/GateTurret';
import { TurretAimVisual } from '../src/rendering/TurretAimVisual';
import { EnemyView } from '../src/rendering/EnemyView';
import { enemyMuzzle } from '../src/rendering/vfxOrigins';
import { discoverAnimations } from '../src/devtools/animationViewerRegistry';

afterEach(() => vi.restoreAllMocks());

it.each(['turret', 'bossGateTurret'] as const)('%s rotates only the head in eight directions, sharing textures and matching muzzle tips', async prefix => {
  const manifest = Object.fromEntries(Object.entries(ASSETS).filter(([id]) => id.startsWith(`${prefix}.`)));
  const load = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async url => {
    const asset = Object.values(manifest).find(a => a.url === url && !a.internal)!;
    return new Texture({ width: asset.sheet.frameWidth * asset.sheet.frameCount, height: asset.sheet.frameHeight } as HTMLImageElement);
  });
  const assets = new AssetManager(manifest); await assets.preload(); expect(load).toHaveBeenCalledTimes(3);
  const visual = new TurretAimVisual(assets, prefix), enemy = prefix === 'turret' ? new Turret(120, 44) : new GateTurret(120, 44);
  visual.root.position.set(130, 44, 0);
  const position = { ...enemy.position }, timer = enemy.attackTimer, health = enemy.health;
  for (const animation of ['idle', prefix === 'turret' ? 'shoot' : 'fire']) for (let sector = 0; sector < 8; sector++) for (const facing of [1, -1] as const) {
    const angle = sector * Math.PI / 4;
    const aim = { x: Math.cos(angle + .1), y: Math.sin(angle + .1) };
    enemy.aimDirection.x = aim.x; enemy.aimDirection.y = aim.y; enemy.direction = facing;
    expect(visual.update(animation, .12, aim, facing)).toBe(true);
    visual.root.updateMatrixWorld(true);
    const origin = visual.pivot.getWorldPosition(new Vector3());
    const forward = visual.pivot.localToWorld(new Vector3(1, 0, 0)).sub(origin).normalize();
    expect(forward.x).toBeCloseTo(Math.cos(angle)); expect(forward.y).toBeCloseTo(Math.sin(angle));
    expect(visual.root.rotation.z).toBe(0); expect(visual.base.root.rotation.z).toBe(0);
    expect(visual.base.mesh.position.y - visual.base.mesh.scale.y / 2).toBe(0);
    expect(visual.head.assetId).toBe(`${prefix}.parts.${animation}.head`);
    expect(assets.getTexture(visual.head.assetId)).toBe(assets.getTexture(`${prefix}.${animation}`));
    const muzzle = { x: 0, y: 0, angle: 0 }; enemyMuzzle(enemy, assets, muzzle);
    const distance = TURRET_ART[prefix].muzzleLength / 2;
    expect(muzzle.x).toBeCloseTo(origin.x + forward.x * distance);
    expect(muzzle.y).toBeCloseTo(origin.y + forward.y * distance);
    expect(Math.cos(muzzle.angle)).toBeCloseTo(Math.cos(angle));
    expect(enemy.aimDirection).toEqual(aim); expect(enemy.position).toEqual(position);
    expect(enemy.attackTimer).toBe(timer); expect(enemy.health).toBe(health); expect(enemy.visualFireCount).toBe(0);
  }
  expect(discoverAnimations(manifest)[0]!.animations.map(a => a.id)).toEqual(Object.keys(manifest).filter(id => !manifest[id]!.internal));
  visual.dispose(); assets.dispose();
});

it('selects the nearest sector at the wraparound and sector boundaries', () => {
  for (const [degrees, expected] of [[0, 0], [22, 0], [23, 45], [-23, -45], [179, 180], [-179, -180], [89, 90], [-89, -90]]) {
    const angle = degrees! * Math.PI / 180;
    expect(turretAimAngle({ x: Math.cos(angle), y: Math.sin(angle) })).toBeCloseTo(expected! * Math.PI / 180);
  }
});

it('keeps the existing primitive fallback if art is unavailable and hides it on death', () => {
  const assets = new AssetManager({}), enemy = new Turret(120, 44); enemy.active = true;
  const view = new EnemyView(enemy, assets);
  enemy.aimDirection.x = Math.SQRT1_2; enemy.aimDirection.y = -Math.SQRT1_2;
  view.update(0); expect(view.root.visible).toBe(true);
  const internal = view as unknown as { turretAim: TurretAimVisual; gun: Group };
  expect(internal.turretAim.root.visible).toBe(false); expect(internal.gun.visible).toBe(true);
  enemy.die(); view.update(0); expect(view.root.visible).toBe(false);
  view.dispose(); assets.dispose();
});
