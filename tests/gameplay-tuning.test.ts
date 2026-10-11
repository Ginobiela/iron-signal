import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAMEPLAY_CONFIG as defaults, GAMEPLAY_SETTINGS, GameplayConfigStore, parseTuningPreset, settingValue } from '../src/config/gameplay';
import { DEV_TOOLS } from '../src/config/devtools';
import { PLAYER, ENEMIES, BOSS, GAMEPLAY, RIFLE, SPREAD_GUN, PROJECTILES } from '../src/config/constants';
import { Player } from '../src/entities/Player';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { CombatSystem } from '../src/collision/CombatSystem';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { Rifle } from '../src/weapons/Rifle';
import { MachineGun } from '../src/weapons/MachineGun';
import { SpreadGun } from '../src/weapons/SpreadGun';
import { Laser } from '../src/weapons/Laser';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { Boss } from '../src/bosses/Boss';
import { WeaponPickup } from '../src/entities/WeaponPickup';
import { PowerupManager } from '../src/level/PowerupManager';
import { GameStateManager } from '../src/core/GameStateManager';
import { CameraController } from '../src/camera/CameraController';
import { ScreenShakeManager } from '../src/camera/ScreenShakeManager';
import { BUILTIN_PRESETS } from '../src/devtools/gameplayPresets';

const idle = { left: false, right: false, up: false, down: false, shoot: false, jumpPressed: false };
const collision = new CollisionSystem(), floor = { x: 0, y: 0, width: 1024, height: 44 };
afterEach(() => vi.unstubAllGlobals());

describe('canonical defaults and isolated overrides', () => {
  it('preserves every legacy default and freezes nested values', () => {
    expect(defaults.player).toEqual(PLAYER); expect(defaults.enemies).toEqual(ENEMIES);
    expect(defaults.boss).toEqual(BOSS); expect(defaults.game).toEqual(GAMEPLAY);
    expect(defaults.weapons.rifle).toMatchObject(RIFLE);
    expect(Object.isFrozen(defaults)).toBe(true); expect(Object.isFrozen(defaults.weapons.spread.angles)).toBe(true);
    expect(() => { (defaults.player as { speed: number }).speed = 500; }).toThrow();
  });
  it('never reads browser storage in default constructors, even with extreme persisted tuning', () => {
    const read = vi.fn(() => JSON.stringify({ version: 1, name: 'Extreme', overrides: { 'player.gravity': 2000 } }));
    vi.stubGlobal('localStorage', { getItem: read }); vi.stubGlobal('sessionStorage', { getItem: read });
    const experiment = new GameplayConfigStore(); experiment.setOverride('player.gravity', 2000);
    const player = new Player(62, 120); player.update(.01, idle, collision, [], 1024);
    expect(player.velocity.y).toBe(-defaults.player.gravity * .01);
    expect(new GameplayConfigStore().get()).toBe(defaults); expect(new Rifle().fireRate).toBe(defaults.weapons.rifle.fireRate);
    expect(new GameStateManager().lives).toBe(defaults.game.initialLives);
    expect(read).not.toHaveBeenCalled(); expect(DEV_TOOLS).toBe(false);
  });
  it('resets property/section/all, notifies only committed values, and stores only differences', () => {
    const store = new GameplayConfigStore(), changed = vi.fn(), off = store.subscribe(changed);
    store.setOverride('player.speed', 120); store.setOverride('weapons.rifle.damage', 5);
    expect(defaults.player.speed).toBe(PLAYER.speed); expect(store.preset('Fast').overrides).toEqual({ 'player.speed': 120, 'weapons.rifle.damage': 5 });
    store.resetSection('PLAYER'); expect(store.get().player.speed).toBe(defaults.player.speed);
    store.resetOverride('weapons.rifle.damage'); expect(store.getOverrides()).toEqual({});
    store.setOverride('player.speed', defaults.player.speed); expect(store.getOverrides()).toEqual({});
    store.resetAll(); expect(store.get()).toEqual(defaults); expect(changed).toHaveBeenCalledTimes(6);
    off(); store.resetAll(); expect(changed).toHaveBeenCalledTimes(6);
  });
  it('validates all built-in presets and every metadata default', () => {
    for (const preset of BUILTIN_PRESETS) expect(parseTuningPreset(preset)).toEqual(preset);
    for (const setting of GAMEPLAY_SETTINGS) {
      const store = new GameplayConfigStore(); store.setOverride(setting.path, settingValue(defaults, setting.path));
      expect(store.get()).toEqual(defaults);
    }
  });
  it.each([NaN, Infinity, -1, 0, 2001, '600', null, [], {}])('rejects invalid gravity %s atomically', value => {
    const store = new GameplayConfigStore(); store.setOverride('player.speed', 120);
    expect(() => store.replace({ 'player.gravity': value as number })).toThrow();
    expect(store.getOverrides()).toEqual({ 'player.speed': 120 });
  });
  it('rejects unknown paths, invalid versions, integer health and impossible phases', () => {
    for (const overrides of [{ '__proto__.polluted': 1 }, { 'player.maxHealth': 1.5 }, { 'weapons.rifle.projectileSpeed': 0 },
      { 'boss.phase2Threshold': .2 }, { 'powerups.lifetime': 1 }, { 'weapons.spread.angles': [] },
      { 'weapons.spread.angles': [0,0] }, { 'weapons.spread.angles': [10,-10] }, { 'weapons.spread.angles': [100] }]) {
      expect(() => parseTuningPreset({ version: 1, name: 'Bad', overrides })).toThrow();
    }
    expect(() => parseTuningPreset({ version: 2, name: 'Future', overrides: {} })).toThrow();
    expect(() => parseTuningPreset({ version: 1, name: '', overrides: {} })).toThrow();
    expect(() => parseTuningPreset({ version: 1, name: 'Bad', overrides: [] })).toThrow();
  });
});

