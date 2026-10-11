import { Weapon } from './Weapon';

export class MachineGun extends Weapon {
  override get projectileLifetime(): number { return this.config.get().weapons.machineGun.projectileLifetime; }
  readonly name = 'MACHINE GUN';
  get fireRate(): number { return this.config.get().weapons.machineGun.fireRate; }
  get projectileSpeed(): number { return this.config.get().weapons.machineGun.projectileSpeed; }
  get damage(): number { return this.config.get().weapons.machineGun.damage; }
}
