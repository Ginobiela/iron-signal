import { CAMERA, VIEW } from '../config/constants';

export class CameraController {
  x = 0;

  constructor(private readonly worldWidth: number) {}

  update(playerCenterX: number): void {
    const screenX = playerCenterX - this.x;
    const forward = VIEW.width * CAMERA.forwardAnchor;
    const backward = VIEW.width * CAMERA.backwardAnchor;
    if (screenX > forward + CAMERA.deadZone) this.x = playerCenterX - forward - CAMERA.deadZone;
    else if (screenX < backward - CAMERA.deadZone) this.x = playerCenterX - backward + CAMERA.deadZone;
    this.x = Math.max(0, Math.min(Math.max(0, this.worldWidth - VIEW.width), this.x));
  }
}
