import { TIMING } from '../config/constants';

export class GameLoop {
  fps = 0;
  private running = false;
  private requestId = 0;
  private lastTime: number | null = null;
  private accumulator = 0;
  private fpsElapsed = 0;
  private frames = 0;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = null;
    this.accumulator = 0;
    this.frames = 0;
    this.fpsElapsed = 0;
    this.fps = 0;
    this.requestId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.requestId);
  }

  private readonly frame = (timestamp: number): void => {
    if (!this.running) return;
    const elapsed = this.lastTime === null ? 0 : Math.max(0, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    // Cap catch-up work after a stall; never feed a large delta into physics.
    this.accumulator += Math.min(elapsed, TIMING.maxFrameDelta);
    while (this.accumulator + Number.EPSILON >= TIMING.fixedStep) {
      this.update(TIMING.fixedStep);
      this.accumulator = Math.max(0, this.accumulator - TIMING.fixedStep);
    }
    this.frames++;
    this.fpsElapsed += elapsed;
    if (this.fpsElapsed >= TIMING.fpsInterval) {
      this.fps = Math.round(this.frames / this.fpsElapsed);
      this.frames = 0;
      this.fpsElapsed = 0;
    }
    this.render(this.accumulator / TIMING.fixedStep);
    this.requestId = requestAnimationFrame(this.frame);
  };
}
