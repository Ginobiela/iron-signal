import { PLAYER, PLAYER_COLLISION, WORLD } from '../config/constants';
import type { AABB, CollisionSystem } from '../collision/CollisionSystem';
import type { KinematicBody } from './Entity';
import { Rifle } from '../weapons/Rifle';
import type { Weapon } from '../weapons/Weapon';
import type { ProjectileManager } from '../projectiles/ProjectileManager';

export type PlayerState = 'IDLE' | 'RUN' | 'JUMP' | 'FALL' | 'CROUCH' | 'SHOOT' | 'DEAD';

export interface PlayerControls {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  up: boolean;
  shoot: boolean;
  down: boolean;
}

export class Player implements KinematicBody {
  readonly position: { x: number; y: number };
  readonly velocity = { x: 0, y: 0 };
  readonly width = PLAYER.width;
  height: number = PLAYER.height;
  direction: -1 | 1 = 1;
  readonly aimDirection = { x: 1, y: 0 };
  weapon: Weapon = new Rifle();
  shooting = false;
  jumpCount = 0;
  state: PlayerState = 'IDLE';
  grounded = false;
  health: number = PLAYER.maxHealth;
  invulnerabilityTimer = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private supportPlatform: AABB | null = null;
  private ignoredPlatform: AABB | null = null;
  private readonly standingBox: AABB = { x: 0, y: 0, ...PLAYER_COLLISION.standing };
  private readonly crouchingBox: AABB = { x: 0, y: 0, ...PLAYER_COLLISION.crouching };

  constructor(x: number, y: number) {
    this.position = { x, y };
  }

  get alive(): boolean {
    return this.health > 0;
  }

  get crouching(): boolean {
    return this.height < PLAYER.height;
  }

  get onOneWay(): boolean {
    return this.grounded && this.supportPlatform !== null;
  }

  get standingBounds(): AABB {
    this.standingBox.x = this.position.x;
    this.standingBox.y = this.position.y;
    return this.standingBox;
  }

  get crouchingBounds(): AABB {
    this.crouchingBox.x = this.position.x;
    this.crouchingBox.y = this.position.y;
    return this.crouchingBox;
  }

  get collisionBounds(): AABB { return this.crouching ? this.crouchingBounds : this.standingBounds; }

  canStandUp(collision: CollisionSystem, solids: readonly AABB[]): boolean {
    const box = this.standingBounds;
    return collision.canOccupy(box.x, box.y, box.width, box.height, solids);
  }

  get gunPivotY(): number {
    return PLAYER.gunPivotY * this.height / PLAYER.height;
  }

  die(): void {
    this.health = 0;
    this.state = 'DEAD';
    this.velocity.x = this.velocity.y = 0;
    this.shooting = false;
  }

  takeDamage(damage: number): boolean {
    if (!this.alive || this.invulnerabilityTimer > 0 || damage <= 0) return false;
    this.health = Math.max(0, this.health - damage);
    this.invulnerabilityTimer = PLAYER.invulnerabilityTime;
    if (!this.alive) {
      this.die();
    }
    return true;
  }

  reset(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
    this.velocity.x = this.velocity.y = 0;
    this.health = PLAYER.maxHealth;
    this.invulnerabilityTimer = 0;
    this.grounded = false;
    this.direction = 1;
    this.aimDirection.x = 1;
    this.aimDirection.y = 0;
    this.state = 'IDLE';
    this.shooting = false;
    this.coyoteTimer = this.jumpBufferTimer = 0;
    this.jumpCount = 0;
    this.supportPlatform = this.ignoredPlatform = null;
    this.height = PLAYER.height;
    this.weapon = new Rifle();
  }

  respawn(x: number, y: number): void {
    this.reset(x, y);
    this.invulnerabilityTimer = PLAYER.invulnerabilityTime;
  }

  updateCombat(dt: number, controls: PlayerControls, projectiles: ProjectileManager): void {
    if (!this.alive) return;
    const movingAim = controls.left !== controls.right;
    this.aimDirection.x = controls.up ? (movingAim ? this.direction * Math.SQRT1_2 : 0) : this.direction;
    this.aimDirection.y = controls.up ? (movingAim ? Math.SQRT1_2 : 1) : 0;
    this.shooting = controls.shoot;
    this.weapon.update(dt);
    if (this.shooting) {
      this.weapon.fire(projectiles, this.position.x + this.width / 2,
        this.position.y + this.gunPivotY, this.aimDirection, 'player', PLAYER.muzzleDistance);
      if (this.state === 'IDLE') this.state = 'SHOOT';
    }
  }

  update(dt: number, controls: PlayerControls, collision: CollisionSystem,
    solids: readonly AABB[], worldWidth: number, oneWays?: readonly AABB[]): void {
    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    if (!this.alive) return;
    this.coyoteTimer = this.grounded ? PLAYER.coyoteTime : Math.max(0, this.coyoteTimer - dt);
    this.jumpBufferTimer = controls.jumpPressed ? PLAYER.jumpBuffer : Math.max(0, this.jumpBufferTimer - dt);
    const axis = Number(controls.right) - Number(controls.left);
    if (controls.down && this.grounded) this.height = PLAYER.crouchHeight;
    else if (this.canStandUp(collision, solids)) {
      this.height = PLAYER.height;
    }
    this.velocity.x = this.crouching && this.grounded ? 0 : axis * PLAYER.speed;
    if (axis !== 0) this.direction = axis > 0 ? 1 : -1;
    if (controls.down && controls.jumpPressed && this.grounded && this.supportPlatform) {
      this.ignoredPlatform = this.supportPlatform;
      this.position.y -= PLAYER.dropOffset;
      this.velocity.y = -PLAYER.dropSpeed;
      this.grounded = false;
      this.jumpBufferTimer = this.coyoteTimer = 0;
    } else if (this.jumpBufferTimer > 0 && (this.grounded || this.coyoteTimer > 0) && !this.crouching) this.jump();

    const gravity = PLAYER.gravity * (this.velocity.y < 0 ? PLAYER.fallGravityMultiplier : 1);
    this.velocity.y = Math.max(-PLAYER.maxFallSpeed, this.velocity.y - gravity * dt);
    this.supportPlatform = collision.move(this, dt, solids, worldWidth, oneWays, this.ignoredPlatform);
    // Once the feet pass below the top, downward motion cannot catch this platform again.
    if (this.ignoredPlatform && this.position.y < this.ignoredPlatform.y + this.ignoredPlatform.height) {
      this.ignoredPlatform = null;
    }
    if (this.position.y < WORLD.killY) {
      this.die();
      return;
    }
    // Consume a buffered press on the landing step instead of delaying it a frame.
    if (this.grounded && this.jumpBufferTimer > 0 && !this.crouching) this.jump();
    this.state = this.grounded ? (this.crouching ? 'CROUCH' : this.velocity.x === 0 ? 'IDLE' : 'RUN')
      : (this.velocity.y > 0 ? 'JUMP' : 'FALL');
  }

  private jump(): void {
    this.jumpCount++;
    this.velocity.y = PLAYER.jumpSpeed;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }
}