describe('runtime consumers', () => {
  it('changes player motion/gravity/jump live without modifying colliders or curing health', () => {
    const store = new GameplayConfigStore(), player = new Player(62,44,store);
    store.setOverride('player.maxHealth', 10); expect(player.health).toBe(PLAYER.maxHealth);
    store.setOverride('player.speed', 120); player.update(.01, { ...idle, right:true }, collision,[floor],1024);
    expect(player.velocity.x).toBe(120); expect(player.width).toBe(PLAYER.width); expect(player.height).toBe(PLAYER.height);
    store.setOverride('player.gravity',300); store.setOverride('player.jumpSpeed',300);
    player.update(.01,{...idle,jumpPressed:true},collision,[floor],1024); expect(player.velocity.y).toBe(297);
    player.health=10; store.resetAll(); player.update(.01,idle,collision,[floor],1024); expect(player.health).toBe(defaults.player.maxHealth);
  });
  it.each([['rifle',Rifle],['machineGun',MachineGun],['spread',SpreadGun],['laser',Laser]] as const)('uses live %s settings only for new volleys', (key, Weapon) => {
    const store = new GameplayConfigStore(), weapon = new Weapon(store), pool = new ProjectileManager(collision);
    expect(weapon.fire(pool,100,100,{x:1,y:0},'player')).toBe(true);
    const old = { speed: Math.hypot(pool.items[0]!.velocity.x,pool.items[0]!.velocity.y), lifetime:pool.items[0]!.lifeRemaining, damage:pool.items[0]!.damage };
    store.replace({ [`weapons.${key}.damage`]: 7,[`weapons.${key}.projectileSpeed`]: 500,[`weapons.${key}.projectileLifetime`]: 4,[`weapons.${key}.fireRate`]: 20 });
    weapon.update(10); expect(weapon.fire(pool,100,100,{x:1,y:0},'player')).toBe(true);
    const last = pool.items.filter(item=>item.active).at(-1)!;
    expect(Math.hypot(last.velocity.x,last.velocity.y)).toBeCloseTo(500); expect(last.damage).toBe(7); expect(last.lifeRemaining).toBe(4);
    expect(pool.items[0]!.damage).toBe(old.damage); expect(pool.items[0]!.lifeRemaining).toBe(old.lifetime);
    expect(Math.hypot(pool.items[0]!.velocity.x,pool.items[0]!.velocity.y)).toBeCloseTo(old.speed);
    weapon.update(.05); expect(weapon.fire(pool,100,100,{x:1,y:0},'player')).toBe(true);
    store.resetAll(); expect(weapon.fireRate).toBe(defaults.weapons[key].fireRate);
  });
  it('updates Spread rotation cache and never emits partial volleys', () => {
    const store = new GameplayConfigStore(), weapon = new SpreadGun(store), pool = new ProjectileManager(collision,3);
    store.setOverride('weapons.spread.angles',[-45,0,45]);
    expect(weapon.fire(pool,50,50,{x:1,y:0},'player')).toBe(true); expect(pool.activeCount).toBe(3);
    expect(pool.items[0]!.velocity.y).toBeCloseTo(-SPREAD_GUN.projectileSpeed*Math.SQRT1_2);
    weapon.update(10); pool.deactivate(pool.items[0]!);
    expect(weapon.fire(pool,50,50,{x:1,y:0},'player')).toBe(false); expect(pool.activeCount).toBe(2);
  });
  it('keeps enemy projectile lifetime independent of Rifle overrides', () => {
    const store = new GameplayConfigStore(); store.setOverride('weapons.rifle.projectileLifetime', 8);
    const pool = new ProjectileManager(collision);
    new Rifle(store).fire(pool,50,50,{x:1,y:0},'player');
    pool.spawn(100,100,-100,0,1,'enemy');
    expect(pool.items[0]!.lifeRemaining).toBe(8);
    expect(pool.items[1]!.lifeRemaining).toBe(PROJECTILES.lifetime);
  });
  it('updates enemy speed live and health only on spawn/reset', () => {
    const store = new GameplayConfigStore(), enemies = new EnemyManager(store);
    const runner = enemies.spawn({kind:'runner',x:100,y:44});
    const context = { player:new Player(10,44), projectiles:new ProjectileManager(collision),collision,solids:[floor],worldWidth:1024 };
    store.setOverride('enemies.runner.speed',20); store.setOverride('enemies.runner.health',9);
    runner.update(.01,context); expect(runner.velocity.x).toBe(-20); expect(runner.health).toBe(ENEMIES.runner.health);
    runner.reset(); expect(runner.health).toBe(9);
    for (const kind of ['soldier','turret','flying'] as const) {
      store.setOverride(`enemies.${kind}.health`,12); expect(enemies.spawn({kind,x:100,y:44}).health).toBe(12);
    }
  });
  it('uses enemy damage/cadence/projectile speed from the same source', () => {
    const store = new GameplayConfigStore(); store.replace({ 'enemies.soldier.attackInterval':.2,'enemies.soldier.bulletSpeed':300,'enemies.bulletDamage':3,'enemies.contactDamage':4 });
    const enemies = new EnemyManager(store), soldier = enemies.spawn({kind:'soldier',x:150,y:44});
    const player = new Player(10,44,store), pool = new ProjectileManager(collision);
    const context = {player,projectiles:pool,collision,solids:[floor],worldWidth:1024};
    soldier.update(1,context); expect(pool.activeCount).toBe(1);
    expect(Math.hypot(pool.items[0]!.velocity.x,pool.items[0]!.velocity.y)).toBeCloseTo(300); expect(pool.items[0]!.damage).toBe(3);
    soldier.update(.2,context); expect(pool.activeCount).toBe(2);
    store.setOverride('player.maxHealth',10); player.health=10; soldier.position.x=player.position.x;
    new CombatSystem(collision,player,enemies.items,undefined,undefined,undefined,store).updateContacts(); expect(player.health).toBe(6);
  });
  it('applies boss health at restart and thresholds/timers on the next event', () => {
    const store = new GameplayConfigStore(), boss = new Boss({x:200,y:44,arenaLeft:0},store);
    store.setOverride('boss.health',200); expect(boss.health).toBe(BOSS.health); boss.reset(); expect(boss.maxHealth).toBe(200);
    store.setOverride('boss.introTime',2); boss.activate(0); expect(boss.attackTimer).toBe(2);
    store.setOverride('boss.phase2Threshold',.9); boss.state='RECOVER'; boss.takeDamage(25); expect(boss.phase).toBe(2);
  });
  it('applies pickup lifetime only to new drops and preserves weapon config after collection', () => {
    const store = new GameplayConfigStore(), pickup = new WeaponPickup(store); pickup.spawn('M',100,44);
    const old = pickup.lifeRemaining; store.setOverride('powerups.lifetime',20); expect(pickup.lifeRemaining).toBe(old);
    pickup.spawn('M',100,44); expect(pickup.lifeRemaining).toBe(20); store.setOverride('powerups.warningTime',5); expect(pickup.warningTime).toBe(5);
    const manager = new PowerupManager(collision,1,store), player = new Player(62,44,store);
    manager.spawn('M',62,44); manager.update(.01,player,[floor],[],1024); store.setOverride('weapons.machineGun.fireRate',25); expect(player.weapon.fireRate).toBe(25);
  });
  it('changes lives only at restart and camera/shake live', () => {
    const store = new GameplayConfigStore(), states = new GameStateManager(store); states.ready(); states.start();
    store.setOverride('game.initialLives',20); expect(states.lives).toBe(GAMEPLAY.initialLives); states.restart(); expect(states.lives).toBe(20);
    const camera = new CameraController(1024,store); camera.update(200); const previous = camera.x;
    store.setOverride('camera.deadZone',0); camera.x=0; camera.update(200); expect(camera.x).toBeGreaterThan(previous);
    const shake = new ScreenShakeManager(store); shake.trigger(2); store.setOverride('feedback.shakeLimit',0); shake.update(.01); expect(Math.abs(shake.offset.x)+Math.abs(shake.offset.y)).toBe(0);
  });
});
