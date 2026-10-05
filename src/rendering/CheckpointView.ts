import { DRAW } from '../config/assets';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { CheckpointManager } from '../level/Checkpoint';
import type { AssetManager } from '../core/AssetManager';
import { ENVIRONMENT } from '../config/environment';
import { SpriteVisual } from './SpriteVisual';

export class CheckpointView {
  readonly root = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly poleMaterial = new MeshBasicMaterial({ color: 0x99c0ba });
  private readonly waitingMaterial = new MeshBasicMaterial({ color: 0x407e85 });
  private readonly activeMaterial = new MeshBasicMaterial({ color: 0xffe3a2 });
  private readonly flags: Mesh[] = [];
  private readonly poles: Mesh[] = [];
  private readonly sprites: (SpriteVisual | null)[] = [];

  constructor(private readonly manager: CheckpointManager, assets: AssetManager) {
    for (const checkpoint of manager.items) {
      const pole = new Mesh(this.geometry, this.poleMaterial);
      pole.position.set(checkpoint.x + 1, checkpoint.y + 18, DRAW.decoration);
      pole.scale.set(2, 36, 1);
      const flag = new Mesh(this.geometry, this.waitingMaterial);
      flag.position.set(checkpoint.x + 9, checkpoint.y + 29, DRAW.decoration);
      flag.scale.set(14, 10, 1);
      this.flags.push(flag);
      this.poles.push(pole);
      const sprite = checkpoint.x >= ENVIRONMENT.sliceStart && checkpoint.x < ENVIRONMENT.sliceEnd
        ? new SpriteVisual(assets, { width: 16, height: 32, offsetX: 0, offsetY: 0, anchor: 'bottom-center' }, '', DRAW.decoration) : null;
      if (sprite) { sprite.root.position.set(checkpoint.x + 8, checkpoint.y, DRAW.decoration); this.root.add(sprite.root); }
      this.sprites.push(sprite);
      this.root.add(pole, flag);
    }
  }

  update(dt = 0): void {
    for (let i = 0; i < this.flags.length; i++) {
      const flag = this.flags[i];
      const checkpoint = this.manager.items[i];
      if (flag && checkpoint) {
        const active = checkpoint.x <= this.manager.current.x;
        flag.material = active ? this.activeMaterial : this.waitingMaterial;
        const hasSprite = this.sprites[i]?.update(`environment.checkpoint.${active ? 'active' : 'waiting'}`, dt) ?? false;
        flag.visible = !hasSprite;
        const pole = this.poles[i]; if (pole) pole.visible = !hasSprite;
      }
    }
  }

  dispose(): void {
    for (const sprite of this.sprites) sprite?.dispose();
    this.geometry.dispose();
    this.poleMaterial.dispose();
    this.waitingMaterial.dispose();
    this.activeMaterial.dispose();
  }
  setGraphicsDebug(visible: boolean): void { for (const sprite of this.sprites) sprite?.setDebug(visible); }
}
