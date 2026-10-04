type ScoreStorage = Pick<Storage, 'getItem' | 'setItem'>;
const HIGH_SCORE_KEY = 'iron-signal.highScore';

function availableStorage(): ScoreStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
}

export function formatScore(score: number): string {
  return score.toString().padStart(8, '0');
}

export class ScoreManager {
  value = 0;
  highScore = 0;

  constructor(private readonly storage: ScoreStorage | null = availableStorage()) {
    try {
      const saved = Number(storage?.getItem(HIGH_SCORE_KEY));
      if (Number.isSafeInteger(saved) && saved >= 0) this.highScore = saved;
    } catch { /* Storage restrictions must not prevent a playable game. */ }
  }

  add(points: number): void {
    if (!Number.isSafeInteger(points) || points <= 0) return;
    this.value += points;
    if (this.value <= this.highScore) return;
    this.highScore = this.value;
    try { this.storage?.setItem(HIGH_SCORE_KEY, this.highScore.toString()); }
    catch { /* Keep the record in memory when browser storage is unavailable. */ }
  }

  reset(): void { this.value = 0; }
}
