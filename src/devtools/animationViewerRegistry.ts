import { ASSETS } from '../config/assets';
import type { AssetManifest, SpriteAsset } from '../config/assets';

export interface ViewerEntity { id: string; animations: { id: string; asset: SpriteAsset }[] }

/** Character paths identify groups; adding a manifest animation needs no viewer list change. */
export function discoverAnimations(manifest: AssetManifest = ASSETS): ViewerEntity[] {
  const groups = new Map<string, ViewerEntity>();
  for (const [id, asset] of Object.entries(manifest)) {
    if (!/^assets\/sprites\/(player\/|enemies\/|boss\/)/.test(asset.path)) continue;
    const entity = id.split('.')[0] ?? id;
    if (!groups.has(entity)) groups.set(entity, { id: entity, animations: [] });
    groups.get(entity)?.animations.push({ id, asset });
  }
  return [...groups.values()];
}

export function assetStatus(asset: SpriteAsset, loaded: boolean): 'LOADED' | 'FALLBACK' | 'MISSING' {
  return loaded ? 'LOADED' : asset.url ? 'MISSING' : 'FALLBACK';
}

export class ViewerPlayback {
  index = 0;
  playing = true;
  fps = 1;
  private elapsed = 0;
  constructor(public asset: SpriteAsset) { this.select(asset); }
  get originalFps(): number { return this.asset.clip.frameRate ?? 1 / (this.asset.clip.frameTime ?? 1); }
  select(asset: SpriteAsset): void {
    this.asset = asset; this.index = 0; this.elapsed = 0; this.playing = true; this.resetFps();
  }
  resetFps(): void { this.fps = this.originalFps; }
  overrideFps(fps: number): void { this.fps = Math.max(1, Math.min(30, fps)); }
  seek(index: number): void {
    const count = this.asset.clip.frames.length;
    this.index = count ? ((index % count) + count) % count : 0;
    this.elapsed = 0; this.playing = false;
  }
  toggle(): void {
    if (!this.playing && this.asset.clip.loop === false && this.index === this.asset.clip.frames.length - 1) this.seek(0);
    this.playing = !this.playing;
  }
  tick(dt: number): void {
    if (!this.playing || this.asset.clip.frames.length === 0) return;
    this.elapsed += Math.max(0, dt) * this.fps;
    const steps = Math.floor(this.elapsed + 1e-9);
    this.elapsed -= steps;
    const next = this.index + steps;
    if (this.asset.clip.loop === false && next >= this.asset.clip.frames.length) {
      this.index = this.asset.clip.frames.length - 1; this.playing = false;
    } else this.index = next % this.asset.clip.frames.length;
  }
}
