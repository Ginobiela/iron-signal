export interface Vector2 {
  x: number;
  y: number;
}

export interface KinematicBody {
  position: Vector2;
  velocity: Vector2;
  width: number;
  height: number;
  grounded: boolean;
}
