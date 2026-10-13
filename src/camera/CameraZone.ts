import type { AABB } from '../collision/CollisionSystem';
export type CameraMode = 'HORIZONTAL_FOLLOW' | 'VERTICAL_FOLLOW' | 'LOCKED';
export interface CameraZone extends AABB {id:string;mode:CameraMode;transitionDuration?:number}
export function containsPoint(area:AABB,x:number,y:number):boolean {
  return x>=area.x&&x<=area.x+area.width&&y>=area.y&&y<=area.y+area.height;
}
