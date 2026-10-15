export interface GatePoint { x: number; y: number }
export interface GateLayout { turrets: [GatePoint, GatePoint]; hatches: [GatePoint, GatePoint] }
/** Offsets from the main gate's lower-left world origin. */
export function gateLayout(layout?: GateLayout): GateLayout {
  return structuredClone(layout ?? {
    turrets: [{ x: -80, y: 12 }, { x: 32, y: 60 }],
    hatches: [{ x: -124, y: 0 }, { x: 24, y: 0 }],
  });
}
export interface GateHatchState { x: number; y: number; state: 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING'; timer: number }
/** Returns a spawn event once per opening, independent of animation frames. */
export function advanceHatch(hatch: GateHatchState, dt: number, cooldown: number): boolean {
  hatch.timer -= dt;
  if (hatch.timer > 0) return false;
  if (hatch.state === 'CLOSED') { hatch.state = 'OPENING'; hatch.timer = .3; }
  else if (hatch.state === 'OPENING') { hatch.state = 'OPEN'; hatch.timer = .4; return true; }
  else if (hatch.state === 'OPEN') { hatch.state = 'CLOSING'; hatch.timer = .3; }
  else { hatch.state = 'CLOSED'; hatch.timer = cooldown; }
  return false;
}
