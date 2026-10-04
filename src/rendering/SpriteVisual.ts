import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { AssetManager } from '../core/AssetManager';
import type { AnimationClip } from './SpriteAnimator';
import { SpriteAnimator } from './SpriteAnimator';
import { DRAW } from '../config/assets';
import type { VisualConfig } from '../config/graphics';
import { spriteCenterY, writeFrameUV } from './spriteFrames';

/** Owns geometry/UVs, never texture clones. Physics has no reference to this object. */
export class SpriteVisual {
  readonly root = new Group();
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly animator: SpriteAnimator;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly debugGeometry = new PlaneGeometry(1, 1);
  private readonly material = new MeshBasicMaterial({ transparent: true, alphaTest: 0.01, depthWrite: false });
  private readonly boundsMaterial = new MeshBasicMaterial({ color: 0x00eaff, wireframe: true });
  private readonly anchorMaterial = new MeshBasicMaterial({ color: 0xffee66 });
  private readonly originMaterial = new MeshBasicMaterial({ color: 0xff55dd });
  private readonly bounds = new Mesh(this.debugGeometry, this.boundsMaterial);
  private readonly anchor = new Mesh(this.debugGeometry, this.anchorMaterial);
  private readonly origin = new Mesh(this.debugGeometry, this.originMaterial);
  private readonly uvRect = { left: 0, right: 1, bottom: 0, top: 1 };
  private lastId = '';
  private lastFrame = -1;
  private debugVisible = false;
  private originX = 0;
  private originY = 0;
  assetId = '';
  available = false;

  constructor(private readonly assets: AssetManager, private readonly fallbackConfig: VisualConfig,
    private readonly defaultId = '', private readonly worldLayer: number = DRAW.entity) {
    const clips: Record<string, AnimationClip> = {};
    for (const [id, asset] of Object.entries(assets.manifest)) clips[id] = asset.clip;
    this.animator = new SpriteAnimator(clips);
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    this.anchor.scale.set(3, 1, 1); this.origin.scale.set(1, 3, 1);
    this.root.add(this.mesh, this.bounds, this.anchor, this.origin);
    this.setDebug(false);
    this.configure(fallbackConfig);
  }

  update(id: string, dt: number, flipX = false, fallback = '', alternate = '', allowDefault = true): boolean {
    this.assetId = this.assets.getTexture(id) ? id : this.assets.getTexture(alternate) ? alternate
      : this.assets.getTexture(fallback) ? fallback : id.endsWith('.death') || id.includes('.death_') ? ''
      : allowDefault && this.assets.getTexture(this.defaultId) ? this.defaultId : '';
    this.available = this.assetId !== '';
    this.mesh.visible = this.available;
    const asset = this.assets.getSpriteSheet(this.assetId);
    const texture = this.assets.getTexture(this.assetId);
    if (!asset || !texture) { this.configure(this.fallbackConfig); return false; }
    this.animator.flipX = flipX;
    const frame = this.animator.update(this.assetId, dt);
    this.configure(asset.visual);
    this.mesh.scale.x *= flipX ? -1 : 1;
    this.material.map = texture;
    if (this.lastId !== this.assetId || this.lastFrame !== frame) {
      const image = texture.image as { width: number; height: number };
      writeFrameUV(asset.sheet, frame, image.width, image.height, this.uvRect);
      const uv = this.geometry.getAttribute('uv');
      uv.setXY(0, this.uvRect.left, this.uvRect.top); uv.setXY(1, this.uvRect.right, this.uvRect.top);
      uv.setXY(2, this.uvRect.left, this.uvRect.bottom); uv.setXY(3, this.uvRect.right, this.uvRect.bottom);
      uv.needsUpdate = true;
      if (this.lastId !== this.assetId) this.material.needsUpdate = true;
      this.lastId = this.assetId; this.lastFrame = frame;
    }
    return true;
  }

  private configure(config: VisualConfig): void {
    const width = config.width * (config.scaleX ?? 1), height = config.height * (config.scaleY ?? 1);
    this.mesh.scale.set(width, height, 1);
    this.mesh.position.set(config.offsetX, spriteCenterY(config), DRAW.detail);
    this.bounds.scale.set(width, height, 1);
    this.bounds.position.set(config.offsetX, spriteCenterY(config), DRAW.debug - this.worldLayer);
    this.anchor.position.set(config.offsetX, config.offsetY, DRAW.debug - this.worldLayer + DRAW.detail);
    this.origin.position.set(this.originX, this.originY, DRAW.debug - this.worldLayer + DRAW.trim);
  }

  tint(color: number): void { this.material.color.setHex(color); }
  setEntityOrigin(x: number, y: number): void { this.originX = x; this.originY = y; }
  setPlaceholderBounds(width: number, height: number, offsetY = 0): void {
    if (this.available) return;
    this.bounds.scale.set(width, height, 1);
    this.bounds.position.y = offsetY + (this.fallbackConfig.anchor === 'bottom-center' ? height / 2 : 0);
  }
  setDebug(visible: boolean): void {
    this.debugVisible = visible;
    this.bounds.visible = this.anchor.visible = this.origin.visible = this.debugVisible;
  }
  reset(): void { this.animator.reset(); this.lastFrame = -1; }
  dispose(): void {
    this.geometry.dispose(); this.debugGeometry.dispose(); this.material.dispose();
    this.boundsMaterial.dispose(); this.anchorMaterial.dispose(); this.originMaterial.dispose();
  }
}
