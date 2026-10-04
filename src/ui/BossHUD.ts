import { BOSS } from '../config/constants';
import type { Boss } from '../bosses/Boss';

export class BossHUD {
  private readonly label: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly track: HTMLElement;
  private lastHealth = -1;
  private lastState = '';
  private lastPhase = 0;
  private lastPattern = '';

  constructor(private readonly element: HTMLElement) {
    const label = element.querySelector<HTMLElement>('.boss-label');
    const fill = element.querySelector<HTMLElement>('.boss-fill');
    const track = element.querySelector<HTMLElement>('.boss-track');
    if (!label || !fill || !track) throw new Error('Faltan elementos de la barra del jefe.');
    this.label = label;
    this.fill = fill;
    this.track = track;
    track.setAttribute('aria-valuemax', BOSS.health.toString());
  }

  update(boss: Boss): void {
    this.element.hidden = !boss.active || !boss.alive;
    if (this.lastHealth === boss.health && this.lastState === boss.state
      && this.lastPhase === boss.phase && this.lastPattern === boss.pattern) return;
    this.lastHealth = boss.health;
    this.lastState = boss.state;
    this.lastPhase = boss.phase;
    this.lastPattern = boss.pattern;
    const hint = boss.vulnerable ? 'BLINDAJE ABIERTO'
      : boss.state === 'TELEGRAPH' ? boss.pattern === 'HIGH' ? 'SALVA ALTA' : boss.pattern === 'LOW' ? 'SALVA BAJA' : 'DISPARO DIRIGIDO'
        : 'BLINDAJE CERRADO';
    this.label.textContent = `${BOSS.name} · FASE ${boss.phase}\n${hint} · ${boss.health}/${boss.maxHealth}`;
    this.fill.style.width = `${boss.health / boss.maxHealth * 100}%`;
    this.fill.style.background = boss.vulnerable ? '#ffe3a2' : '#99edff';
    this.track.setAttribute('aria-valuenow', boss.health.toString());
  }
}
