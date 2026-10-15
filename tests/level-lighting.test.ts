import { expect, it } from 'vitest';
import { LightingSystem } from '../src/rendering/LightingSystem';
import { defaultLevelLighting } from '../src/level/LevelLighting';
import type { LevelLighting } from '../src/level/LevelLighting';
import { createLevel, parseLevel, exportLevel, validateLevel } from '../src/level/LevelDocument';
import { LevelEditorModel } from '../src/devtools/levelEditorModel';
import level1 from '../public/levels/level-01.json';
import level2 from '../public/levels/level-02.json';
import level3 from '../public/levels/level-03.json';
const config=():LevelLighting=>({...defaultLevelLighting(),enabled:true,ambient:.62,lights:[{id:'test-light',type:'point',x:80.5,y:72.25,radius:64,intensity:.7,color:'#ffcb80'}]});
it('roundtrips real level lighting and accepts older documents without lighting',()=>{
  for(const [i,json] of [level1,level2,level3].entries()){
    const level=parseLevel(json);expect(parseLevel(JSON.parse(exportLevel(level)))).toEqual(level);
    expect(level.lighting!.lights).toHaveLength([5,6,10][i]!);
    expect(level.lighting!.ambient).toBe([.8,.62,.52][i]!);
    delete level.lighting;expect(validateLevel(level).errors).toEqual([]);
    const light=new LightingSystem();light.loadLevel(parseLevel(level).lighting);expect(light.enabled).toBe(false);expect(light.activeCount).toBe(0);light.dispose();
  }
});
it('rejects invalid source values, duplicate/global ids, bounds and excessive static lights',()=>{
  const level={...createLevel('test','Test',1024),lighting:config()};
  for(const [key,values] of Object.entries({radius:[0,-1,Infinity,NaN,2049],intensity:[-1,5,NaN],color:['red','#fff','#gggggg',123],x:[NaN,Infinity,-1],y:[NaN,Infinity,241],type:['spot']})){
    for(const value of values){const data=structuredClone(level);Object.assign(data.lighting.lights[0]!,{[key]:value});expect(validateLevel(data).errors.length).toBeGreaterThan(0);}
  }
  for(const change of [{ambient:1.1},{ambient:NaN},{mode:'bad'},{mode:'quantized',quantizationLevels:1},{quantizationLevels:3.5},{enabled:1}]){
    expect(validateLevel({...level,lighting:{...config(),...change}}).errors.length).toBeGreaterThan(0);
  }
  const duplicate=config();duplicate.lights.push({...duplicate.lights[0]!});expect(()=>new LightingSystem().loadLevel(duplicate)).toThrow();
  const global=structuredClone(level);global.lighting.lights[0]!.id=global.spawn.id;expect(validateLevel(global).errors.length).toBeGreaterThan(0);
  expect(()=>new LightingSystem().loadLevel({...config(),lights:Array.from({length:33},(_,i)=>({...config().lights[0]!,id:String(i)}))})).toThrow();
});
it('keeps static lights independent of the temporary pool and cleans level changes/restarts',()=>{
  const lighting=new LightingSystem(),data=config();
  data.lights=Array.from({length:32},(_,i)=>({...data.lights[0]!,id:String(i),x:i}));lighting.loadLevel(data);
  for(let i=0;i<33;i++)lighting.onVfx('fx.muzzle.rifle',1,2);
  expect(lighting.activeCount).toBe(64);expect(lighting.temporaryCount).toBe(32);expect(lighting.dropped).toBe(1);
  lighting.update(1);expect(lighting.staticLights).toHaveLength(32);expect(lighting.temporaryCount).toBe(0);
  lighting.onVfx('fx.explosion.medium',3,4);lighting.loadLevel(config());
  expect(lighting.staticLights).toHaveLength(1);expect(lighting.staticLights[0]!.x).toBe(80.5);expect(lighting.temporaryCount).toBe(0);
  const previous=lighting.staticLights[0];lighting.loadLevel(config());expect(lighting.staticLights[0]).not.toBe(previous);
  lighting.loadLevel();expect(lighting.enabled).toBe(false);expect(lighting.staticLights).toHaveLength(0);lighting.dispose();
});
it('loads quantized and disabled configurations without losing static definitions',()=>{
  const lighting=new LightingSystem();lighting.loadLevel({...config(),mode:'quantized',quantizationLevels:3});expect(lighting.quantization).toBe(3);
  lighting.enabled=false;expect(lighting.activeCount).toBe(0);expect(lighting.staticLights).toHaveLength(1);
  lighting.enabled=true;expect(lighting.activeCount).toBe(1);lighting.clear();expect(lighting.staticLights).toHaveLength(1);lighting.dispose();expect(lighting.staticLights).toHaveLength(0);
});
it('edits lights through the same undo/redo, move, duplicate, delete and export model',()=>{
  const model=new LevelEditorModel(createLevel('test','Test',1024));model.insertLight(config().lights[0]!);
  expect(model.data.lighting!.enabled).toBe(true);model.undo();expect(model.data.lighting).toBeUndefined();model.redo();
  model.move(4.5,3.25);expect(model.data.lighting!.lights[0]!.x).toBe(85);
  model.set(model.objects().find(o=>o.type==='light')!,'color','#44aabb');model.setLighting('ambient',.58);
  model.duplicate();expect(model.data.lighting!.lights).toHaveLength(2);
  expect(new Set(model.data.lighting!.lights.map(l=>l.id)).size).toBe(2);
  model.deleteSelection();expect(model.data.lighting!.lights).toHaveLength(1);model.undo();expect(model.data.lighting!.lights).toHaveLength(2);
  const exported=exportLevel(model.data);expect(parseLevel(JSON.parse(exported)).lighting).toEqual(model.data.lighting);
  model.redo();expect(model.data.lighting!.lights).toHaveLength(1);
});
