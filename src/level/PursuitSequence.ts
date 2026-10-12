import type { Boss } from '../bosses/Boss';
import type { Player, PlayerControls } from '../entities/Player';
import type { CollisionSystem } from '../collision/CollisionSystem';
import type { CameraController } from '../camera/CameraController';
import { VIEW } from '../config/constants';

/** Movement has already run: only combat facing is changed, enabling readable backpedal fire. */
export function updatePursuit(boss: Boss, player: Player, controls: PlayerControls,
  collision: CollisionSystem, camera: CameraController, worldWidth: number): void {
  const encounter = boss.encounter;
  if (!encounter || !boss.active || !boss.alive) return;
  collision.constrainHorizontal(player, encounter.retreatLeft, encounter.barrierX - player.width);
  player.direction = boss.position.x >= player.position.x ? 1 : -1;
  const moving = controls.left !== controls.right;
  controls.left = moving && player.direction < 0; controls.right = moving && player.direction > 0;
  const center = player.position.x + player.width / 2;
  const anchor = Math.max(.08, Math.min(encounter.cameraAnchor, (VIEW.width - (boss.position.x - center) - 24) / VIEW.width));
  camera.x = Math.max(0, Math.min(worldWidth - VIEW.width, center - VIEW.width * anchor));
}

export function pursuitExitReached(boss: Boss, player: Player, exitX: number): boolean {
  return !!boss.encounter && !boss.alive && player.alive && player.grounded && player.position.x <= exitX;
}
