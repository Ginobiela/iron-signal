import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { FEEDBACK, PLAYER, PLAYER_COLLISION } from '../config/constants';
import { PLAYER_ANIMATIONS, PLAYER_VISUAL } from '../config/graphics';
import type { PlayerAnimation } from '../config/graphics';
import type { Player } from '../entities/Player';
import { SpriteAnimator } from './SpriteAnimator';
import { SpriteVisual } from './SpriteVisual';
import type { AssetManager } from '../core/AssetManager';
import { DRAW } from '../config/assets';

const groundedSprites: Partial<Record<PlayerAnimation, Record<'horizontal' | 'up' | 'diagonal', string>>> = {
  idle: { horizontal: 'player.idle', up: 'player.idle_up', diagonal: 'player.idle_diagonal' },
  run: { horizontal: 'player.run', up: 'player.runShoot_up', diagonal: 'player.runShoot_diagonal' },
  shoot: { horizontal: 'player.shoot_horizontal', up: 'player.shoot_up', diagonal: 'player.shoot_diagonal' },
  runShoot: { horizontal: 'player.runShoot_horizontal', up: 'player.runShoot_up', diagonal: 'player.runShoot_diagonal' },
};

export class PlayerView {
  readonly root = new Group();
  private readonly silhouette = new Group();
  private readonly gun = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly leftLeg: Mesh;
  private readonly rightLeg: Mesh;
  private readonly bounds: Mesh;
  private readonly standingBounds: Mesh;
  private readonly crouchingBounds: Mesh;
  private readonly animator = new SpriteAnimator(PLAYER_ANIMATIONS);
  animation: PlayerAnimation = 'idle';
  facing: 'left' | 'right' = 'right';
  private readonly muzzle: Mesh;
  private muzzleTimer = 0;
  private readonly sprite: SpriteVisual;

  constructor(private readonly assets: AssetManager) {
    this.sprite = new SpriteVisual(assets, PLAYER_VISUAL, 'player.idle');
    this.sprite.setEntityOrigin(-PLAYER.width / 2, 0);
    this.root.add(this.sprite.root);
    const teal = new MeshBasicMaterial({ color: 0x99c0ba });
    const orange = new MeshBasicMaterial({ color: 0xd99758 });
    const light = new MeshBasicMaterial({ color: 0xe4dbc5 });
    const dark = new MeshBasicMaterial({ color: 0x172631 });
    const outline = new MeshBasicMaterial({ color: 0x82ff96, wireframe: true });
    const standingOutline = new MeshBasicMaterial({ color: 0x719eff, wireframe: true });
    const crouchingOutline = new MeshBasicMaterial({ color: 0xe9b563, wireframe: true });
    this.materials.push(teal, orange, light, dark, outline, standingOutline, crouchingOutline);
    const rect = (x: number, y: number, w: number, h: number, material: MeshBasicMaterial, z: number = DRAW.level): Mesh => {
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(x + w / 2, y + h / 2, z);
      mesh.scale.set(w, h, 1);
      this.silhouette.add(mesh);
      return mesh;
    };
    this.leftLeg = rect(-6, 0, 4, 9, teal);
    this.rightLeg = rect(1, 0, 4, 9, teal);
    rect(-6, 9, 11, 10, orange);
    rect(-4, 19, 8, 7, teal);
    rect(1, 21, 4, 2, dark, DRAW.detail);
    const barrel = new Mesh(this.geometry, light);
    barrel.position.x = (3 + PLAYER.muzzleDistance) / 2;
    barrel.scale.set(PLAYER.muzzleDistance - 3, 3, 1);
    this.gun.add(barrel);
    this.muzzle = new Mesh(this.geometry, light);
    this.muzzle.position.set(PLAYER.muzzleDistance + 1, 0, DRAW.detail);
    this.muzzle.scale.set(3, 5, 1);
    this.muzzle.visible = false;
    this.gun.add(this.muzzle);
    this.gun.position.set(0, PLAYER.gunPivotY, DRAW.detail);
    this.bounds = new Mesh(this.geometry, outline);
    this.bounds.position.set(0, PLAYER.height / 2, DRAW.collider);
    this.bounds.scale.set(PLAYER.width, PLAYER.height, 1);
    this.bounds.visible = false;
    this.standingBounds = new Mesh(this.geometry, standingOutline);
    this.standingBounds.position.set(0, PLAYER_COLLISION.standing.height / 2, DRAW.overlay);
    this.standingBounds.scale.set(PLAYER_COLLISION.standing.width, PLAYER_COLLISION.standing.height, 1);
    this.crouchingBounds = new Mesh(this.geometry, crouchingOutline);
    this.crouchingBounds.position.set(0, PLAYER_COLLISION.crouching.height / 2, DRAW.overlay);
    this.crouchingBounds.scale.set(PLAYER_COLLISION.crouching.width, PLAYER_COLLISION.crouching.height, 1);
    this.standingBounds.visible = this.crouchingBounds.visible = false;
    this.root.add(this.silhouette, this.gun, this.standingBounds, this.crouchingBounds, this.bounds);
    this.root.position.z = DRAW.entity;
  }

