import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { AssetManager } from '../core/AssetManager';
import { DRAW, GRAPHICS } from '../config/assets';
import { VFX_EFFECTS, VFX_SHAKE } from '../config/vfx';
import type { VfxConfig, VfxId } from '../config/vfx';
import type { ParticleManager } from './ParticleManager';
import type { ScreenShakeManager } from '../camera/ScreenShakeManager';
import { SpriteVisual } from './SpriteVisual';

interface FxSlot {
  root: Group; sprite: SpriteVisual; fallback: Group; material: MeshBasicMaterial;
  id: VfxId | null; life: number; duration: number; textured: boolean;
}

/** All meshes are allocated at construction. Missing PNGs use the same slots. */
export class FxSpritePool {
  readonly root = new Group();
  private readonly slots: FxSlot[] = [];
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly coreMaterial = new MeshBasicMaterial({ color: 0xfff3c4, depthWrite: false });
  private debugVisible = false;
  droppedCount = 0;
  spawnedCount = 0;

  constructor(assets: AssetManager, private readonly particles?: ParticleManager,
    private readonly shake?: ScreenShakeManager, capacity: number = GRAPHICS.fxCapacity) {
    for (let i = 0; i < capacity; i++) {
      const root = new Group(), fallback = new Group();
      const sprite = new SpriteVisual(assets, { width: 8, height: 8, offsetX: 0, offsetY: 0, anchor: 'center' }, '', DRAW.fx);
      const material = new MeshBasicMaterial({ transparent: true, depthWrite: false });
      fallback.add(new Mesh(this.geometry, material), new Mesh(this.geometry, material), new Mesh(this.geometry, this.coreMaterial));
      root.add(sprite.root, fallback); root.visible = false;
      this.slots.push({ root, sprite, fallback, material, id: null, life: 0, duration: 0, textured: false });
      this.root.add(root);
    }
  }

  get capacity(): number { return this.slots.length; }
  get activeCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.life > 0) count++;
    return count;
  }

  spawn(id: VfxId, x: number, y: number, angle = 0): boolean {
    const effect: VfxConfig = VFX_EFFECTS[id];
    if (!effect) return false;
    for (const slot of this.slots) {
      if (slot.life > 0) continue;
      slot.id = id; slot.duration = slot.life = effect.frames / effect.fps;
      slot.root.position.set(Math.round(x), Math.round(y), effect.behind ? DRAW.fxBehind : DRAW.fx);
      slot.root.rotation.z = angle; slot.root.visible = true;
      slot.sprite.reset(); slot.textured = slot.sprite.update(id, 0, false, '', '', false);
      slot.sprite.setPlaceholderBounds(effect.width, effect.height);
      slot.sprite.root.visible = slot.textured || this.debugVisible;
      slot.fallback.visible = !slot.textured; slot.fallback.scale.setScalar(1);
      slot.material.color.setHex(effect.color); slot.material.opacity = 1;
      const horizontal = slot.fallback.children[0], vertical = slot.fallback.children[1], core = slot.fallback.children[2];
      horizontal?.scale.set(effect.fallbackWidth, effect.kind === 'muzzle' ? effect.fallbackHeight : 1, 1);
      vertical?.scale.set(1, effect.fallbackHeight, 1);
      if (vertical) vertical.visible = effect.kind !== 'muzzle';
      core?.scale.set(1, 1, 1);
      if (core) core.position.z = DRAW.detail;
      this.particles?.burst(x, y, effect.particles, effect.color, effect.kind === 'burst', slot.duration);
      if (effect.shake) this.shake?.trigger(effect.shake, VFX_SHAKE.flyingTime);
      this.spawnedCount++;
      return true;
    }
    this.droppedCount++;
    return false;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (const slot of this.slots) {
      if (slot.life <= 0 || !slot.id) continue;
      slot.life = Math.max(0, slot.life - dt);
      if (slot.textured) slot.sprite.update(slot.id, dt);
      else {
        slot.material.opacity = slot.life / slot.duration;
        const effect: VfxConfig = VFX_EFFECTS[slot.id];
        if (effect.kind === 'burst') slot.fallback.scale.setScalar(1 + (1 - slot.life / slot.duration) * 0.5);
      }
      slot.root.visible = slot.life > Number.EPSILON && !(slot.textured && slot.sprite.animator.completed);
      if (!slot.root.visible) slot.life = 0;
    }
  }

  setDebug(visible: boolean): void {
    this.debugVisible = visible;
    for (const slot of this.slots) { slot.sprite.setDebug(visible); slot.sprite.root.visible = slot.textured || visible; }
  }
  clear(): void {
    for (const slot of this.slots) { slot.life = 0; slot.root.visible = false; }
    this.spawnedCount = this.droppedCount = 0;
  }
  dispose(): void {
    for (const slot of this.slots) { slot.sprite.dispose(); slot.material.dispose(); }
    this.geometry.dispose(); this.coreMaterial.dispose();
  }
}
