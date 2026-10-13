import { Boss } from './Boss';
import type { BossPlacement } from './Boss';
import { Turret } from '../entities/enemies/Turret';
import type { EnemyContext } from '../entities/enemies/Enemy';
import { DEFAULT_CONFIG_SOURCE } from '../config/gameplay';
import type { GameplayConfigSource } from '../config/gameplay';

export interface GateHatch {x:number;y:number;state:'CLOSED'|'OPENING'|'OPEN'|'CLOSING';timer:number}
class GateTurret extends Turret {
  get visualPrefix():string{return 'bossGateTurret';}
  get deathAnimation():string{return 'destroy';}
  get shootAnimation():string{return 'fire';}
  constructor(x:number,y:number,config:GameplayConfigSource){super(x,y,'aimed',config);this.restore();}
  restore():void {super.reset();this.health=this.maxHealth=this.config.get().gate.turretHealth;this.attackTimer=.8;}
  protected updateBehavior(dt:number,context:EnemyContext):void {
    this.aimAtPlayer(context);this.attackTimer=Math.max(0,this.attackTimer-dt);
    if(this.attackTimer===0&&this.fireAtPlayer(context,this.config.get().gate.turretBulletSpeed))this.attackTimer=this.config.get().gate.turretFireCooldown;
  }
}
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
    this.turrets=[new GateTurret(placement.x-80,placement.y+12,config),new GateTurret(placement.x+32,placement.y+60,config)];
    this.components=this.turrets;this.damageTargets=[...this.turrets,this];
    this.hatches=[{x:placement.x-124,y:placement.y,state:'CLOSED',timer:0},{x:placement.x+24,y:placement.y,state:'CLOSED',timer:1}];
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
      hatch.timer-=dt;if(hatch.timer>0)continue;
      if(hatch.state==='CLOSED'){hatch.state='OPENING';hatch.timer=.3;}
      else if(hatch.state==='OPENING'){
        hatch.state='OPEN';hatch.timer=.4;
        if(this.activeDogCount()<this.config.get().gate.maxActiveDogs)this.spawnDog(hatch.x,hatch.y);
      }else if(hatch.state==='OPEN'){hatch.state='CLOSING';hatch.timer=.3;}
      else{hatch.state='CLOSED';hatch.timer=Math.max(this.config.get().enemies.robotDog.spawnCooldown,this.config.get().gate.hatchCooldown*(this.phase===3?.6:1));}
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
