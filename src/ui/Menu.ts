import type { GameStateManager } from '../core/GameStateManager';
import { formatScore } from '../core/ScoreManager';
import type { ScoreManager } from '../core/ScoreManager';
import type { CheckpointManager } from '../level/Checkpoint';
import { DEV_TOOLS } from '../config/devtools';
import type { InputManager } from '../core/InputManager';

export class Menu {
  private lastText = '';
  private page: 'main' | 'levels' | 'tools' = 'main';
  private paused = false;

  constructor(private readonly element: HTMLElement, private readonly onStart: () => void, private readonly levelName = 'COMPLEJO DE RELEVO') {}

  handleInput(input: InputManager): void {
    const direction = Number(input.gamepadWasPressed('down')) - Number(input.gamepadWasPressed('up'));
    if (this.page !== 'main' && input.wasPressed('pause')) {
      input.clear(); this.showPage('main'); return;
    }
    const confirm = input.gamepadWasPressed('jump') || input.gamepadWasPressed('pause') || input.wasPressed('start');
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
    this.page = 'main';
    this.paused = states.state === 'PAUSED';
    this.element.textContent = text;
    if (states.state === 'MENU' || this.paused) this.showPage('main', false);
    this.element.hidden = text === '';
  }
  private showPage(page: 'main' | 'levels' | 'tools', focus = true): void {
    this.page = page;
    this.element.textContent = page === 'main' ? this.lastText : `${this.paused ? 'PAUSA' : 'IRON SIGNAL'}\n${page === 'levels' ? 'SELECT LEVEL' : 'TOOLS'}`;
    const actions = document.createElement('div');
    actions.className = 'menu-actions';
    const button = (label: string, action: () => void): void => {
      const item = document.createElement('button');
      item.type = 'button'; item.className = 'viewer-link'; item.textContent = label;
      item.addEventListener('click', action); actions.append(item);
    };
    const link = (label: string, href: string): void => {
      const item = document.createElement('a');
      item.className = 'viewer-link'; item.textContent = label; item.href = href; actions.append(item);
    };
    if (page === 'main') {
      button(this.paused ? 'CONTINUAR' : 'COMENZAR', () => {
        (document.activeElement as HTMLElement | null)?.blur(); this.onStart();
      });
      button('SELECT LEVEL', () => this.showPage('levels'));
      const levelUrl = new URLSearchParams(location.search).get('level');
      link('BOSS RUN', `./?mode=boss${levelUrl ? `&level=${encodeURIComponent(levelUrl)}` : ''}`);
      if (DEV_TOOLS) button('TOOLS', () => this.showPage('tools'));
    } else {
      if (page === 'levels') {
        link('LEVEL 1 · COMPLEJO DE RELEVO', './');
        link('LEVEL 2 · NEXO SUBTERRÁNEO', './?level=levels/level-02.json');
        link('LEVEL 3 · TORRE BASTIÓN', './?level=levels/level-03.json');
      } else if (DEV_TOOLS) {
        link('GAMEPLAY TUNER', './gameplay-tuner.html');
        link('SPRITE VIEWER', './animation-viewer.html');
        link('LEVEL EDITOR', './level-editor.html');
      }
      button('VOLVER', () => this.showPage('main'));
    }
    this.element.append(actions);
    if (focus) actions.querySelector<HTMLElement>('button, a')?.focus();
  }

}
