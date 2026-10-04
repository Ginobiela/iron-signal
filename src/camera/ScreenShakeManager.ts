import { FEEDBACK } from '../config/constants';

export class ScreenShakeManager {
  readonly offset = { x: 0, y: 0 };
  private remaining = 0;
  private duration = 0;
  private strength = 0;

  trigger(strength: number, duration: number = FEEDBACK.shakeTime): void {
    if (strength <= 0 || duration <= 0) return;
    this.strength = Math.min(FEEDBACK.shakeLimit, Math.max(this.strength, strength));
    this.duration = this.remaining = Math.max(this.remaining, duration);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining === 0) { this.clear(); return; }
    const amplitude = this.strength * this.remaining / this.duration;
    this.offset.x = Math.round((Math.random() * 2 - 1) * amplitude);
    this.offset.y = Math.round((Math.random() * 2 - 1) * amplitude);
  }

  clear(): void { this.remaining = this.duration = this.strength = this.offset.x = this.offset.y = 0; }
}
