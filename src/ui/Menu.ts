import type { GameStateManager } from '../core/GameStateManager';
import { formatScore } from '../core/ScoreManager';
import type { ScoreManager } from '../core/ScoreManager';
import type { CheckpointManager } from '../level/Checkpoint';
import { DEV_TOOLS } from '../config/devtools';
import type { InputManager } from '../core/InputManager';

export class Menu {
  private lastText = '';

  constructor(private readonly element: HTMLElement, private readonly onStart: () => void, private readonly levelName = 'COMPLEJO DE RELEVO') {}

  handleGamepad(input: InputManager): void {
    const direction = Number(input.gamepadWasPressed('down')) - Number(input.gamepadWasPressed('up'));
    const confirm = input.gamepadWasPressed('jump') || input.gamepadWasPressed('pause');
    if (!direction && !confirm) return;
    const items = Array.from(this.element.querySelectorAll<HTMLElement>('button, a'));
    if (!items.length) return;
    const focused = items.indexOf(document.activeElement as HTMLElement);
    const selected = direction ? ((focused < 0 ? 0 : focused) + direction + items.length) % items.length : Math.max(0, focused);
    const item = items[selected]!;
    item.focus();
    if (confirm) { input.clear(); item.click(); }
  }

  update(states: GameStateManager, score: ScoreManager, checkpoints: CheckpointManager): void {
    let text = '';
    switch (states.state) {
      case 'BOOT': text = 'INICIANDO…'; break;
      case 'MENU': text = `IRON SIGNAL\n${this.levelName.toUpperCase()}\n\nENTER / A / MENU: COMENZAR\n${states.initialLives} VIDAS · ${checkpoints.items.length} CHECKPOINTS\nRÉCORD ${formatScore(score.highScore)}`; break;
      case 'PAUSED': text = 'PAUSA\n\nESC / ENTER / A / MENU: CONTINUAR'; break;
      case 'PLAYER_DEAD': text = states.lives > 0
        ? `CAÍSTE · VIDAS ${states.lives}\nREAPARECIENDO EN\n${checkpoints.current.name.toUpperCase()}`
        : 'CAÍSTE · SIN VIDAS'; break;
      case 'GAME_OVER': text = `GAME OVER\nSCORE ${formatScore(score.value)}\nRÉCORD ${formatScore(score.highScore)}\n\nENTER: NUEVA PARTIDA`; break;
      case 'LEVEL_COMPLETE': text = `MISIÓN COMPLETA\n${this.levelName.toUpperCase()} LIBERADO\nSCORE ${formatScore(score.value)}\n\nENTER: NUEVA PARTIDA`; break;
    }
    if (text === this.lastText) return;
    this.lastText = text;
    this.element.dataset.state = states.state;
    this.element.textContent = text;
    if (states.state === 'MENU') {
      const start = document.createElement('button');
      start.type = 'button'; start.className = 'viewer-link'; start.textContent = 'COMENZAR';
      start.addEventListener('click', () => { start.blur(); this.onStart(); });
      this.element.append(document.createElement('br'), start);
      const bossRun = document.createElement('a');
      const levelUrl = new URLSearchParams(location.search).get('level');
      bossRun.href = `./?mode=boss${levelUrl ? `&level=${encodeURIComponent(levelUrl)}` : ''}`;
      const level1 = document.createElement('a'); level1.href = './'; level1.className = 'viewer-link'; level1.textContent = 'LEVEL 1 · COMPLEJO DE RELEVO';
      bossRun.className = 'viewer-link';
      bossRun.textContent = 'BOSS RUN';
      this.element.append(document.createElement('br'), bossRun);
      const level2 = document.createElement('a'); level2.href = './?level=levels/level-02.json';
      level2.className = 'viewer-link'; level2.textContent = 'LEVEL 2 · NEXO SUBTERRÁNEO';
      this.element.append(document.createElement('br'), level2);
      this.element.append(document.createElement('br'), level1);
      const level3=document.createElement('a');level3.href='./?level=levels/level-03.json';level3.className='viewer-link';level3.textContent='LEVEL 3 · TORRE BASTIÓN';this.element.append(document.createElement('br'),level3);
      if (DEV_TOOLS) {
        for (const [href, label] of [
          ['./animation-viewer.html', 'ANIMATION VIEWER'],
          ['./level-editor.html', 'TOOLS · LEVEL EDITOR'],
          ['./gameplay-tuner.html', 'TOOLS · GAMEPLAY TUNER'],
        ] as const) {
          const link = document.createElement('a');
          link.href = href; link.className = 'viewer-link'; link.textContent = label;
          this.element.append(document.createElement('br'), link);
        }
      }
    }
    this.element.hidden = text === '';
  }
}
