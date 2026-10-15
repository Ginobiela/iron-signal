import { expect,it,vi } from 'vitest';
import { NearestFilter,OrthographicCamera,Scene,Vector3 } from 'three';
import type { WebGLRenderTarget } from 'three';
import type { WebGLRenderer } from 'three';
import { LightingSystem } from '../src/rendering/LightingSystem';
import { FxSpritePool } from '../src/rendering/FxSpritePool';
import { AssetManager } from '../src/core/AssetManager';
import { lightingLab } from '../src/devtools/lightingLab';
import { parseLevel, exportLevel } from '../src/level/LevelDocument';
import level3 from '../public/levels/level-03.json';

it('disabled preserves direct rendering and rejects effects without allocating render targets',()=>{
  const lighting=new LightingSystem(),scene=new Scene(),camera=new OrthographicCamera();
  const render=vi.fn(),renderer={render,info:{render:{calls:7}}} as unknown as WebGLRenderer;
  expect(lighting.addLight({x:1,y:2,radius:20,intensity:1,color:0xffffff})).toBeUndefined();
  lighting.onVfx('fx.explosion.small',10,20);lighting.render(renderer,scene,camera);
  expect(render).toHaveBeenCalledExactlyOnceWith(scene,camera);expect(lighting.activeCount).toBe(0);expect(lighting.renderTargetCount).toBe(0);
  lighting.dispose();
});
it('validates light data, clamps intensity/ambient, preserves world coordinates and expires/reuses slots',()=>{
  const lighting=new LightingSystem();lighting.enabled=true;
  const data={x:414,y:93,radius:25,intensity:9,color:0xffa040,lifetime:.07};
  for(const radius of [0,-1,NaN,Infinity])expect(lighting.addLight({...data,radius})).toBeUndefined();
  for(const lifetime of [0,-1,NaN,Infinity])expect(lighting.addLight({...data,lifetime})).toBeUndefined();
  expect(lighting.addLight({...data,x:NaN})).toBeUndefined();
  for(const color of [-1,0x1000000,1.5,NaN,Infinity])expect(lighting.addLight({...data,color})).toBeUndefined();
  const first=lighting.addLight(data)!;expect(first.x).toBe(414);expect(first.y).toBe(93);expect(first.intensity).toBe(4);
  lighting.setAmbient(-1);expect(lighting.ambient).toBe(0);lighting.setAmbient(2);expect(lighting.ambient).toBe(1);
  lighting.update(0);lighting.update(NaN);expect(first.life).toBe(.07);
  lighting.update(.03);expect(first.life).toBeCloseTo(.04);expect(first.x).toBe(414);
  const generation=first.generation;
  lighting.update(.05);expect(first.active).toBe(false);expect(lighting.addLight(data)).toBe(first);expect(first.generation).toBe(generation+1);
  const fixed=lighting.addLight({...data,lifetime:undefined})!;lighting.update(1000);expect(fixed.active).toBe(true);
  lighting.enabled=false;expect(lighting.activeCount).toBe(0);lighting.dispose();
});
it('caps saturation and reuses the same slots/colors through simulated minutes of muzzle and explosion lights',()=>{
  const lighting=new LightingSystem();lighting.enabled=true;
  const slots=[...lighting.slots],colors=slots.map(s=>s.color);
  for(let i=0;i<10800;i++){
    lighting.update(1/60);lighting.onVfx('fx.muzzle.machineGun',400,93);
    if(i%10===0)lighting.onVfx('fx.explosion.medium',430,93);
    expect(lighting.activeCount).toBeLessThanOrEqual(32);
  }
  lighting.update(1);expect(lighting.activeCount).toBe(0);
  expect(lighting.slots).toEqual(slots);lighting.slots.forEach((s,i)=>expect(s.color).toBe(colors[i]));
  for(let i=0;i<33;i++)lighting.onVfx('fx.explosion.small',1,2);
  expect(lighting.activeCount).toBe(32);expect(lighting.dropped).toBe(1);lighting.dispose();
});
it('uses accepted VFX spawns, ignores impacts, and has distinct spread/laser/explosion light profiles',()=>{
  const lighting=new LightingSystem(),assets=new AssetManager({}),pool=new FxSpritePool(assets,undefined,undefined,1);
  lighting.enabled=true;pool.onSpawn=(id,x,y)=>lighting.onVfx(id,x,y);
  pool.spawn('fx.muzzle.rifle',414,93);expect(lighting.activeCount).toBe(1);expect(lighting.slots[0]?.x).toBe(414);
  pool.spawn('fx.explosion.medium',1,2);expect(lighting.activeCount).toBe(1);
  lighting.clear();lighting.onVfx('fx.hit.enemy',1,2);expect(lighting.activeCount).toBe(0);
  lighting.onVfx('fx.muzzle.spread',1,2);expect(lighting.slots[0]?.radius).toBe(30);
  lighting.onVfx('fx.muzzle.laser',1,2);expect(lighting.slots[1]!.color.b).toBeGreaterThan(lighting.slots[1]!.color.r);
  lighting.onVfx('fx.explosion.medium',1,2);expect(lighting.slots[2]?.radius).toBe(56);
  pool.dispose();assets.dispose();lighting.dispose();
});

