import { Weapon } from './Weapon';

export class Laser extends Weapon {
  override get projectileLifetime(): number { return this.config.get().weapons.laser.projectileLifetime; }
  readonly name = 'LASER';
  get fireRate(): number { return this.config.get().weapons.laser.fireRate; }
  get projectileSpeed(): number { return this.config.get().weapons.laser.projectileSpeed; }
  get damage(): number { return this.config.get().weapons.laser.damage; }
  protected readonly projectileStyle = 'laser' as const;
}
