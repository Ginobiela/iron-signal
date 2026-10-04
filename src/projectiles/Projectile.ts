export type ProjectileOwner = 'player' | 'enemy';
export type ProjectileStyle = 'bullet' | 'laser';

export class Projectile {
  readonly position = { x: 0, y: 0 };
  readonly previousPosition = { x: 0, y: 0 };
  readonly velocity = { x: 0, y: 0 };
  damage = 0;
  owner: ProjectileOwner = 'player';
  style: ProjectileStyle = 'bullet';
  active = false;
  lifeRemaining = 0;
  fresh = true;
}
