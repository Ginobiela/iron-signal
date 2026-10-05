import type { AABB } from '../collision/CollisionSystem';
import { ENVIRONMENT, tileVariant } from '../config/environment';
import type { EnvironmentId } from '../config/environment';

export interface EnvironmentPiece extends AABB { id: EnvironmentId; topAligned: boolean }

/** Visual subdivisions only. These objects are never registered with CollisionSystem. */
export function groundPieces(box: AABB, leftEdge = true, rightEdge = true): EnvironmentPiece[] {
  const pieces: EnvironmentPiece[] = [], size = ENVIRONMENT.tile;
  const topHeight = Math.min(size, box.height), below = box.height - topHeight;
  const cap = Math.min(size, box.width / 2);
  const left = leftEdge ? cap : 0, right = rightEdge ? cap : 0;
  const add = (id: EnvironmentId, x: number, y: number, width: number, height: number, topAligned = false): void => {
    if (width > 0 && height > 0) pieces.push({ id, x, y, width, height, topAligned });
  };
  // Phase-align repeats from the top so arbitrary collider heights keep the authored joins.
  add('environment.ground.fill', box.x + left, box.y, box.width - left - right, below, true);
  add('environment.ground.left', box.x, box.y, left, below, true);
  add('environment.ground.right', box.x + box.width - right, box.y, right, below, true);
  const y = box.y + below;
  add('environment.ground.topLeft', box.x, y, left, topHeight, true);
  add('environment.ground.topRight', box.x + box.width - right, y, right, topHeight, true);
  const tops = ['environment.ground.top01', 'environment.ground.top02', 'environment.ground.top03'] as const;
  for (let x = box.x + left; x < box.x + box.width - right; x += size) {
    add(tops[tileVariant(x, y)]!, x, y, Math.min(size, box.x + box.width - right - x), topHeight, true);
  }
  return pieces;
}

export function platformPieces(box: AABB): EnvironmentPiece[] {
  const height = 8, y = box.y + box.height - height;
  if (box.width <= ENVIRONMENT.tile) return [{ ...box, y, height, id: 'environment.platform.single', topAligned: true }];
  const cap = Math.min(ENVIRONMENT.tile, box.width / 2);
  const pieces: EnvironmentPiece[] = [
    { x: box.x, y, width: cap, height, id: 'environment.platform.left', topAligned: true },
    { x: box.x + box.width - cap, y, width: cap, height, id: 'environment.platform.right', topAligned: true },
  ];
  if (box.width > cap * 2) pieces.push({ x: box.x + cap, y, width: box.width - cap * 2, height,
    id: 'environment.platform.middle', topAligned: true });
  return pieces;
}