  update(player: Player, dt: number): void {
    this.root.visible = player.alive
      && (player.invulnerabilityTimer <= 0 || Math.floor(player.invulnerabilityTimer * 12) % 2 === 0);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    this.muzzle.visible = this.muzzleTimer > 0 && player.alive;
    this.facing = player.direction < 0 ? 'left' : 'right';
    this.animation = !player.alive ? 'death' : player.crouching ? (player.shooting ? 'crouchShoot' : 'crouch')
      : !player.grounded ? (player.shooting ? 'jumpShoot' : player.velocity.y > 0 ? 'jump' : 'fall')
      : player.velocity.x !== 0 ? (player.shooting ? 'runShoot' : 'run') : player.shooting ? 'shoot' : 'idle';
    const frame = this.animator.update(this.animation, dt);
    const stride = frame === 0 ? -2 : frame === 2 ? 2 : 0;
    this.leftLeg.position.x = -4 + stride;
    this.rightLeg.position.x = 3 - stride;
    this.leftLeg.position.y = player.grounded ? 4.5 : 7;
    this.rightLeg.position.y = player.grounded ? 4.5 : 5;
    this.silhouette.scale.x = player.direction * PLAYER_VISUAL.width / 12;
    this.silhouette.scale.y = (player.crouching ? PLAYER_VISUAL.crouchHeight : PLAYER_VISUAL.height) / 26;
    this.silhouette.position.set(PLAYER_VISUAL.offsetX, PLAYER_VISUAL.offsetY, 0);
    this.gun.position.y = player.gunPivotY;
    this.gun.position.x = this.muzzleTimer > 0 ? -player.aimDirection.x * FEEDBACK.recoilPixels : 0;
    this.bounds.scale.y = player.height;
    this.bounds.position.y = player.height / 2;
    this.gun.rotation.z = Math.atan2(player.aimDirection.y, player.aimDirection.x);
    this.root.position.x = Math.round(player.position.x + player.width / 2);
    this.root.position.y = Math.round(player.position.y);
    const aim = player.aimDirection.y > 0 ? (player.aimDirection.x === 0 ? 'up' : 'diagonal') : 'horizontal';
    const base = `player.${this.animation}`;
    const fallback = player.crouching ? 'player.crouch' : !player.grounded
      ? (player.velocity.y > 0 ? 'player.jump' : 'player.fall') : player.velocity.x !== 0 ? 'player.run' : 'player.idle';
    // Baked rifles cannot represent an unavailable shooting/airborne/upward pose correctly.
    const poseFallback = player.alive && player.grounded && !player.shooting && aim === 'horizontal';
    const baseMatchesAim = this.animation === 'death' || aim === 'horizontal' || !this.assets.getSpriteSheet(base)?.includesWeapon;
    const spriteId = groundedSprites[this.animation]?.[aim] ?? `${base}_${aim}`;
    const hasSprite = this.sprite.update(spriteId, dt, player.direction < 0,
      poseFallback ? fallback : '', baseMatchesAim ? base : '', poseFallback);
    this.silhouette.visible = !hasSprite;
    this.sprite.setPlaceholderBounds(PLAYER_VISUAL.width, player.crouching ? PLAYER_VISUAL.crouchHeight : PLAYER_VISUAL.height);
    this.gun.visible = player.alive && (!hasSprite || !this.assets.getSpriteSheet(this.sprite.assetId)?.includesWeapon);
    if (!player.alive && hasSprite) this.root.visible = !this.sprite.animator.completed;
  }

  setDebug(visible: boolean): void {
    this.bounds.visible = visible;
    this.standingBounds.visible = this.crouchingBounds.visible = visible;
  }

  flashMuzzle(): void { this.muzzleTimer = FEEDBACK.muzzleTime; }

  resetFeedback(): void { this.muzzleTimer = 0; this.sprite.reset(); }

  setGraphicsDebug(visible: boolean): void { this.sprite.setDebug(visible); }

  dispose(): void {
    this.geometry.dispose();
    this.sprite.dispose();
    for (const material of this.materials) material.dispose();
  }
}
