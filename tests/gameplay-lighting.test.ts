import { expect, it, vi } from 'vitest';
import { OrthographicCamera, Scene } from 'three';
import type { WebGLRenderer } from 'three';
import { LightingSystem } from '../src/rendering/LightingSystem';
import { CombatLighting } from '../src/rendering/CombatLighting';
import { LIGHT_PROFILES } from '../src/config/lighting';
import { lightModulation, validateLighting } from '../src/level/LevelLighting';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { Boss } from '../src/bosses/Boss';
import { FortifiedGateBoss } from '../src/bosses/FortifiedGateBoss';
import { PursuitBoss } from '../src/bosses/PursuitBoss';
import { parseLevel } from '../src/level/LevelDocument';
import level2 from '../public/levels/level-02.json';
import level3 from '../public/levels/level-03.json';
it('follows attached sources, removes destroyed sources, and reuses fixed slots/colors',()=>{
 const l=new LightingSystem();l.enabled=true;
 const source={position:{x:10,y:20},active:true};const slot=l.attach(source,LIGHT_PROFILES.missile)!;const color=slot.color;
 source.position.x=300;source.position.y=600;l.update(1/60);expect([slot.x,slot.y]).toEqual([300,600]);
 expect(l.attach(source,LIGHT_PROFILES.missile)).toBe(slot);expect(l.attachedCount).toBe(1);
 source.active=false;expect(l.attachedCount).toBe(0);expect(slot.source).toBeUndefined();
 source.active=true;expect(l.attach(source,LIGHT_PROFILES.missile)).toBe(slot);expect(slot.color).toBe(color);
 l.loadLevel(parseLevel(level3).lighting);expect(l.attachedCount).toBe(0);expect(l.staticLights).toHaveLength(10);l.dispose();
});
it('bounds attached capacity, rejects invalid profiles, and cleans disabled/reset state',()=>{
 const l=new LightingSystem();l.enabled=true;const profile=LIGHT_PROFILES.missile;
 expect(l.attach({position:{x:NaN,y:0},active:true},profile)).toBeUndefined();
 expect(l.attach({position:{x:0,y:0},active:true},{...profile,radius:0})).toBeUndefined();
 for(let i=0;i<17;i++)l.attach({position:{x:i,y:0},active:true},profile);
 expect(l.attachedCount).toBe(16);expect(l.dropped).toBe(1);l.enabled=false;expect(l.attachedCount).toBe(0);l.dispose();
});
it('missile light follows the real projectile pool, expires with it, and cannot follow a reused bullet',()=>{
 const l=new LightingSystem();l.enabled=true;
 const p=new ProjectileManager(new CollisionSystem(),2,(x,y)=>l.onVfx('fx.explosion.small',x,y));
 const boss=new Boss({x:800,y:44,arenaLeft:768});const adapter=new CombatLighting(l,p.items,boss,vi.fn());
 p.spawnHoming(120,100,100,0,1,1,.05);adapter.update(0);const slot=l.attachedLights.find(s=>s.active)!;
 p.update(.02,[],1024);adapter.update(.02);expect(slot.x).toBe(p.items[0]!.position.x);
 p.update(.04,[],1024);adapter.update(0);expect(slot.active).toBe(false);expect(slot.source).toBeUndefined();expect(l.attachedCount).toBe(0);expect(l.temporaryCount).toBe(1);
 p.spawn(10,10,30,0,1,'player');adapter.update(0);expect(l.attachedCount).toBe(0);
 p.clear();l.loadLevel();expect(l.attachedCount).toBe(0);l.dispose();
});
it('pulse and flicker are deterministic and remain within the authored amount',()=>{
 for(const behavior of ['pulse','flicker'] as const)for(let i=0;i<1500;i++){
  const value=lightModulation(behavior,i/60,1.1,.25,7);
  expect(value).toBeGreaterThanOrEqual(.75);expect(value).toBeLessThanOrEqual(1);
  expect(value).toBe(lightModulation(behavior,i/60,1.1,.25,7));
 }
 expect(lightModulation('static',10)).toBe(1);expect(lightModulation(undefined,10)).toBe(1);
 const cfg=parseLevel(level3).lighting!;
 for(const patch of [{behavior:'script'},{amount:1.1},{amount:NaN},{speed:0},{speed:Infinity}])
  expect(validateLighting({...cfg,lights:[{...cfg.lights[0]!,...patch}]}).length).toBeGreaterThan(0);
});
it('gate hatch lights follow state; staged death flashes are visual, bounded and cancelled on reset',()=>{
 const boss=new FortifiedGateBoss(parseLevel(level3).boss),l=new LightingSystem();l.enabled=true;const effect=vi.fn();
 const adapter=new CombatLighting(l,[],boss,effect);boss.active=true;boss.hatches[0]!.state='OPEN';adapter.update(0);
 expect(l.attachedCount).toBe(1);boss.hatches[0]!.state='CLOSED';expect(l.attachedCount).toBe(0);
 boss.turrets.forEach(t=>t.die());boss.takeDamage(1);adapter.update(1/60);expect(l.temporaryCount).toBe(1);
 boss.takeDamage(boss.maxHealth);expect(boss.alive).toBe(false);adapter.update(.01);expect(effect).not.toHaveBeenCalled();
 adapter.update(.08);expect(effect).toHaveBeenCalledTimes(1);adapter.update(.1);expect(effect).toHaveBeenCalledTimes(2);
 adapter.update(.2);expect(effect).toHaveBeenCalledTimes(3);adapter.update(10);expect(effect).toHaveBeenCalledTimes(3);
 boss.reset();adapter.reset();l.loadLevel(parseLevel(level3).lighting);adapter.update(1);expect(effect).toHaveBeenCalledTimes(3);expect(l.attachedCount).toBe(0);
 // Reset during a second death cancels the remaining visual flashes.
 boss.active=true;boss.turrets.forEach(t=>t.die());boss.takeDamage(boss.maxHealth);adapter.update(.01);boss.reset();adapter.reset();adapter.update(1);
 expect(effect).toHaveBeenCalledTimes(3);l.dispose();
});
it('mecha visual fire events illuminate the launcher without generating projectiles or damage',()=>{
 const boss=new PursuitBoss(parseLevel(level2).boss),l=new LightingSystem();l.enabled=true;
 const p=new ProjectileManager(new CollisionSystem(),2),adapter=new CombatLighting(l,p.items,boss,vi.fn());
 boss.active=true;boss.state='CHASE';const health=boss.health;boss.visualFireCount++;adapter.update(0);
 expect(l.temporaryCount).toBe(1);expect(p.totalSpawned).toBe(0);expect(boss.health).toBe(health);
 adapter.update(0);expect(l.temporaryCount).toBe(1);l.dispose();
});
it('full ambient is a true direct-render comparison and multipliers do not mutate LevelData',()=>{
 const cfg=parseLevel(level3).lighting!,before=JSON.stringify(cfg),l=new LightingSystem();l.loadLevel(cfg);
 l.setMultiplier('intensity',2.5);l.setMultiplier('temporary',-1);expect(l.intensityMultiplier).toBe(2);expect(l.temporaryMultiplier).toBe(0);
 l.fullAmbient=true;const render=vi.fn(),scene=new Scene(),camera=new OrthographicCamera();
 l.render({render,info:{render:{calls:1}}} as unknown as WebGLRenderer,scene,camera);
 expect(render).toHaveBeenCalledExactlyOnceWith(scene,camera);expect(l.renderTargetCount).toBe(0);expect(JSON.stringify(cfg)).toBe(before);l.dispose();
});
