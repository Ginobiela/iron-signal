import { afterEach, expect, it, vi } from 'vitest';
import { Texture, TextureLoader } from 'three';
import type { Group } from 'three';
import { ASSETS } from '../src/config/assets';
import { AssetManager } from '../src/core/AssetManager';
import { Player } from '../src/entities/Player';
import { playerAimName } from '../src/entities/playerAim';
import { PlayerView } from '../src/rendering/PlayerView';
import type { SpriteVisual } from '../src/rendering/SpriteVisual';
import { resolvePlayerSprite } from '../src/rendering/playerAnimation';
import { playerMuzzle } from '../src/rendering/vfxOrigins';
import { discoverAnimations, assetStatus } from '../src/devtools/animationViewerRegistry';

afterEach(() => vi.restoreAllMocks());
const supplied = ['player.aim_down','player.aim_diagonalDown','player.jumpShoot_down','player.jumpShoot_diagonalDown'];
it('loads all four supplied lower aim clips at unchanged world size and exposes them to the viewer', async () => {
  const manifest = Object.fromEntries(supplied.map(id => [id,ASSETS[id]!]));
  const load = vi.spyOn(TextureLoader.prototype,'loadAsync').mockResolvedValue(new Texture({width:128,height:64} as HTMLImageElement));
  const assets = new AssetManager(manifest); await assets.preload();
  expect(load).toHaveBeenCalledTimes(4);
  expect(discoverAnimations(manifest)[0]!.animations.map(animation=>animation.id)).toEqual(supplied);
  for (const asset of Object.values(manifest)) {
    expect(asset.url).toBe(asset.path); expect(assetStatus(asset,true)).toBe('LOADED');
    expect(asset.sheet).toMatchObject({frameWidth:64,frameHeight:64});
    expect(asset.visual).toMatchObject({width:32,height:32,anchor:'bottom-center'});
  }
  assets.dispose();
});

it.each([false,true])('resolves lower poses with/without fire (%s) and uses a rotating gun fallback', async shooting => {
  const player = new Player(100,100); player.shooting = shooting; player.grounded = false;
  const assets = new AssetManager({}); const view = new PlayerView(assets);
  const internal = view as unknown as { gun: Group; silhouette: Group; sprite: SpriteVisual };
  for (const diagonal of [false,true]) for (const facing of [1,-1] as const) {
    player.direction=facing;
    player.aimDirection.x=diagonal?facing*Math.SQRT1_2:0; player.aimDirection.y=diagonal?-Math.SQRT1_2:-1;
    const before={...player.position}, fire=vi.spyOn(player.weapon,'fire');
    view.update(player,1/60);
    const pose=diagonal?'diagonalDown':'down';
    expect(resolvePlayerSprite(view.animation,player.aimDirection)).toBe(`player.${shooting?'jumpShoot':'aim'}_${pose}`);
    expect(internal.silhouette.visible).toBe(true); expect(internal.gun.visible).toBe(true);
    expect(internal.gun.rotation.z).toBe(Math.atan2(player.aimDirection.y,player.aimDirection.x));
    expect(internal.sprite.mesh.scale.y).toBeGreaterThan(0); expect(player.position).toEqual(before); expect(fire).not.toHaveBeenCalled();
    const tip={x:0,y:0,angle:0}; playerMuzzle(player,assets,tip);
    expect(tip.x).toBeCloseTo(player.projectileOriginX+player.aimDirection.x*player.muzzleDistance);
    expect(tip.y).toBeCloseTo(player.projectileOriginY+player.aimDirection.y*player.muzzleDistance);
    expect(playerAimName(player.aimDirection)).toBe(diagonal?`${facing===1?'RIGHT':'LEFT'}_DOWN`:'DOWN');
    fire.mockRestore();
  }
  view.dispose(); assets.dispose();
});

it('uses the supplied lower PNG with flipX and hides the primitive gun', async () => {
  vi.spyOn(TextureLoader.prototype,'loadAsync').mockResolvedValue(new Texture({width:64,height:64} as HTMLImageElement));
  const id='player.aim_diagonalDown';
  const assets=new AssetManager({[id]:ASSETS[id]!}); await assets.preload();
  const player=new Player(100,100),view=new PlayerView(assets);
  player.direction=-1; player.aimDirection.x=-Math.SQRT1_2; player.aimDirection.y=-Math.SQRT1_2;
  view.update(player,0);
  const internal=view as unknown as {gun:Group; sprite:SpriteVisual};
  expect(internal.sprite.assetId).toBe(id); expect(internal.sprite.mesh.scale.x).toBe(-32);
  expect(internal.sprite.mesh.scale.y).toBe(32); expect(internal.gun.visible).toBe(false);
  view.dispose(); assets.dispose();
});

it.each([1,-1] as const)('places loaded lower muzzle flashes at baked rifle tips facing %s without moving projectile origins', async facing => {
  vi.spyOn(TextureLoader.prototype,'loadAsync').mockResolvedValue(new Texture({width:128,height:64} as HTMLImageElement));
  const assets=new AssetManager(Object.fromEntries(supplied.map(id=>[id,ASSETS[id]!]))); await assets.preload();
  const player=new Player(100,100); player.direction=facing;
  for (const diagonal of [false,true]) {
    player.aimDirection.x=diagonal?facing*Math.SQRT1_2:0;
    player.aimDirection.y=diagonal?-Math.SQRT1_2:-1;
    const origin={x:player.projectileOriginX,y:player.projectileOriginY};
    const tip={x:0,y:0,angle:0}; playerMuzzle(player,assets,tip);
    expect(tip.x).toBe(106+(diagonal?14:8)*facing);
    expect(tip.y).toBe(100+(diagonal?7:4));
    expect(tip.angle).toBe(Math.atan2(player.aimDirection.y,player.aimDirection.x));
    expect({x:player.projectileOriginX,y:player.projectileOriginY}).toEqual(origin);
  }
  assets.dispose();
});
