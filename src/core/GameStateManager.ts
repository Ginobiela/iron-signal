import { DEFAULT_CONFIG_SOURCE } from '../config/gameplay';
import type { GameplayConfigSource } from '../config/gameplay';

export type GameState = 'BOOT' | 'MENU' | 'PLAYING' | 'PAUSED' | 'PLAYER_DEAD' | 'GAME_OVER' | 'LEVEL_COMPLETE';

export class GameStateManager {
  private current: GameState = 'BOOT';
  private remainingLives: number;
  infiniteLives = false;
  constructor(private readonly config: GameplayConfigSource = DEFAULT_CONFIG_SOURCE) { this.remainingLives = config.get().game.initialLives; }
  private deathTimer = 0;

  get state(): GameState { return this.current; }
  get initialLives(): number { return this.config.get().game.initialLives; }
  get lives(): number { return this.remainingLives; }

  ready(): void {
    if (this.current === 'BOOT') this.current = 'MENU';
  }

  start(): boolean {
    if (this.current !== 'MENU' && this.current !== 'GAME_OVER' && this.current !== 'LEVEL_COMPLETE') return false;
    this.remainingLives = this.config.get().game.initialLives;
    this.deathTimer = 0;
    this.current = 'PLAYING';
    return true;
  }

  restart(): void { this.current = 'MENU'; this.start(); }

  pause(): void {
    if (this.current === 'PLAYING') this.current = 'PAUSED';
  }

  resume(): void {
    if (this.current === 'PAUSED') this.current = 'PLAYING';
  }

  togglePause(): void {
    if (this.current === 'PAUSED') this.resume();
    else this.pause();
  }

  playerDied(): void {
    if (this.current !== 'PLAYING') return;
    if (!this.infiniteLives) this.remainingLives--;
    this.deathTimer = this.config.get().game.deathDelay;
    this.current = 'PLAYER_DEAD';
  }

  update(dt: number): boolean {
    if (this.current !== 'PLAYER_DEAD') return false;
    this.deathTimer = Math.max(0, this.deathTimer - dt);
    if (this.deathTimer > Number.EPSILON) return false;
    this.current = this.remainingLives > 0 ? 'PLAYING' : 'GAME_OVER';
    return this.current === 'PLAYING';
  }

  complete(): void {
    if (this.current === 'PLAYING') this.current = 'LEVEL_COMPLETE';
  }
}
