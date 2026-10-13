import { expect, it, vi } from 'vitest';
import json from '../public/levels/level-02.json';
import { parseLevel, exportLevel } from '../src/level/LevelDocument';
import { LevelEditorModel } from '../src/devtools/levelEditorModel';
import { Level } from '../src/level/Level';
import { Player } from '../src/entities/Player';
import { PursuitBoss } from '../src/bosses/PursuitBoss';
import { updatePursuit, pursuitExitReached } from '../src/level/PursuitSequence';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { CameraController } from '../src/camera/CameraController';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { CheckpointManager } from '../src/level/Checkpoint';
import { CombatSystem } from '../src/collision/CombatSystem';

it('explicit aim lock keeps directional aiming during pursuit instead of forcing backpedal facing', () => {
  const data=parseLevel(json), player=new Player(3680,44), boss=new PursuitBoss(data.boss);
  const controls={left:true,right:false,up:false,down:true,jumpPressed:false,shoot:false,aimLock:true};
  const collision=new CollisionSystem(); boss.activate(3680);
  player.update(1/60,controls,collision,new Level(data).solids,data.width);
  updatePursuit(boss,player,controls,collision,new CameraController(data.width),data.width);
  player.updateCombat(1/60,controls,new ProjectileManager(collision));
  expect(player.velocity.x).toBe(0); expect(player.direction).toBe(-1);
  expect(player.aimDirection).toEqual({x:-Math.SQRT1_2,y:-Math.SQRT1_2});
});

it('backpedal combat faces the threat without changing physical movement, level colliders or input bindings', () => {
  const data = parseLevel(json), level = new Level(data), collision = new CollisionSystem();
  const player = new Player(3680,44), boss = new PursuitBoss(data.boss), camera = new CameraController(data.width);
  const controls = {left:true,right:false,up:false,down:false,jumpPressed:false,shoot:true};
  boss.activate(player.position.x); const terrain = structuredClone(level.solids);
  player.update(1/60,controls,collision,level.solids,data.width,level.oneWays);
  const before = {...player.position};
  updatePursuit(boss,player,controls,collision,camera,data.width);
  expect(player.position).toEqual(before); expect(player.velocity.x).toBe(-95); expect(player.direction).toBe(1);
  player.updateCombat(1/60,controls,new ProjectileManager(collision));
  expect(player.aimDirection).toEqual({x:1,y:0}); expect(level.solids).toEqual(terrain);
  expect(camera.x).toBeGreaterThanOrEqual(0); expect(camera.x).toBeLessThanOrEqual(data.width-256);
  expect(player.position.x-camera.x).toBeGreaterThan(0);
});

it('blocks the forward gate only during pursuit and requires boss defeat plus retreat exit for completion', () => {
  const data=parseLevel(json), boss=new PursuitBoss(data.boss), player=new Player(3820,44);
  const controls={left:false,right:true,up:false,down:false,jumpPressed:false,shoot:false};
  const camera=new CameraController(data.width), collision=new CollisionSystem();
  boss.activate(3680); updatePursuit(boss,player,controls,collision,camera,data.width);
  expect(player.position.x).toBe(data.boss.encounter!.barrierX-player.width);
  player.position.x=data.exitX; player.grounded=true;
  expect(pursuitExitReached(boss,player,data.exitX)).toBe(false);
  boss.die(); expect(pursuitExitReached(boss,player,data.exitX)).toBe(true);
  player.position.x+=32; expect(pursuitExitReached(boss,player,data.exitX)).toBe(false);
  player.position.x=data.exitX; player.die(); expect(pursuitExitReached(boss,player,data.exitX)).toBe(false);
});

it('preserves the last pre-boss checkpoint when retreating and allows deterministic reactivation after retry', () => {
  const data=parseLevel(json), player=new Player(3690,44), boss=new PursuitBoss(data.boss);
  const checkpoints=new CheckpointManager({...data.spawn,name:'Start'},data.checkpoints);
  player.grounded=true; checkpoints.update(1/60,player); expect(checkpoints.current.x).toBe(3616);
  boss.activate(player.position.x); player.position.x=2700; checkpoints.update(1/60,player);
  expect(checkpoints.current.x).toBe(3616);
  player.respawn(checkpoints.current.x,checkpoints.current.y); boss.reset();
  expect(boss.active).toBe(false); expect(boss.activate(player.position.x)).toBe(false);
  expect(boss.activate(data.boss.arenaLeft)).toBe(true); expect(boss.position.x).toBe(data.boss.x);
});

it('ends colliding missiles once, shares the pool with normal bullets and clears homing data on reuse', () => {
  const end=vi.fn(), pool=new ProjectileManager(new CollisionSystem(),1,end);
  pool.spawnHoming(100,100,160,0,1,1,3);
  pool.update(.1,[{x:110,y:80,width:4,height:40}],1000,undefined,{x:200,y:100});
  expect(pool.activeCount).toBe(0); expect(end).toHaveBeenCalledTimes(1);
  pool.clear(); expect(end).toHaveBeenCalledTimes(1);
  pool.spawn(100,100,160,0,1,'player'); expect(pool.items[0]!.turnRate).toBe(0);
  expect(pool.items[0]!.style).toBe('bullet');
});

it('edits, exports and undoes encounter fields and weapon pickups through the existing editor model', () => {
  const model=new LevelEditorModel(parseLevel(json));
  model.commit([{path:['boss','encounter','retreatLeft'],before:2560,after:2528}]);
  expect(JSON.parse(exportLevel(model.data)).boss.encounter.retreatLeft).toBe(2528);
  model.undo(); expect(model.data.boss.encounter!.retreatLeft).toBe(2560);
  const pickup=model.objects().find(o=>o.type==='pickup')!;
  model.selection.add(pickup.id); model.deleteSelection(); expect(model.data.pickups).toHaveLength(1);
  model.undo(); expect(model.data.pickups).toHaveLength(2);
});

it('homing missiles damage the player through normal swept combat and produce one retirement effect', () => {
  const player=new Player(140,44), collision=new CollisionSystem(), end=vi.fn();
  const combat=new CombatSystem(collision,player,[]), pool=new ProjectileManager(collision,1,end);
  pool.spawnHoming(100,57,160,0,1,1,3);
  pool.update(.4,[],1000,combat,{x:146,y:57});
  expect(player.alive).toBe(false); expect(combat.playerHits).toBe(1);
  expect(pool.activeCount).toBe(0); expect(end).toHaveBeenCalledTimes(1);
});
