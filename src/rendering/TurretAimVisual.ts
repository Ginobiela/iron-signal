import { Group } from 'three';
import type { AssetManager } from '../core/AssetManager';
import { ASSETS } from '../config/assets';
import { TURRET_ART, turretAimAngle } from '../config/turretArt';
import { SpriteVisual } from './SpriteVisual';

/** Two atlas regions of the same texture; no PNG copies or gameplay objects. */
export class TurretAimVisual {
  readonly root = new Group();
  readonly pivot = new Group();
  readonly base: SpriteVisual;
  readonly head: SpriteVisual;

  constructor(assets: AssetManager, private readonly prefix: keyof typeof TURRET_ART) {
    const asset = assets.manifest[`${prefix}.idle`] ?? ASSETS[`${prefix}.idle`]!;
    const joint = TURRET_ART[prefix];
    this.base = new SpriteVisual(assets, asset.visual);
    this.head = new SpriteVisual(assets, asset.visual);
    this.pivot.position.set((joint.pivotX / asset.sheet.frameWidth - .5) * asset.visual.width,
      (1 - joint.pivotY / asset.sheet.frameHeight) * asset.visual.height, 0);
    this.pivot.add(this.head.root); this.root.add(this.base.root, this.pivot);
    this.root.visible = false;
  }

  update(animation: string, dt: number, aim: { x: number; y: number }, facing: number): boolean {
    const base = this.base.update(`${this.prefix}.parts.${animation}.base`, dt, false, `${this.prefix}.parts.idle.base`, '', false);
    const head = this.head.update(`${this.prefix}.parts.${animation}.head`, dt, false, `${this.prefix}.parts.idle.head`, '', false);
    this.root.visible = base && head;
    this.root.scale.x = facing;
    const angle = turretAimAngle(aim);
    this.pivot.rotation.z = facing < 0 ? Math.PI - angle : angle;
    return this.root.visible;
  }

  tint(color: number): void { this.base.tint(color); this.head.tint(color); }
  setDebug(visible: boolean): void { this.base.setDebug(visible); this.head.setDebug(visible); }
  dispose(): void { this.base.dispose(); this.head.dispose(); }
}
