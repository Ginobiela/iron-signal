import { DEFAULT_CONFIG_SOURCE } from '../config/gameplay';
import type { GameplayConfigSource } from '../config/gameplay';
import { VIEW } from '../config/constants';

export class CameraController {
  x = 0;

  constructor(private readonly worldWidth: number, private readonly config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {}

  update(playerCenterX: number): void {
    const screenX = playerCenterX - this.x;
    const forward = VIEW.width * this.config.get().camera.forwardAnchor;
    const backward = VIEW.width * this.config.get().camera.backwardAnchor;
    if (screenX > forward + this.config.get().camera.deadZone) this.x = playerCenterX - forward - this.config.get().camera.deadZone;
    else if (screenX < backward - this.config.get().camera.deadZone) this.x = playerCenterX - backward + this.config.get().camera.deadZone;
    this.x = Math.max(0, Math.min(Math.max(0, this.worldWidth - VIEW.width), this.x));
  }
}
