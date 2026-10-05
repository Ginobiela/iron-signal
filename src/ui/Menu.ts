import type { GameStateManager } from '../core/GameStateManager';
import { formatScore } from '../core/ScoreManager';
import type { ScoreManager } from '../core/ScoreManager';
import type { CheckpointManager } from '../level/Checkpoint';
import { GAMEPLAY } from '../config/constants';

export class Menu {
  private lastText = '';

  constructor(private readonly element: HTMLElement) {}

  update(states: GameStateManager, score: ScoreManager, checkpoints: CheckpointManager): void {
    let text = '';
    switch (states.state) {
      case 'BOOT': text = 'INICIANDO…'; break;
      case 'MENU': text = `IRON SIGNAL\nCOMPLEJO DE RELEVO\n\nENTER: COMENZAR\n${GAMEPLAY.initialLives} VIDAS · ${checkpoints.items.length} CHECKPOINTS\nRÉCORD ${formatScore(score.highScore)}`; break;
      case 'PAUSED': text = 'PAUSA\n\nESC / ENTER: CONTINUAR'; break;
      case 'PLAYER_DEAD': text = states.lives > 0
        ? `CAÍSTE · VIDAS ${states.lives}\nREAPARECIENDO EN\n${checkpoints.current.name.toUpperCase()}`
        : 'CAÍSTE · SIN VIDAS'; break;
      case 'GAME_OVER': text = `GAME OVER\nSCORE ${formatScore(score.value)}\nRÉCORD ${formatScore(score.highScore)}\n\nENTER: NUEVA PARTIDA`; break;
      case 'LEVEL_COMPLETE': text = `MISIÓN COMPLETA\nGUARDIÁN CENITAL DESTRUIDO\nSCORE ${formatScore(score.value)}\n\nENTER: NUEVA PARTIDA`; break;
    }
    if (text === this.lastText) return;
    this.lastText = text;
    this.element.dataset.state = states.state;
    this.element.textContent = text;
    if (states.state === 'MENU') {
      const link = document.createElement('a');
      link.href = './animation-viewer.html';
      link.className = 'viewer-link';
      link.textContent = 'ANIMATION VIEWER';
      this.element.append(document.createElement('br'), link);
    }
    this.element.hidden = text === '';
  }
}