it('keeps world mapping through camera translation/zoom, resizes targets and restores renderer state',()=>{
  const lighting=new LightingSystem(),camera=new OrthographicCamera(0,256,240,0,.1,100),scene=new Scene();
  let width=512,height=480,target:WebGLRenderTarget|null=null;
  const targets:WebGLRenderTarget[]=[];
  const renderer={
    info:{autoReset:true,reset:vi.fn(),render:{calls:0}},
    getDrawingBufferSize:(v:{set:(x:number,y:number)=>void})=>v.set(width,height),
    getRenderTarget:()=>target,
    setRenderTarget:(t:WebGLRenderTarget|null)=>{target=t;if(t&&!targets.includes(t))targets.push(t);},
    render:vi.fn(),
  };
  lighting.enabled=true;lighting.addLight({x:414,y:93,radius:26,intensity:2,color:0xffffff});
  camera.position.set(350,50,10);
  lighting.render(renderer as unknown as WebGLRenderer,scene,camera);
  expect(renderer.render).toHaveBeenCalledTimes(3);expect(target).toBeNull();expect(renderer.info.autoReset).toBe(true);
  expect(targets.map(t=>[t.width,t.height])).toEqual([[512,480],[256,240]]);
  expect(lighting.visibleCount).toBe(1);expect(lighting.submittedCount).toBe(1);
  const uniforms=(lighting as unknown as {lightMaterial:{uniforms:Record<string,{value:unknown}>}}).lightMaterial.uniforms;
  const matrix=uniforms.worldFromClip!.value as import('three').Matrix4;
  const world=new Vector3(414,93,0),projected=world.clone().project(camera).applyMatrix4(matrix);
  expect(projected.x).toBeCloseTo(world.x);expect(projected.y).toBeCloseTo(world.y);
  camera.position.set(10,600,10);camera.zoom=1.5;camera.updateProjectionMatrix();
  width=1024;height=960;lighting.resolutionScale=1;
  lighting.render(renderer as unknown as WebGLRenderer,scene,camera);
  const mapped=world.clone().project(camera).applyMatrix4(matrix);
  expect(mapped.x).toBeCloseTo(world.x);expect(mapped.y).toBeCloseTo(world.y);
  expect(targets.map(t=>[t.width,t.height])).toEqual([[1024,960],[1024,960]]);
  expect(lighting.visibleCount).toBe(0);expect(lighting.activeCount).toBe(1);expect(lighting.submittedCount).toBe(1);
  expect(targets.every(t=>t.texture.magFilter===NearestFilter&&!t.texture.generateMipmaps)).toBe(true);
  renderer.render.mockImplementationOnce(()=>{throw new Error('test render failure');});
  expect(()=>lighting.render(renderer as unknown as WebGLRenderer,scene,camera)).toThrow('test render failure');
  expect(target).toBeNull();expect(renderer.info.autoReset).toBe(true);
  const disposals=targets.map(t=>vi.spyOn(t,'dispose'));lighting.dispose();disposals.forEach(spy=>expect(spy).toHaveBeenCalledOnce());
});


it('keeps the lighting lab changes in memory without changing the serializable campaign level',()=>{
  const source=parseLevel(level3),before=exportLevel(source);
  const lab=lightingLab(source);
  expect(lab).not.toBe(source);
  expect(lab.platforms).toHaveLength(source.platforms.length+1);
  expect(lab.spawnGroups).not.toBe(source.spawnGroups);
  expect(lab.pickups?.[0]?.kind).toBe('M');
  expect(exportLevel(source)).toBe(before);
  expect(parseLevel(JSON.parse(before))).toEqual(source);
});
