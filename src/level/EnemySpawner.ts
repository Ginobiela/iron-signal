import type { EnemyPlacement } from '../entities/enemies/EnemyManager';

export interface SpawnGroup {
  x: number;
  enemies: readonly EnemyPlacement[];
}

export class EnemySpawner {
  readonly totalEnemies: number;
  triggeredCount = 0;
  pendingEnemies: number;
  private readonly fired: boolean[];
  private minimumX = -Infinity;

  constructor(readonly groups: readonly SpawnGroup[], private readonly spawn: (placement: EnemyPlacement) => void) {
    this.fired = groups.map(() => false);
    this.totalEnemies = groups.reduce((count, group) => count + group.enemies.length, 0);
    this.pendingEnemies = this.totalEnemies;
  }

  update(cameraX: number): void {
    for (let i = 0; i < this.groups.length; i++) {
      const group = this.groups[i];
      if (!group || this.fired[i] || cameraX < group.x) continue;
      this.fired[i] = true;
      this.triggeredCount++;
      for (const placement of group.enemies) if (placement.x >= this.minimumX) {
        this.pendingEnemies--;
        this.spawn(placement);
      }
    }
  }

  reset(fromX = -Infinity): void {
    this.minimumX = fromX;
    this.triggeredCount = 0;
    this.pendingEnemies = 0;
    for (let i = 0; i < this.groups.length; i++) {
      const remaining = this.groups[i]!.enemies.filter(placement => placement.x >= fromX).length;
      this.fired[i] = remaining === 0;
      if (this.fired[i]) this.triggeredCount++;
      this.pendingEnemies += remaining;
    }
  }
}
