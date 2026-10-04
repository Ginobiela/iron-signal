import type { AABB } from '../collision/CollisionSystem';
import type { EnemyPlacement } from '../entities/enemies/EnemyManager';

export const TEST_LEVEL = {
  width: 1536,
  spawn: { x: 62, y: 44 },
  enemies: [
    { kind: 'soldier', x: 140, y: 44 },
    { kind: 'flying', x: 242, y: 92 },
    { kind: 'runner', x: 285, y: 44 },
    { kind: 'turret', x: 320, y: 44 },
    { kind: 'soldier', x: 580, y: 44 },
    { kind: 'flying', x: 790, y: 102 },
    { kind: 'runner', x: 880, y: 44 },
    { kind: 'turret', x: 1060, y: 44 },
    { kind: 'soldier', x: 1340, y: 44 },
    { kind: 'turret', x: 1460, y: 44 },
  ] satisfies readonly EnemyPlacement[],
  solids: [
    { x: 0, y: 0, width: 1536, height: 44 },
    { x: 180, y: 68, width: 56, height: 6 },
    { x: 350, y: 44, width: 40, height: 12 },
    { x: 470, y: 44, width: 56, height: 24 },
    { x: 610, y: 44, width: 32, height: 12 },
    { x: 700, y: 68, width: 80, height: 6 },
    { x: 940, y: 44, width: 48, height: 20 },
    { x: 1120, y: 44, width: 48, height: 12 },
    { x: 1200, y: 44, width: 80, height: 24 },
  ] satisfies readonly AABB[],
} as const;
