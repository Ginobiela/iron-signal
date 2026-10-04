import { Group } from 'three';
import type { AssetManager } from '../core/AssetManager';
import { DRAW, GRAPHICS } from '../config/assets';
import { SpriteVisual } from './SpriteVisual';

/** Optional animated overlays; existing pooled particles remain the missing-asset fallback. */
export class FxSpritePool {
  readonly root = new Group();
  private readonly slots: { sprite: SpriteVisual; id: string; life: number }[] = [];
  constructor(private readonly assets: AssetManager) {
    for (let i = 0; i < GRAPHICS.fxCapacity; i++) {
      const sprite = new SpriteVisual(assets, { width: 8, height: 8, offsetX: 0, offsetY: 0, anchor: 'center' }, '', DRAW.fx);
      sprite.root.visible = false;
      this.slots.push({ sprite, id: '', life: 0 }); this.root.add(sprite.root);
    }
    this.root.position.z = DRAW.fx;
  }
  spawn(id: string, x: number, y: number, angle = 0): void {
    const asset = this.assets.getSpriteSheet(id);
    if (!asset || !this.assets.getTexture(id)) return;
    const slot = this.slots.find((item) => item.life <= 0);
    if (!slot) return;
    slot.id = id;
    slot.life = asset.clip.frames.length * (asset.clip.frameRate ? 1 / asset.clip.frameRate : asset.clip.frameTime ?? 1);
    slot.sprite.reset();
    slot.sprite.root.position.set(Math.round(x), Math.round(y), 0);
    slot.sprite.root.rotation.z = angle; slot.sprite.root.visible = true;
    slot.sprite.update(id, 0);
  }
  update(dt: number): void {
    for (const slot of this.slots) {
      if (slot.life <= 0) continue;
      slot.life = Math.max(0, slot.life - dt);
      slot.sprite.update(slot.id, dt); slot.sprite.root.visible = slot.life > 0;
    }
  }
  clear(): void { for (const slot of this.slots) { slot.life = 0; slot.sprite.root.visible = false; } }
  dispose(): void { for (const slot of this.slots) slot.sprite.dispose(); }
}
