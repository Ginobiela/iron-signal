import { DEFAULT_CONFIG_SOURCE } from '../config/gameplay';
import { WEAPON_PROJECTILE_ART } from '../config/projectileArt';
import type { GameplayConfigSource } from '../config/gameplay';
import type { Vector2 } from '../entities/Entity';
import type { ProjectileOwner, ProjectileStyle } from '../projectiles/Projectile';
import type { ProjectileManager } from '../projectiles/ProjectileManager';

export abstract class Weapon {
  abstract readonly name: string;
  abstract readonly fireRate: number;
  abstract readonly projectileSpeed: number;
  abstract readonly damage: number;
  protected readonly projectileStyle: ProjectileStyle = 'bullet';
  protected get projectileVisualId(): string { return WEAPON_PROJECTILE_ART[this.name] ?? ''; }
  private cooldown = 0;

  constructor(protected readonly config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) {}

  get projectileLifetime(): number { return this.config.get().weapons.rifle.projectileLifetime; }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  fire(projectiles: ProjectileManager, x: number, y: number, aim: Vector2,
    owner: ProjectileOwner, muzzleDistance = 0): boolean {
    if (this.cooldown > Number.EPSILON) return false;
    if (!this.emit(projectiles, x, y, aim, owner, muzzleDistance)) return false;
    this.cooldown = 1 / this.fireRate;
    return true;
  }

  protected emit(projectiles: ProjectileManager, x: number, y: number, aim: Vector2,
    owner: ProjectileOwner, muzzleDistance: number): boolean {
    return projectiles.spawn(x, y, aim.x * this.projectileSpeed, aim.y * this.projectileSpeed,
      this.damage, owner, muzzleDistance, this.projectileStyle, this.projectileLifetime, 0, this.projectileVisualId);
  }
}
