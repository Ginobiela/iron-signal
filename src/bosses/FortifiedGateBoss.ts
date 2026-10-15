import { Boss } from './Boss';
import type { BossPlacement } from './Boss';
import { GateTurret } from '../entities/enemies/GateTurret';
import { advanceHatch, gateLayout } from './gateLayout';
import type { EnemyContext } from '../entities/enemies/Enemy';
import { DEFAULT_CONFIG_SOURCE } from '../config/gameplay';
import type { GameplayConfigSource } from '../config/gameplay';

export interface GateHatch {x:number;y:number;state:'CLOSED'|'OPENING'|'OPEN'|'CLOSING';timer:number}
export class FortifiedGateBoss extends Boss {
  readonly turrets:readonly GateTurret[];
  readonly components:readonly GateTurret[];
  readonly damageTargets:readonly (GateTurret|Boss)[];
  readonly hatches:GateHatch[];
  get name():string{return 'BASTIÓN · PUERTA BLINDADA';}
  get visualPrefix():string{return 'bossGate';}
  get deathAnimation():string{return 'destroy';}
  get vulnerable():boolean{return this.active&&this.alive&&this.turrets.every(t=>!t.alive);}
  constructor(placement:BossPlacement,config:GameplayConfigSource=DEFAULT_CONFIG_SOURCE,
    private readonly spawnDog:(x:number,y:number)=>void=()=>{},private readonly activeDogCount:()=>number=()=>0){
    super(placement,config);
    const layout = gateLayout(placement.gateLayout);
    this.turrets=layout.turrets.map(p => new GateTurret(placement.x+p.x,placement.y+p.y,config));
    this.components=this.turrets;this.damageTargets=[...this.turrets,this];
    this.hatches=layout.hatches.map((p,i)=>({x:placement.x+p.x,y:placement.y+p.y,state:'CLOSED',timer:i}));
    this.reset();
  }
  prepareRespawn():void {if(!this.active)return;this.reset();this.active=true;this.state='ATTACK';for(const turret of this.turrets)turret.active=true;}
  update(dt:number,context:EnemyContext):void {
    if(!this.active||!this.alive||!context.player.alive)return;
    this.hitFlashTimer=Math.max(0,this.hitFlashTimer-dt);this.shieldFlashTimer=Math.max(0,this.shieldFlashTimer-dt);
    for(const turret of this.turrets)turret.update(dt,context);
    if(!this.vulnerable)return;
    this.phase=this.health<=this.maxHealth*.35?3:2;this.state='RECOVER';
    for(const hatch of this.hatches){
      const cooldown=Math.max(this.config.get().enemies.robotDog.spawnCooldown,this.config.get().gate.hatchCooldown*(this.phase===3?.6:1));
      if(advanceHatch(hatch,dt,cooldown)&&this.activeDogCount()<this.config.get().gate.maxActiveDogs)this.spawnDog(hatch.x,hatch.y);
    }
  }
  takeDamage(damage:number):boolean {
    if(!this.active||!this.alive||damage<=0)return false;
    if(!this.vulnerable){this.shieldFlashTimer=.1;return false;}
    this.health=Math.max(0,this.health-damage);this.hitFlashTimer=.1;if(!this.alive)this.die();return true;
  }
  die():void {super.die();for(const turret of this.turrets)turret.die();for(const hatch of this.hatches){hatch.state='CLOSED';hatch.timer=0;}}
  reset():void {
    super.reset();this.health=this.maxHealth=this.config.get().gate.mainHealth;
    for(const turret of this.turrets)turret.restore();
    this.hatches.forEach((h,i)=>{h.state='CLOSED';h.timer=i;});
  }
}
