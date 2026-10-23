/** Existing source-pixel joints: only the head rotates; the support stays upright. */
export const TURRET_ART = {
  turret: { splitY: 34, pivotX: 22, pivotY: 30, muzzleLength: 22 },
  bossGateTurret: { splitY: 40, pivotX: 20, pivotY: 26, muzzleLength: 42 },
} as const;

/** Eight visual sectors; the continuous gameplay aim vector is never changed. */
export function turretAimAngle(aim: { x: number; y: number }): number {
  return Math.round(Math.atan2(aim.y, aim.x) / (Math.PI / 4)) * (Math.PI / 4);
}
