import type { AABB } from '../collision/CollisionSystem';
import type { Player } from '../entities/Player';
import type { Vector2 } from '../entities/Entity';
import type { SpawnGroup } from './EnemySpawner';
import type { Platform } from './Platform';
import type { Checkpoint } from './Checkpoint';
import type { BossPlacement } from '../bosses/Boss';
import type { BackgroundLayer, Decoration } from './LevelDocument';
import type { LevelLighting } from './LevelLighting';
import type { CameraZone } from '../camera/CameraZone';

export interface LevelData {
  name: string;
  lighting?: LevelLighting;
  width: number;
  height?:number;
  cameraZones?:readonly CameraZone[];
  killZones?:readonly AABB[];
  exitArea?:AABB;
  spawn: Vector2;
  ground: readonly AABB[];
  platforms: readonly Platform[];
  spawnGroups: readonly SpawnGroup[];
  checkpoints: readonly Checkpoint[];
  boss: BossPlacement;
  sections: readonly { x: number; name: string; area?:AABB }[];
  exitX: number;
  decorations?: readonly Decoration[];
  backgrounds?: readonly BackgroundLayer[];
  automaticTerrain?: boolean;
  environmentSkin?: 'underground'|'tower';
  nextLevel?: string;
  /** Presentation time after victory before an automatic campaign transition. */
  completionDelay?: number;
  pickups?: readonly { id: string; kind: 'M' | 'S' | 'L'; x: number; y: number }[];
}

export class Level {
  readonly solids: readonly AABB[];
  readonly oneWays: readonly Platform[];

  constructor(readonly data: LevelData) {
    this.solids = [...data.ground, ...data.platforms.filter((platform) => platform.kind === 'solid')];
    this.oneWays = data.platforms.filter((platform) => platform.kind === 'one-way');
  }

  sectionAt(x: number,y=0): string {
    const area=this.data.sections.find(s=>s.area&&x>=s.area.x&&x<=s.area.x+s.area.width&&y>=s.area.y&&y<=s.area.y+s.area.height);
    if(area)return area.name;
    let name = this.data.name;
    for (const section of this.data.sections) {
      if (section.x > x) break;
      name = section.name;
    }
    return name;
  }

  reachedExit(player: Player): boolean {
    if(this.data.exitArea){const a=this.data.exitArea;return player.alive&&player.grounded&&player.position.x>=a.x&&player.position.x<=a.x+a.width&&player.position.y>=a.y&&player.position.y<=a.y+a.height;}
    return player.alive && player.grounded && player.position.x >= this.data.exitX;
  }
}
