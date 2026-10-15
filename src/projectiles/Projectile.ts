export type ProjectileOwner = 'player' | 'enemy';
export type ProjectileStyle = 'bullet' | 'laser' | 'missile';

export class Projectile {
  readonly position = { x: 0, y: 0 };
  readonly previousPosition = { x: 0, y: 0 };
  readonly velocity = { x: 0, y: 0 };
  damage = 0;
  owner: ProjectileOwner = 'player';
  style: ProjectileStyle = 'bullet';
  /** Rendering only; never used by collision, damage or steering. */
  visualId = '';
  active = false;
  lifeRemaining = 0;
  fresh = true;
  turnRate = 0;
}

export function steerHoming(projectile: Projectile, target: { x: number; y: number }, dt: number): void {
  const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
  if (!speed || !projectile.turnRate) return;
  const angle = Math.atan2(projectile.velocity.y, projectile.velocity.x);
  const desired = Math.atan2(target.y - projectile.position.y, target.x - projectile.position.x);
  const difference = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
  const maxTurn = projectile.turnRate * dt;
  const next = angle + Math.max(-maxTurn, Math.min(maxTurn, difference));
  projectile.velocity.x = Math.cos(next) * speed;
  projectile.velocity.y = Math.sin(next) * speed;
}
