import { CONTROLS } from '../config/constants';
import type { Action } from '../config/constants';
import type { InputManager } from '../core/InputManager';

/** Pointer capture keeps releases reliable; each finger contributes independent actions. */
export class TouchControls {
  private readonly pointers = new Map<number, HTMLElement>();
  private readonly actions = Object.keys(CONTROLS) as Action[];

  constructor(private readonly root: HTMLElement, private readonly input: InputManager) {
    root.addEventListener('pointerdown', this.down);
    root.addEventListener('pointermove', this.move);
    root.addEventListener('pointerup', this.up);
    root.addEventListener('pointercancel', this.up);
    root.addEventListener('lostpointercapture', this.up);
    root.addEventListener('contextmenu', this.context);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.visibility);
  }

  private button(target: EventTarget | null): HTMLElement | undefined {
    const button = target instanceof Element ? target.closest<HTMLElement>('[data-actions]') : null;
    return button && this.root.contains(button) ? button : undefined;
  }

  private readonly down = (event: PointerEvent): void => {
    const button = this.button(event.target);
    if (!button) return;
    event.preventDefault();
    this.root.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, button);
    this.sync();
  };

  private readonly move = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    const button = this.button(document.elementFromPoint(event.clientX, event.clientY));
    // Keep the finger tracked outside buttons so sliding back onto the pad works.
    this.pointers.set(event.pointerId, button ?? this.root);
    this.sync();
  };

  private readonly up = (event: PointerEvent): void => {
    if (this.pointers.delete(event.pointerId)) this.sync();
  };

  private sync(): void {
    const held = new Set(Array.from(this.pointers.values()).flatMap(button => button.dataset.actions?.split(' ') ?? []));
    for (const action of this.actions) this.input.setTouchAction(action, held.has(action));
    for (const button of this.root.querySelectorAll<HTMLElement>('[data-actions]')) {
      button.classList.toggle('held', Array.from(this.pointers.values()).includes(button));
    }
  }

  private readonly context = (event: Event): void => event.preventDefault();
  private readonly visibility = (): void => { if (document.hidden) this.clear(); };
  private readonly clear = (): void => { this.pointers.clear(); this.sync(); };

  dispose(): void {
    this.clear();
    this.root.removeEventListener('pointerdown', this.down);
    this.root.removeEventListener('pointermove', this.move);
    this.root.removeEventListener('pointerup', this.up);
    this.root.removeEventListener('pointercancel', this.up);
    this.root.removeEventListener('lostpointercapture', this.up);
    this.root.removeEventListener('contextmenu', this.context);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
