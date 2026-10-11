import { Weapon } from './Weapon';

export class Rifle extends Weapon {
  override get projectileLifetime(): number { return this.config.get().weapons.rifle.projectileLifetime; }
  readonly name = 'RIFLE';
  get fireRate(): number { return this.config.get().weapons.rifle.fireRate; }
  get projectileSpeed(): number { return this.config.get().weapons.rifle.projectileSpeed; }
  get damage(): number { return this.config.get().weapons.rifle.damage; }
}
