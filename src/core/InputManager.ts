import { CONTROLS } from '../config/constants';
import type { Action } from '../config/constants';

const handledCodes = new Set<string>(Object.values(CONTROLS).flat());

export class InputManager {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.clear);
  }

  isDown(action: Action): boolean {
    return CONTROLS[action].some((code) => this.held.has(code));
  }

  wasPressed(action: Action): boolean {
    return CONTROLS[action].some((code) => this.pressed.has(code));
  }

  endStep(): void {
    this.pressed.clear();
  }

  readonly clear = (): void => {
    this.held.clear();
    this.pressed.clear();
  };

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.clear);
    this.clear();
  }

  private readonly onDown = (event: KeyboardEvent): void => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if ((tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT')
      && event.code !== 'Escape' && event.code !== 'Enter' && event.code !== 'F1') return;
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
