import { LASER } from '../config/constants';
import { Weapon } from './Weapon';

export class Laser extends Weapon {
  readonly name = 'LASER';
  readonly fireRate = LASER.fireRate;
  readonly projectileSpeed = LASER.projectileSpeed;
  readonly damage = LASER.damage;
  protected readonly projectileStyle = 'laser' as const;
}
