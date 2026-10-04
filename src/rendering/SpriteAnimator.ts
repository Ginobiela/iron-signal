export interface AnimationClip {
  frames: readonly number[]; frameTime?: number; frameRate?: number; loop?: boolean;
  onComplete?: () => void;
}

// Frame indices also map directly to cells in a sprite sheet; physics never reads them.
export class SpriteAnimator {
  frame = 0;
  private current = '';
  private elapsed = 0;
  flipX = false;
  completed = false;

  get animation(): string { return this.current; }

  constructor(private readonly clips: Readonly<Record<string, AnimationClip>>) {}

  play(name: string): boolean {
    const clip = this.clips[name];
    if (!clip || clip.frames.length === 0) return false;
    if (this.current === name) return true;
    this.current = name; this.elapsed = 0; this.completed = false;
    this.frame = clip.frames[0] ?? 0;
    return true;
  }

  reset(): void { this.current = ''; this.elapsed = 0; this.completed = false; this.frame = 0; }

  tick(dt: number): number {
    const clip = this.clips[this.current];
    if (!clip) return this.frame;
    const frameTime = clip.frameRate ? 1 / clip.frameRate : clip.frameTime ?? 1;
    if (frameTime <= 0) return this.frame;
    this.elapsed += Math.max(0, dt);
    const index = Math.floor((this.elapsed + Number.EPSILON) / frameTime);
    this.frame = clip.frames[clip.loop === false ? Math.min(index, clip.frames.length - 1) : index % clip.frames.length] ?? 0;
    if (clip.loop === false && index >= clip.frames.length && !this.completed) {
      this.completed = true;
      clip.onComplete?.();
    }
    return this.frame;
  }

  update(name: string, dt: number): number {
    const changed = name !== this.current;
    if (!this.play(name)) return this.frame;
    return this.tick(changed ? 0 : dt);
  }
}
