import { DEFAULT_CONFIG_SOURCE } from '../config/gameplay';
import type { GameplayConfigSource } from '../config/gameplay';
import { VIEW } from '../config/constants';
import { containsPoint } from './CameraZone';
import type { CameraZone, CameraMode } from './CameraZone';

export class CameraController {
  x = 0;
  y = 0;
  mode:CameraMode='HORIZONTAL_FOLLOW';
  private zoneId='';
  private transition=0;

  constructor(private readonly worldWidth: number, private readonly config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE,
    private readonly worldHeight=240,private readonly zones:readonly CameraZone[]=[]) {}

  update(playerCenterX: number,playerCenterY=120,dt=1/60,snap=false): void {
    if(this.zones.length){
      let zone:CameraZone|undefined;
      for(let i=this.zones.length-1;i>=0;i--)if(containsPoint(this.zones[i]!,playerCenterX,playerCenterY)){zone=this.zones[i];break;}
      if(zone){
        if(zone.id!==this.zoneId){this.zoneId=zone.id;this.mode=zone.mode;this.transition=zone.transitionDuration??this.config.get().camera.cameraTransitionDuration;}
        const tuning=this.config.get().camera;
        let tx=this.x,ty=this.y;
        if(zone.mode==='LOCKED'){tx=zone.x;ty=zone.y;}
        else if(zone.mode==='HORIZONTAL_FOLLOW'){
          const sx=playerCenterX-this.x,forward=VIEW.width*tuning.forwardAnchor+tuning.deadZone,backward=VIEW.width*tuning.backwardAnchor-tuning.deadZone;
          if(sx>forward)tx=playerCenterX-forward;else if(sx<backward)tx=playerCenterX-backward;
          ty=zone.y;
        }else{
          const sy=playerCenterY-this.y;
          if(sy>VIEW.height*.5+tuning.verticalDeadzone)ty=playerCenterY-VIEW.height*.5-tuning.verticalDeadzone;
          else if(sy<VIEW.height*.5-tuning.verticalDeadzone)ty=playerCenterY-VIEW.height*.5+tuning.verticalDeadzone;
          tx=Math.max(playerCenterX-VIEW.width+32,Math.min(zone.x,playerCenterX-32));
        }
        const alpha=snap?1:this.transition>0?Math.min(1,dt/this.transition):1;
        this.x+=(tx-this.x)*alpha;
        const dy=(ty-this.y)*alpha,limit=tuning.verticalFollowSpeed*dt;
        this.y+=snap?ty-this.y:Math.max(-limit,Math.min(limit,dy));
        this.transition=snap?0:Math.max(0,this.transition-dt);
        if(zone.mode!=='LOCKED'){
          this.x=Math.max(playerCenterX-VIEW.width+16,Math.min(this.x,playerCenterX-16));
          this.y=Math.max(playerCenterY-VIEW.height+20,Math.min(this.y,playerCenterY-20));
        }
      }else{
        this.x=Math.max(playerCenterX-VIEW.width+16,Math.min(this.x,playerCenterX-16));
        this.y=Math.max(playerCenterY-VIEW.height+20,Math.min(this.y,playerCenterY-20));
      }
      this.x=Math.max(0,Math.min(Math.max(0,this.worldWidth-VIEW.width),this.x));
      this.y=Math.max(0,Math.min(Math.max(0,this.worldHeight-VIEW.height),this.y));return;
    }
    const screenX = playerCenterX - this.x;
    const forward = VIEW.width * this.config.get().camera.forwardAnchor;
    const backward = VIEW.width * this.config.get().camera.backwardAnchor;
    if (screenX > forward + this.config.get().camera.deadZone) this.x = playerCenterX - forward - this.config.get().camera.deadZone;
    else if (screenX < backward - this.config.get().camera.deadZone) this.x = playerCenterX - backward + this.config.get().camera.deadZone;
    this.x = Math.max(0, Math.min(Math.max(0, this.worldWidth - VIEW.width), this.x));
  }
  reset(x:number,y=120):void {this.zoneId='';this.transition=0;this.x=0;this.y=0;this.update(x,y,0,true);}
}
