import { Group } from 'three';
import type { AssetManager } from '../core/AssetManager';
import type { PowerupKind } from '../level/PowerupManager';
import { DRAW } from '../config/assets';
import { PICKUP_VISUAL } from '../config/graphics';
import { SpriteVisual } from './SpriteVisual';
import { PowerupIcon } from './PowerupIcon';

export class FlyingCargoVisual {
  readonly root = new Group();
  private readonly pod: SpriteVisual;
  private readonly label: SpriteVisual;
  private readonly fallback: PowerupIcon;
  private kind: PowerupKind = 'M';

  constructor(assets: AssetManager) {
    this.pod = new SpriteVisual(assets, PICKUP_VISUAL, '', DRAW.entity);
    this.label = new SpriteVisual(assets, PICKUP_VISUAL, '', DRAW.entity);
    this.label.root.position.z = DRAW.detail;
    this.fallback = new PowerupIcon(assets);
    this.fallback.root.scale.setScalar(0.7);
    this.root.add(this.pod.root, this.label.root, this.fallback.root);
  }

  setKind(kind: PowerupKind): void { this.kind = kind; this.fallback.setKind(kind); }
  update(dt: number): void {
    const pod = this.pod.update('flying.carrier.pod', dt);
    const label = this.label.update(`flying.carrier.${this.kind}`, dt);
    this.pod.root.visible = this.label.root.visible = pod && label;
    this.fallback.root.visible = !(pod && label);
    if (this.fallback.root.visible) this.fallback.update(dt);
  }
  setGraphicsDebug(visible: boolean): void {
    this.pod.setDebug(visible); this.label.setDebug(visible); this.fallback.setGraphicsDebug(visible);
  }
  dispose(): void { this.pod.dispose(); this.label.dispose(); this.fallback.dispose(); }
}
