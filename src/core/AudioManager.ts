import { AUDIO } from '../config/constants';

export type Sound = 'shoot' | 'laser' | 'jump' | 'enemyHit' | 'enemyDeath'
  | 'playerDeath' | 'powerup' | 'bossHit' | 'shield' | 'bossWarning' | 'victory' | 'checkpoint';
const sounds: Record<Sound, readonly [number, number, number, OscillatorType, number]> = {
  shoot: [620, 110, 0.065, 'square', 0.09], laser: [1400, 100, 0.16, 'sawtooth', 0.10],
  jump: [180, 560, 0.13, 'square', 0.10], enemyHit: [280, 110, 0.055, 'triangle', 0.16],
  enemyDeath: [180, 40, 0.22, 'sawtooth', 0.13], playerDeath: [360, 40, 0.4, 'sawtooth', 0.14],
  powerup: [400, 1200, 0.24, 'square', 0.08], bossHit: [100, 40, 0.09, 'triangle', 0.20],
  shield: [1100, 600, 0.045, 'triangle', 0.08], bossWarning: [200, 440, 0.18, 'square', 0.07],
  victory: [330, 1320, 0.65, 'triangle', 0.15], checkpoint: [440, 880, 0.18, 'triangle', 0.13],
};

export class AudioManager {
  volume: number = AUDIO.defaultVolume;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly voices = new Set<OscillatorNode>();
  private readonly lastPlayed = new Map<Sound, number>();
  private disposed = false;

  constructor() {
    try {
      const saved = localStorage.getItem('iron-signal.audioVolume');
      const value = saved === null ? NaN : Number(saved);
      if (Number.isFinite(value) && value >= 0 && value <= 1) this.volume = value;
    } catch { /* Audio remains usable when storage is restricted. */ }
    window.addEventListener('keydown', this.unlock);
    window.addEventListener('pointerdown', this.unlock);
  }

  readonly unlock = (): void => {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Missing or blocked Web Audio never blocks gameplay. */ }
  };

  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.01);
    try { localStorage.setItem('iron-signal.audioVolume', String(this.volume)); }
    catch { /* Preserve the preference in memory when storage is unavailable. */ }
  }

  play(sound: Sound): void {
    const context = this.context;
    if (!context || !this.master || context.state !== 'running' || this.volume === 0
      || this.voices.size >= AUDIO.maxVoices) return;
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(sound) ?? -Infinity) < AUDIO.hitInterval) return;
    this.lastPlayed.set(sound, now);
    const [start, end, duration, type, volume] = sounds[sound];
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  silence(): void {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already stopped. */ } }
    this.voices.clear();
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this.unlock);
    window.removeEventListener('pointerdown', this.unlock);
    this.silence();
    if (this.context) void this.context.close().catch(() => {});
  }
}
