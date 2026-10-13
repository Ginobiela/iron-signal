/** Browser standard mapping (Xbox layout). Axes are converted to existing digital actions. */
export const GAMEPAD = {
  deadzone: 0.3,
  triggerThreshold: 0.5,
  buttons: { left: [14], right: [15], up: [12], down: [13], jump: [0], shoot: [2, 7], aimLock: [6], pause: [9] },
} as const;
