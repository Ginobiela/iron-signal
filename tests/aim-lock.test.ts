import { expect, it } from 'vitest';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { CombatSystem } from '../src/collision/CombatSystem';
import { PLAYER, TIMING } from '../src/config/constants';
import { Player } from '../src/entities/Player';
import type { PlayerControls } from '../src/entities/Player';
import { Soldier } from '../src/entities/enemies/Soldier';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { Rifle } from '../src/weapons/Rifle';
import { MachineGun } from '../src/weapons/MachineGun';
import { SpreadGun } from '../src/weapons/SpreadGun';
import { Laser } from '../src/weapons/Laser';
import { resolvePlayerSprite } from '../src/rendering/playerAnimation';

const dt = TIMING.fixedStep;
const idle: PlayerControls = {left:false,right:false,up:false,down:false,jumpPressed:false,shoot:false};
function setup() {
  const collision = new CollisionSystem(), player = new Player(110,108), pool = new ProjectileManager(collision);
  const floor = [{x:0,y:0,width:500,height:20}], platforms = [{x:80,y:100,width:100,height:8}];
  const update = (input: PlayerControls) => { player.update(dt,input,collision,floor,500,platforms); player.updateCombat(dt,input,pool); };
  update(idle);
  return {player,pool,update,collision,floor};
}

it.each([-1,0,1])('holds platform position and continuously aims down with horizontal axis %s without firing', axis => {
  const {player,pool,update} = setup(), start = {...player.position};
  const input = {...idle,aimLock:true,down:true,left:axis<0,right:axis>0};
  for(let i=0;i<60;i++) update(input);
  expect(player.position).toEqual(start); expect(player.velocity.x).toBe(0);
  expect(player.grounded).toBe(true); expect(player.onOneWay).toBe(true); expect(player.crouching).toBe(false);
  expect(player.height).toBe(PLAYER.height);
  expect(player.aimDirection).toEqual({x:axis*Math.SQRT1_2,y:axis ? -Math.SQRT1_2 : -1});
  expect(pool.playerSpawned).toBe(0); expect(player.shooting).toBe(false);
  const pose=axis?'diagonalDown':'down';
  expect(resolvePlayerSprite('idle',player.aimDirection)).toBe(`player.aim_${pose}`);
  expect(resolvePlayerSprite('shoot',player.aimDirection)).toBe(`player.jumpShoot_${pose}`);
});

it.each([Rifle,MachineGun,SpreadGun,Laser])('%s fires downward from a platform using its existing cadence and pool', Weapon => {
  const {player,pool,update}=setup(); player.weapon=new Weapon();
  update({...idle,aimLock:true,down:true,shoot:true});
  expect(pool.playerSpawned).toBe(Weapon===SpreadGun?5:1);
  expect(player.grounded).toBe(true); expect(player.jumpCount).toBe(0);
  for(const shot of pool.items.filter(p=>p.active)) {
    expect(shot.velocity.y).toBeLessThan(0);
    expect(Math.hypot(shot.velocity.x,shot.velocity.y)).toBeCloseTo(player.weapon.projectileSpeed);
  }
  const count=pool.playerSpawned; update({...idle,aimLock:true,down:true,shoot:true});
  expect(pool.playerSpawned).toBe(count);
});

it('releasing position hold restores running, normal crouch and one-way drop-through', () => {
  const {player,update}=setup();
  update({...idle,aimLock:true,right:true}); expect(player.velocity.x).toBe(0);
  update({...idle,right:true}); expect(player.velocity.x).toBe(PLAYER.speed);
  update({...idle,aimLock:true,down:true}); expect(player.crouching).toBe(false);
  update({...idle,down:true,shoot:true}); expect(player.crouching).toBe(true);
  expect(player.aimDirection).toEqual({x:1,y:0});
  update({...idle,down:true,jumpPressed:true}); expect(player.grounded).toBe(false);
  expect(player.position.y).toBeLessThan(108);
});

it('position hold does not suspend gravity, disable jumps or permit firing after death', () => {
  const {player,update,pool}=setup();
  update({...idle,aimLock:true,down:true,jumpPressed:true});
  expect(player.jumpCount).toBe(1); expect(player.velocity.y).toBeGreaterThan(0);
  const vy=player.velocity.y; update({...idle,aimLock:true,down:true});
  expect(player.velocity.y).toBeLessThan(vy);
  player.die(); update({...idle,aimLock:true,shoot:true,down:true});
  expect(pool.playerSpawned).toBe(0);
});

it('downward fire hits an enemy below the supporting platform through normal combat', () => {
  const {player,pool,update,collision,floor}=setup(), enemy=new Soldier(124,44);
  enemy.active=true; const hp=enemy.health, combat=new CombatSystem(collision,player,[enemy]);
  update({...idle,aimLock:true,down:true,shoot:true});
  pool.update(.3,floor,500,combat);
  expect(enemy.health).toBe(hp-player.weapon.damage);
  expect(player.position.y).toBe(108); expect(player.onOneWay).toBe(true);
});
