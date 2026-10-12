import { CONTROLS } from '../config/constants';
import type { Action } from '../config/constants';
import { GAMEPAD } from '../config/gamepad';

const handledCodes = new Set<string>(Object.values(CONTROLS).flat());
const gamepadActions = Object.keys(GAMEPAD.buttons) as (keyof typeof GAMEPAD.buttons)[];

export class InputManager {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly touchHeld = new Set<Action>();
  private readonly touchPressed = new Set<Action>();
  private readonly gamepadHeld = new Set<Action>();
  private readonly gamepadPressed = new Set<Action>();
  // Preserve physical edges through clear(): holding Menu must not repeatedly pause/resume.
  private readonly gamepadLatch = new Set<Action>();
  private focused = true;
  gamepadStatus = 'MANDO: conectá y pulsá un botón';

  pollGamepads(): void {
    let pads: readonly (Gamepad | null)[] = [];
    try { pads = this.target.navigator?.getGamepads?.() ?? []; } catch { /* API unavailable or blocked. */ }
    const pad = pads.find(candidate => candidate?.connected && candidate.mapping === 'standard');
    this.gamepadStatus = pad ? `MANDO: ${pad.id}` : pads.some(candidate => candidate?.connected)
      ? 'MANDO: requiere modo Xbox / XInput (mapping standard)' : 'MANDO: conectá y pulsá un botón';
    const active = this.focused && !this.target.document?.hidden;
    for (const action of gamepadActions) {
      const buttons = GAMEPAD.buttons[action];
      let down = !!pad && buttons.some(index => {
        const button = pad.buttons[index];
        return button?.pressed || (button?.value ?? 0) > GAMEPAD.triggerThreshold;
      });
      const x = pad?.axes[0] ?? 0, y = pad?.axes[1] ?? 0;
      if (action === 'left') down ||= x < -GAMEPAD.deadzone;
      if (action === 'right') down ||= x > GAMEPAD.deadzone;
      if (action === 'up') down ||= y < -GAMEPAD.deadzone;
      if (action === 'down') down ||= y > GAMEPAD.deadzone;
      if (active && down && !this.gamepadLatch.has(action) && !this.isDown(action)) this.gamepadPressed.add(action);
      if (active && down) this.gamepadHeld.add(action); else this.gamepadHeld.delete(action);
      if (down) this.gamepadLatch.add(action); else this.gamepadLatch.delete(action);
    }
  }

  gamepadWasPressed(action: Action): boolean { return this.gamepadPressed.has(action); }

  setTouchAction(action: Action, down: boolean): void {
    if (down) {
      if (!this.isDown(action)) this.touchPressed.add(action);
      this.touchHeld.add(action);
    } else this.touchHeld.delete(action);
  }

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
    target.addEventListener('focus', this.onFocus);
  }

  isDown(action: Action): boolean {
    return this.gamepadHeld.has(action) || this.touchHeld.has(action) || CONTROLS[action].some((code) => this.held.has(code));
  }

  wasPressed(action: Action): boolean {
    return this.gamepadPressed.has(action) || this.touchPressed.has(action) || CONTROLS[action].some((code) => this.pressed.has(code));
  }

  endStep(): void {
    this.pressed.clear();
    this.touchPressed.clear();
    this.gamepadPressed.clear();
  }

  readonly clear = (): void => {
    this.held.clear();
    this.pressed.clear();
    this.touchHeld.clear();
    this.touchPressed.clear();
    this.gamepadHeld.clear();
    this.gamepadPressed.clear();
  };

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('focus', this.onFocus);
    this.clear();
    this.gamepadLatch.clear();
  }

  private readonly onBlur = (): void => { this.focused = false; this.clear(); };
  private readonly onFocus = (): void => {
    // The simulation may have stopped in a hidden tab; latch held buttons before accepting new edges.
    this.focused = false;
    this.pollGamepads();
    this.focused = true;
  };

  private readonly onDown = (event: KeyboardEvent): void => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if ((tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT')
      && event.code !== 'Escape' && event.code !== 'Enter' && event.code !== 'F1' && event.code !== 'F2') return;
    if (!handledCodes.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat && !this.held.has(event.code)) this.pressed.add(event.code);
    this.held.add(event.code);
  };

  private readonly onUp = (event: KeyboardEvent): void => {
    if (!handledCodes.has(event.code)) return;
    event.preventDefault();
    this.held.delete(event.code);
  };
}
