export interface AnimationClip { frames: readonly number[]; frameTime: number; loop?: boolean }

// Frame indices also map directly to cells in a sprite sheet; physics never reads them.
export class SpriteAnimator {
  frame = 0;
  private current = '';
  private elapsed = 0;

  constructor(private readonly clips: Readonly<Record<string, AnimationClip>>) {}

  update(name: string, dt: number): number {
    const clip = this.clips[name];
    if (!clip || clip.frames.length === 0 || clip.frameTime <= 0) return this.frame;
    if (this.current !== name) { this.current = name; this.elapsed = 0; }
    else this.elapsed += dt;
    const index = Math.floor((this.elapsed + Number.EPSILON) / clip.frameTime);
    this.frame = clip.frames[clip.loop === false ? Math.min(index, clip.frames.length - 1) : index % clip.frames.length] ?? 0;
    return this.frame;
  }
}
