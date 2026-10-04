import { RIFLE } from '../config/constants';
import { Weapon } from './Weapon';

export class Rifle extends Weapon {
  readonly name = 'RIFLE';
  readonly fireRate = RIFLE.fireRate;
  readonly projectileSpeed = RIFLE.projectileSpeed;
  readonly damage = RIFLE.damage;
}
