import type { Boss } from '../bosses/Boss';
import { FortifiedGateBoss } from '../bosses/FortifiedGateBoss';
import type { Projectile } from '../projectiles/Projectile';
import { GATE_DEATH_FLASHES, LIGHT_PROFILES } from '../config/lighting';
import type { VfxId } from '../config/vfx';
import type { LightingSystem, LightSource } from './LightingSystem';

/** Observes existing gameplay state; never fires, damages, spawns or advances a boss. */
export class CombatLighting {
  private readonly missiles: readonly LightSource[];
  private readonly hatches: readonly LightSource[];
  private lastHealth: number;
  private lastAlive: boolean;
  private lastFire: number;
  private deathTime = -1;
  private deathIndex = 0;
  constructor(private readonly lighting: LightingSystem, projectiles: readonly Projectile[],
    private readonly boss: Boss, private readonly effect: (id: VfxId,x:number,y:number)=>void) {
    this.missiles=projectiles.map(p=>({position:p.position,get active(){return p.active&&p.style==='missile';}}));
    this.hatches=boss instanceof FortifiedGateBoss?boss.hatches.map(h=>({position:h,
      get active(){return boss.active&&boss.alive&&(h.state==='OPENING'||h.state==='OPEN');}})):[];
    this.lastHealth=boss.health;this.lastAlive=boss.alive;this.lastFire=boss.visualFireCount;
  }
  update(dt:number):void {
    this.lighting.syncAttached();
    for(const source of this.missiles)if(source.active)this.lighting.attach(source,LIGHT_PROFILES.missile);
    for(const source of this.hatches)if(source.active)this.lighting.attach(source,LIGHT_PROFILES.hatch);
    if(this.boss.encounter&&this.boss.alive&&this.boss.visualFireCount>this.lastFire)
      this.lighting.addLight({x:this.boss.position.x-5,y:this.boss.position.y+34,...LIGHT_PROFILES.launcher});
    if(this.boss.alive&&this.boss.health<this.lastHealth)
      this.lighting.addLight({x:this.boss.position.x+this.boss.width/2,y:this.boss.position.y+this.boss.height/2,...LIGHT_PROFILES.bossHit});
    if(this.lastAlive&&!this.boss.alive&&this.boss instanceof FortifiedGateBoss){this.deathTime=0;this.deathIndex=0;}
    this.lastHealth=this.boss.health;this.lastAlive=this.boss.alive;this.lastFire=this.boss.visualFireCount;
    if(this.deathTime>=0&&Number.isFinite(dt)&&dt>0){
      this.deathTime+=dt;
      while(this.deathIndex<GATE_DEATH_FLASHES.length&&this.deathTime>=GATE_DEATH_FLASHES[this.deathIndex]!.at){
        const flash=GATE_DEATH_FLASHES[this.deathIndex++]!;
        this.effect(flash.effect,this.boss.position.x+flash.x,this.boss.position.y+flash.y);
      }
      if(this.deathIndex===GATE_DEATH_FLASHES.length)this.deathTime=-1;
    }
  }
  reset():void {
    this.deathTime=-1;this.deathIndex=0;this.lastHealth=this.boss.health;this.lastAlive=this.boss.alive;this.lastFire=this.boss.visualFireCount;
    // Clear just the attached bindings; the level owns static lights and VFX owns temporary lights.
    for(const s of this.lighting.attachedLights){s.active=false;s.source=undefined;}
  }
}
