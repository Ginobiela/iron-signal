import type { LevelData } from '../level/Level';

/** DEV lighting test: existing Level 3 section/art with nearby subjects. Never saved to LevelData files. */
export function lightingLab<T extends LevelData>(level:T):T {
  return {
    ...level,name:'LIGHTING LAB · FASE 21.0',spawn:{x:48,y:44},
    platforms:[...level.platforms,{kind:'one-way',x:112,y:100,width:64,height:8}],
    spawnGroups:[{x:0,enemies:[{kind:'soldier',x:145,y:44},{kind:'robotDog',x:215,y:44}]}],
    pickups:[{id:'dev-light-machine-gun',kind:'M',x:48,y:44}],
    decorations:[...(level.decorations??[]).filter(d=>d.asset!=='environment.tower.animated.light'),
      {id:'dev-light-warning',asset:'environment.tower.animated.light',x:100,y:80,width:16,height:16,layer:'back',tiled:false,flipX:false},
      {id:'dev-light-console',asset:'environment.tower.prop.console',x:84,y:44,width:32,height:24,layer:'back',tiled:false,flipX:false}],
  };
}
