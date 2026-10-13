import { Enemy } from './Enemy';
import type { EnemyContext } from './Enemy';
import { DEFAULT_CONFIG_SOURCE } from '../../config/gameplay';
import type { GameplayConfigSource } from '../../config/gameplay';

export class RobotDog extends Enemy {
  private attacking=false;
  get warning():boolean{return this.attacking;}
  get shootAnimation():string{return 'attack';}
  protected resetBehavior():void{this.attacking=false;}
  constructor(x:number,y:number,config:GameplayConfigSource=DEFAULT_CONFIG_SOURCE){super('robotDog',x,y,config.get().enemies.robotDog,config);}
  get contactDamage():number{return this.config.get().enemies.robotDog.contactDamage;}
  protected updateBehavior(dt:number,context:EnemyContext):void {
    const stats=this.config.get().enemies.robotDog,dx=this.distanceToPlayer(context);
    this.attacking=Math.abs(dx)<this.width+6&&Math.abs(context.player.position.y-this.position.y)<this.height;
    if(Math.hypot(dx,context.player.position.y-this.position.y)>stats.activationDistance){this.moveOnGround(dt,context,0);return;}
    if(dx!==0)this.direction=dx>0?1:-1;
    this.moveOnGround(dt,context,this.direction*stats.speed);
    if(this.grounded&&this.velocity.x===0&&Math.abs(dx)>this.width){this.velocity.y=stats.jumpSpeed;this.grounded=false;}
  }
}
