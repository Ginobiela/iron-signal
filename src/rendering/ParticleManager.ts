import { FEEDBACK } from '../config/constants';

export class Particle {
  x = 0; y = 0; vx = 0; vy = 0; life = 0; duration = 0; size = 1; color = 0xffffff;
}

export class ParticleManager {
  readonly items: readonly Particle[];
  constructor(capacity: number = FEEDBACK.particleCapacity) {
    this.items = Array.from({ length: capacity }, () => new Particle());
  }

  get activeCount(): number {
    let count = 0;
    for (const particle of this.items) if (particle.life > 0) count++;
    return count;
  }

  burst(x: number, y: number, count: number, color: number, explosion = false): void {
    for (const particle of this.items) {
      if (count <= 0) break;
      if (particle.life > 0) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = explosion ? 25 + Math.random() * 65 : 15 + Math.random() * 35;
      particle.x = x; particle.y = y;
      particle.vx = Math.cos(angle) * speed; particle.vy = Math.sin(angle) * speed + (explosion ? 25 : 0);
      particle.duration = (explosion ? FEEDBACK.explosionLife : FEEDBACK.sparkLife) * (0.7 + Math.random() * 0.3);
      particle.life = particle.duration;
      particle.size = explosion ? 2 : 1;
      particle.color = color;
      count--;
    }
  }

  update(dt: number): void {
    for (const particle of this.items) {
      if (particle.life <= 0) continue;
      particle.life = Math.max(0, particle.life - dt);
      particle.vy -= FEEDBACK.particleGravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
  }

  clear(): void { for (const particle of this.items) particle.life = 0; }
}
