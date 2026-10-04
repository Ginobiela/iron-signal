import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { CheckpointManager } from '../level/Checkpoint';

export class CheckpointView {
  readonly root = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly poleMaterial = new MeshBasicMaterial({ color: 0x99c0ba });
  private readonly waitingMaterial = new MeshBasicMaterial({ color: 0x407e85 });
  private readonly activeMaterial = new MeshBasicMaterial({ color: 0xffe3a2 });
  private readonly flags: Mesh[] = [];

  constructor(private readonly manager: CheckpointManager) {
    for (const checkpoint of manager.items) {
      const pole = new Mesh(this.geometry, this.poleMaterial);
      pole.position.set(checkpoint.x + 1, checkpoint.y + 18, 2);
      pole.scale.set(2, 36, 1);
      const flag = new Mesh(this.geometry, this.waitingMaterial);
      flag.position.set(checkpoint.x + 9, checkpoint.y + 29, 2);
      flag.scale.set(14, 10, 1);
      this.flags.push(flag);
      this.root.add(pole, flag);
    }
  }

  update(): void {
    for (let i = 0; i < this.flags.length; i++) {
      const flag = this.flags[i];
      const checkpoint = this.manager.items[i];
      if (flag && checkpoint) flag.material = checkpoint.x <= this.manager.current.x
        ? this.activeMaterial : this.waitingMaterial;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.poleMaterial.dispose();
    this.waitingMaterial.dispose();
    this.activeMaterial.dispose();
  }
}
