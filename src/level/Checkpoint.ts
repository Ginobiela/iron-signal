import { GAMEPLAY } from '../config/constants';
import type { Player } from '../entities/Player';
import type { AABB } from '../collision/CollisionSystem';
import { containsPoint } from '../camera/CameraZone';

export interface Checkpoint { x: number; y: number; name: string;id?:string;area?:AABB;order?:number }

export class CheckpointManager {
  current: Checkpoint;
  private noticeTimer = 0;
  private noticeText = '';

  constructor(private readonly initial: Checkpoint, readonly items: readonly Checkpoint[]) {
    this.current = initial;
  }

  get message(): string { return this.noticeTimer > 0 ? this.noticeText : ''; }

  update(dt: number, player: Player): void {
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (!player.alive || !player.grounded) return;
    let latest = this.current;
    for (const checkpoint of this.items) {
      if(checkpoint.area){
        if(containsPoint(checkpoint.area,player.position.x+player.width/2,player.position.y+1)&&(checkpoint.order??0)>(latest.order??-1))latest=checkpoint;
        continue;
      }
      if (checkpoint.x <= player.position.x && checkpoint.x > latest.x) latest = checkpoint;
    }
    if (latest === this.current) return;
    this.current = latest;
    this.noticeText = `CHECKPOINT · ${latest.name.toUpperCase()}`;
    this.noticeTimer = GAMEPLAY.checkpointNoticeTime;
  }

  reset(): void {
    this.current = this.initial;
    this.dismissNotice();
  }

  dismissNotice(): void {
    this.noticeTimer = 0;
    this.noticeText = '';
  }
}
