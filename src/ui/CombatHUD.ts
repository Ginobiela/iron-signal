import type { Player } from '../entities/Player';
import type { GameStateManager } from '../core/GameStateManager';
import { formatScore } from '../core/ScoreManager';
import type { ScoreManager } from '../core/ScoreManager';
import type { Checkpoint } from '../level/Checkpoint';

export class CombatHUD {
  private lastScore = -1;
  private lastHigh = -1;
  private lastLives = -1;
  private lastProgress = -1;
  private lastSection = '';
  private lastWeapon = '';
  private lastCheckpoint = '';
  private lastMessage = '';

  constructor(private readonly element: HTMLElement, private readonly notice: HTMLElement) {}

  update(states: GameStateManager, score: ScoreManager, player: Player, checkpoint: Checkpoint,
    progress: number, section: string, message: string): void {
    const visibleMessage = states.state === 'PLAYING' ? message : '';
    if (this.lastMessage !== visibleMessage) {
      this.lastMessage = visibleMessage;
      this.notice.textContent = visibleMessage;
      this.notice.hidden = visibleMessage === '';
    }
    if (this.lastScore === score.value && this.lastHigh === score.highScore && this.lastLives === states.lives
      && this.lastProgress === progress && this.lastSection === section && this.lastWeapon === player.weapon.name
      && this.lastCheckpoint === checkpoint.name) return;
    this.lastScore = score.value;
    this.lastHigh = score.highScore;
    this.lastLives = states.lives;
    this.lastProgress = progress;
    this.lastSection = section;
    this.lastWeapon = player.weapon.name;
    this.lastCheckpoint = checkpoint.name;
    this.element.textContent = `SCORE ${formatScore(score.value)} · RÉCORD ${formatScore(score.highScore)} · VIDAS ${states.lives} · ARMA ${player.weapon.name}\n`
      + `${section.toUpperCase()} · ${progress}% · CHECKPOINT ${checkpoint.name.toUpperCase()}`;
  }
}
