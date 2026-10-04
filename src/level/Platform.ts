import type { AABB } from '../collision/CollisionSystem';

export interface Platform extends AABB {
  kind: 'solid' | 'one-way';
}
