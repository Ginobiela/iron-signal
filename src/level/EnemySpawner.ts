import type { EnemyPlacement } from '../entities/enemies/EnemyManager';
import type { AABB } from '../collision/CollisionSystem';
import { overlaps } from '../collision/CollisionSystem';

export interface SpawnGroup {
  x: number;
  y?:number;width?:number;height?:number;
  enemies: readonly EnemyPlacement[];
}

export class EnemySpawner {
  readonly totalEnemies: number;
  triggeredCount = 0;
  pendingEnemies: number;
  private readonly fired: boolean[];
  private minimumX = -Infinity;
  private checkpointFired:boolean[]=[];

  constructor(readonly groups: readonly SpawnGroup[], private readonly spawn: (placement: EnemyPlacement) => void) {
    this.fired = groups.map(() => false);
    this.totalEnemies = groups.reduce((count, group) => count + group.enemies.length, 0);
    this.pendingEnemies = this.totalEnemies;
  }

  update(cameraX: number,player?:AABB): void {
    for (let i = 0; i < this.groups.length; i++) {
      const group = this.groups[i];
      if (!group || this.fired[i]) continue;
      if(group.y!==undefined){if(!player||!overlaps(group as AABB,player))continue;}
      else if(cameraX<group.x)continue;
      this.fired[i] = true;
      this.triggeredCount++;
      for (const placement of group.enemies) if (group.y!==undefined||placement.x >= this.minimumX) {
        this.pendingEnemies--;
        this.spawn(placement);
      }
    }
  }

  reset(fromX = -Infinity): void {
    this.checkpointFired=[];
    this.minimumX = fromX;
    this.triggeredCount = 0;
    this.pendingEnemies = 0;
    for (let i = 0; i < this.groups.length; i++) {
      const remaining = this.groups[i]!.enemies.filter(placement => this.groups[i]!.y!==undefined||placement.x >= fromX).length;
      this.fired[i] = remaining === 0;
      if (this.fired[i]) this.triggeredCount++;
      this.pendingEnemies += remaining;
    }
  }
  captureCheckpoint(player:AABB):void {this.checkpointFired=this.groups.map((g,i)=>!!this.fired[i]&&!(g.y!==undefined&&overlaps(g as AABB,player)));}
  rewind(fromX:number):void {
    const saved=this.checkpointFired.slice();this.reset(fromX);this.checkpointFired=saved;
    for(let i=0;i<this.groups.length;i++)if(this.groups[i]!.y!==undefined&&saved[i]&&!this.fired[i]){
      this.fired[i]=true;this.triggeredCount++;this.pendingEnemies-=this.groups[i]!.enemies.length;
    }
  }

}
