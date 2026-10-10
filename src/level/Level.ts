import type { AABB } from '../collision/CollisionSystem';
import type { Player } from '../entities/Player';
import type { Vector2 } from '../entities/Entity';
import type { SpawnGroup } from './EnemySpawner';
import type { Platform } from './Platform';
import type { Checkpoint } from './Checkpoint';
import type { BossPlacement } from '../bosses/Boss';
import type { BackgroundLayer, Decoration } from './LevelDocument';

export interface LevelData {
  name: string;
  width: number;
  spawn: Vector2;
  ground: readonly AABB[];
  platforms: readonly Platform[];
  spawnGroups: readonly SpawnGroup[];
  checkpoints: readonly Checkpoint[];
  boss: BossPlacement;
  sections: readonly { x: number; name: string }[];
  exitX: number;
  decorations?: readonly Decoration[];
  backgrounds?: readonly BackgroundLayer[];
  automaticTerrain?: boolean;
}

export class Level {
  readonly solids: readonly AABB[];
  readonly oneWays: readonly Platform[];

  constructor(readonly data: LevelData) {
    this.solids = [...data.ground, ...data.platforms.filter((platform) => platform.kind === 'solid')];
    this.oneWays = data.platforms.filter((platform) => platform.kind === 'one-way');
  }

  sectionAt(x: number): string {
    let name = this.data.name;
    for (const section of this.data.sections) {
      if (section.x > x) break;
      name = section.name;
    }
    return name;
  }

  reachedExit(player: Player): boolean {
    return player.alive && player.grounded && player.position.x >= this.data.exitX;
  }
}
