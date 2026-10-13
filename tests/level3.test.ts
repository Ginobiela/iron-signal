import { expect, it, vi } from 'vitest';
import json from '../public/levels/level-03.json';
import { parseLevel, validateLevel } from '../src/level/LevelDocument';
import { Level } from '../src/level/Level';
import { CameraController } from '../src/camera/CameraController';
import type { CameraZone } from '../src/camera/CameraZone';
import { Player } from '../src/entities/Player';
import { CheckpointManager } from '../src/level/Checkpoint';
import { EnemySpawner } from '../src/level/EnemySpawner';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { CombatSystem } from '../src/collision/CombatSystem';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { FortifiedGateBoss } from '../src/bosses/FortifiedGateBoss';
import { LevelEditorModel } from '../src/devtools/levelEditorModel';

const zones:CameraZone[]=[{id:'h',x:0,y:0,width:256,height:240,mode:'HORIZONTAL_FOLLOW'},
  {id:'v',x:256,y:0,width:256,height:1000,mode:'VERTICAL_FOLLOW'},
  {id:'upper',x:256,y:800,width:512,height:200,mode:'HORIZONTAL_FOLLOW'},
  {id:'lock',x:768,y:800,width:256,height:240,mode:'LOCKED'}];
it('reuses dead hatch dogs with fresh health and positions without accumulating instances',()=>{
 const enemies=new EnemyManager();const first=enemies.spawn({kind:'robotDog',x:100,y:500});
 for(let i=0;i<100;i++){
  first.bossOwned=true;first.takeDamage(first.health);
  const next=enemies.spawn({kind:'robotDog',x:200+i,y:700});
  expect(next).toBe(first);expect(next.bossOwned).toBe(false);expect(next.health).toBe(next.maxHealth);
  expect(next.position).toEqual({x:200+i,y:700});
 }
 expect(enemies.items).toHaveLength(1);
});
it('loads tall Level 3 data, route sections, 2D triggers and exit independently of X progress',()=>{
 const data=parseLevel(json);expect(validateLevel(data).errors).toEqual([]);expect(data.height).toBe(1600);
 expect(data.spawn).toMatchObject({x:48,y:44});expect(data.boss.kind).toBe('gate');expect(data.nextLevel).toBeUndefined();
 expect(data.cameraZones).toHaveLength(6);expect(data.checkpoints.every(cp=>cp.area&&cp.order)).toBe(true);
 expect(new Level(data).sectionAt(1150,900)).toBe('Ascenso del reactor');
 const p=new Player(2010,1356);p.grounded=true;expect(new Level(data).reachedExit(p)).toBe(true);
 p.position.y=44;expect(new Level(data).reachedExit(p)).toBe(false);
});
it('follows vertically inside world bounds and changes orientation smoothly on entering the upper corridor',()=>{
 const camera=new CameraController(1024,undefined,1200,zones);camera.reset(400,200);
 expect(camera.mode).toBe('VERTICAL_FOLLOW');
 for(let y=200;y<800;y+=2)camera.update(400,y);
 const before=camera.y;camera.update(400,801);
 expect(camera.mode).toBe('HORIZONTAL_FOLLOW');expect(camera.y-before).toBeLessThanOrEqual(10);
 for(let i=0;i<60;i++)camera.update(400,850);
 expect(camera.y).toBeCloseTo(800);
 camera.update(800,850);expect(camera.mode).toBe('LOCKED');
 for(let i=0;i<60;i++)camera.update(800,850);
 expect(camera.x).toBe(768);expect(camera.y).toBe(800);
});
it('transitions horizontal to vertical without losing the player, and clamps high/edge coordinates',()=>{
 const camera=new CameraController(1024,undefined,1200,zones);camera.reset(240,120);
 camera.update(260,130);expect(camera.mode).toBe('VERTICAL_FOLLOW');
 expect(260-camera.x).toBeGreaterThan(0);expect(260-camera.x).toBeLessThan(256);
 for(let y=130;y<799;y+=3)camera.update(400,y);
 expect(camera.y).toBeGreaterThan(500);expect(camera.y).toBeLessThanOrEqual(960);
 camera.reset(400,700);expect(camera.y).toBeGreaterThan(500);
 const legacy=new CameraController(9600);legacy.update(620);expect(legacy.y).toBe(0);
});
it('keeps checkpoints ordered by declared progression when a later checkpoint has a smaller X',()=>{
 const manager=new CheckpointManager({x:0,y:44,name:'Start'},[
  {id:'one',x:600,y:100,name:'One',order:1,area:{x:590,y:98,width:40,height:40}},
  {id:'two',x:300,y:500,name:'Two',order:2,area:{x:290,y:498,width:40,height:40}}]);
 const p=new Player(600,100);p.grounded=true;manager.update(0,p);expect(manager.current.name).toBe('One');
 p.position.x=300;p.position.y=500;manager.update(0,p);expect(manager.current.name).toBe('Two');
 p.position.x=600;p.position.y=100;manager.update(0,p);expect(manager.current.name).toBe('Two');
 p.respawn(manager.current.x,manager.current.y);expect(p.position).toEqual({x:300,y:500});
});
it('fires 2D triggers only on overlap and rewinds future triggers to the checkpoint snapshot',()=>{
 const spawn=vi.fn(),spawner=new EnemySpawner([
  {x:100,y:300,width:80,height:80,enemies:[{kind:'robotDog',x:120,y:310}]},
  {x:100,y:700,width:80,height:80,enemies:[{kind:'turret',x:120,y:710}]}],spawn);
 spawner.update(1000,{x:100,y:44,width:12,height:26});expect(spawn).not.toHaveBeenCalled();
 spawner.update(0,{x:110,y:310,width:12,height:26});expect(spawn).toHaveBeenCalledTimes(1);
 spawner.captureCheckpoint({x:200,y:400,width:12,height:26});
 spawner.update(0,{x:110,y:710,width:12,height:26});expect(spawn).toHaveBeenCalledTimes(2);
 spawner.rewind(999);spawner.update(0,{x:110,y:710,width:12,height:26});expect(spawn).toHaveBeenCalledTimes(3);
 spawner.update(0,{x:110,y:310,width:12,height:26});expect(spawn).toHaveBeenCalledTimes(3);
});
it('activates elevated enemies by camera XY and retains projectiles above the old 240-unit height',()=>{
 const enemies=new EnemyManager(),turret=enemies.spawn({kind:'turret',x:100,y:700});
 const collision=new CollisionSystem(),player=new Player(50,700),pool=new ProjectileManager(collision);
 const ctx={player,collision,projectiles:pool,solids:[],worldWidth:1024};
 enemies.update(1,ctx,0,0);expect(pool.enemySpawned).toBe(0);
 enemies.update(1,ctx,0,600);expect(pool.enemySpawned).toBe(1);expect(turret.alive).toBe(true);
 pool.update(.1,[],1024,undefined,undefined,1600);expect(pool.activeCount).toBe(1);
});
it('routes projectiles to independent gate turrets before making the central gate vulnerable',()=>{
 const boss=new FortifiedGateBoss(parseLevel(json).boss),player=new Player(1820,1356),collision=new CollisionSystem(),killed=vi.fn();
 boss.activate(1800,1360);const combat=new CombatSystem(collision,player,[],killed,boss),pool=new ProjectileManager(collision);
 for(const part of boss.turrets){pool.spawn(part.position.x+2,part.position.y+18,0,0,part.health,'player');pool.update(.01,[],2048,combat,undefined,1600);}
 expect(killed).toHaveBeenCalledTimes(2);expect(boss.vulnerable).toBe(true);expect(boss.health).toBe(boss.maxHealth);
 pool.spawn(boss.position.x+4,boss.position.y+20,0,0,boss.health,'player');pool.update(.01,[],2048,combat,undefined,1600);
 expect(boss.alive).toBe(false);expect(killed).toHaveBeenCalledTimes(3);
});
it('edits, moves, duplicates, deletes and undoes rectangular camera zones and elevated checkpoints',()=>{
 const model=new LevelEditorModel(parseLevel(json)),zone=model.objects().find(o=>o.type==='cameraZone')!;
 model.selection.add(zone.id);model.move(16,32);expect(model.data.cameraZones![0]!.y).toBe(32);model.undo();
 model.duplicate();expect(model.data.cameraZones).toHaveLength(7);model.deleteSelection();expect(model.data.cameraZones).toHaveLength(6);model.undo();expect(model.data.cameraZones).toHaveLength(7);
 const cp=model.objects().find(o=>o.type==='checkpoint')!;model.selection=new Set([cp.id]);model.move(16,32);
 expect(model.data.checkpoints[0]!.area!.y).toBe(json.checkpoints[0]!.area.y+32);model.undo();
 expect(validateLevel(model.data).errors).toEqual([]);
});
