import { MACHINE_GUN } from '../config/constants';
import { Weapon } from './Weapon';

export class MachineGun extends Weapon {
  readonly name = 'MACHINE GUN';
  readonly fireRate = MACHINE_GUN.fireRate;
  readonly projectileSpeed = MACHINE_GUN.projectileSpeed;
  readonly damage = MACHINE_GUN.damage;
}
