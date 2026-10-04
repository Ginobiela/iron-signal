import { Group } from 'three';
import type { PowerupManager } from '../level/PowerupManager';
import { POWERUPS } from '../config/constants';
import { PICKUP_VISUAL } from '../config/graphics';
import { PowerupIcon } from './PowerupIcon';


export class PowerupView {
  readonly root = new Group();
  private readonly capsules: PowerupIcon[] = [];

  constructor(private readonly manager: PowerupManager) {
    for (const pickup of manager.items) {
      const capsule = new PowerupIcon();
      capsule.setKind(pickup.kind);
      capsule.root.visible = false;
      this.capsules.push(capsule);
      this.root.add(capsule.root);
    }
  }

  update(): void {
    for (let i = 0; i < this.capsules.length; i++) {
      const capsule = this.capsules[i];
      const pickup = this.manager.items[i];
      if (!capsule || !pickup) continue;
      capsule.root.visible = pickup.active && (pickup.lifeRemaining > POWERUPS.warningTime
        || Math.floor(pickup.lifeRemaining * POWERUPS.blinkRate) % 2 === 0);
      if (!pickup.active) continue;
      capsule.setKind(pickup.kind);
      capsule.root.position.set(Math.round(pickup.x + pickup.width / 2 + PICKUP_VISUAL.offsetX),
        Math.round(pickup.y + PICKUP_VISUAL.offsetY), 2.5);
    }
  }

  dispose(): void {
    for (const capsule of this.capsules) capsule.dispose();
  }
}
