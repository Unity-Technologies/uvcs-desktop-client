import type { FrameClock } from './frameClock';
import { interpolateViewport, type Size, type Viewport } from './viewport';
import { cubicEaseOut } from './zoom';

export const GLIDE_MS = 420;

/** Eased pan-and-zoom from one viewport to another; anything else that moves the view stops it first. */
export class ViewportGlide {
  private frame: number | null = null;

  constructor(
    private readonly apply: (viewport: Viewport) => void,
    private readonly current: () => Viewport,
    private readonly screen: () => Size,
    private readonly clock: FrameClock,
  ) {}

  /** Glides from the current viewport to `target`, e.g. to frame something revealed from elsewhere. */
  glideTo(target: Viewport): void {
    this.stop();
    const from = this.current();
    const startedAt = this.clock.now();
    const step = (): void => {
      const t = Math.min(1, (this.clock.now() - startedAt) / GLIDE_MS);
      this.apply(t === 1 ? target : interpolateViewport(from, target, cubicEaseOut(t), this.screen()));
      this.frame = t < 1 ? this.clock.request(step) : null;
    };
    this.frame = this.clock.request(step);
  }

  stop(): void {
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null;
  }

  /** Whether a glide is taking the view somewhere, as a reveal does. */
  gliding(): boolean {
    return this.frame !== null;
  }
}
