import type { KinematicBody } from '../entities/Entity';

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NO_PLATFORMS: readonly AABB[] = [];

export function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function segmentAABBTime(x0: number, y0: number, x1: number, y1: number,
  box: AABB, padding = 0): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let enter = 0;
  let exit = 1;
  if (dx === 0) {
    if (x0 < box.x - padding || x0 > box.x + box.width + padding) return Infinity;
  } else {
    const a = (box.x - padding - x0) / dx;
    const b = (box.x + box.width + padding - x0) / dx;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  if (dy === 0) {
    if (y0 < box.y - padding || y0 > box.y + box.height + padding) return Infinity;
  } else {
    const a = (box.y - padding - y0) / dy;
    const b = (box.y + box.height + padding - y0) / dy;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  return enter <= exit ? enter : Infinity;
}

export function segmentHitsAABB(x0: number, y0: number, x1: number, y1: number,
  box: AABB, padding = 0): boolean {
  return segmentAABBTime(x0, y0, x1, y1, box, padding) !== Infinity;
}

export class CollisionSystem {
  constrainHorizontal(body: KinematicBody, minX: number, maxX: number): void {
    const x = Math.max(minX, Math.min(maxX, body.position.x));
    if (x !== body.position.x) body.velocity.x = 0;
    body.position.x = x;
  }
  canOccupy(x: number, y: number, width: number, height: number, solids: readonly AABB[]): boolean {
    for (const solid of solids) {
      if (x < solid.x + solid.width && x + width > solid.x
        && y < solid.y + solid.height && y + height > solid.y) return false;
    }
    return true;
  }
  firstSolidHit(x0: number, y0: number, x1: number, y1: number,
    padding: number, solids: readonly AABB[]): number {
    let time = Infinity;
    for (const solid of solids) time = Math.min(time, segmentAABBTime(x0, y0, x1, y1, solid, padding));
    return time;
  }

  hitsSolidSegment(x0: number, y0: number, x1: number, y1: number,
    padding: number, solids: readonly AABB[]): boolean {
    for (const solid of solids) {
      if (segmentHitsAABB(x0, y0, x1, y1, solid, padding)) return true;
    }
    return false;
  }

  move(body: KinematicBody, dt: number, solids: readonly AABB[], worldWidth: number,
    oneWays: readonly AABB[] = NO_PLATFORMS, ignoredPlatform: AABB | null = null): AABB | null {
    const { position, velocity, width, height } = body;
    const oldX = position.x;
    let nextX = oldX + velocity.x * dt;
    for (const solid of solids) {
      if (position.y >= solid.y + solid.height || position.y + height <= solid.y) continue;
      if (velocity.x > 0 && oldX + width <= solid.x && nextX + width >= solid.x) {
        nextX = Math.min(nextX, solid.x - width);
      } else if (velocity.x < 0 && oldX >= solid.x + solid.width && nextX <= solid.x + solid.width) {
        nextX = Math.max(nextX, solid.x + solid.width);
      }
    }
    const boundedX = Math.max(0, Math.min(worldWidth - width, nextX));
    if (boundedX !== oldX + velocity.x * dt) velocity.x = 0;
    position.x = boundedX;

    const oldY = position.y;
    let nextY = oldY + velocity.y * dt;
    body.grounded = false;
    for (const solid of solids) {
      if (position.x >= solid.x + solid.width || position.x + width <= solid.x) continue;
      const top = solid.y + solid.height;
      // Sweep crossed surfaces, so a fast fall cannot tunnel through thin ground.
      if (velocity.y < 0 && oldY >= top && nextY <= top) {
        nextY = Math.max(nextY, top);
        body.grounded = true;
      } else if (velocity.y > 0 && oldY + height <= solid.y && nextY + height >= solid.y) {
        nextY = Math.min(nextY, solid.y - height);
      }
    }
    let support: AABB | null = null;
    if (velocity.y < 0) {
      for (const platform of oneWays) {
        if (platform === ignoredPlatform || position.x >= platform.x + platform.width
          || position.x + width <= platform.x) continue;
        const top = platform.y + platform.height;
        if (oldY >= top && nextY <= top) {
          if (top > nextY || (!body.grounded && top === nextY)) support = platform;
          nextY = Math.max(nextY, top);
          body.grounded = true;
        }
      }
    }
    if (nextY !== oldY + velocity.y * dt || body.grounded) velocity.y = 0;
    position.y = nextY;
    return support;
  }
}
