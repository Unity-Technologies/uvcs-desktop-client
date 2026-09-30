import type { FrameClock } from './frameClock';
import { decayFling, flingVelocity, pushPanSample, type Fling, type PanSample } from './pan';

/** Longer frame gaps (a stall, a hidden window) don't make the graph jump. */
const MAX_FRAME_MS = 64;

/** Keeps a mouse drag gliding after release (see pan.ts), one frame at a time. */
export class PanInertia {
  private samples: PanSample[] = [];
  private fling: Fling | null = null;
  private frame: number | null = null;
  private lastFrameAt = 0;

  constructor(
    /** Pans by a screen delta and returns how far the view actually moved once clamped. */
    private readonly panBy: (dx: number, dy: number) => { dx: number; dy: number },
    private readonly clock: FrameClock,
  ) {}

  /** Records a drag position; pass the event's timeStamp so coalesced events keep their real timing. */
  sample(x: number, y: number, t = this.clock.now()): void {
    pushPanSample(this.samples, { x, y, t });
  }

  /** The drag ended: glides on if it was a flick. */
  release(): void {
    const fling = flingVelocity(this.samples, this.clock.now());
    this.samples = [];
    if (!fling) return;
    this.fling = fling;
    this.lastFrameAt = this.clock.now();
    this.frame ??= this.clock.request(this.step);
  }

  /** Stops the glide dead (a new drag, a wheel, a jump somewhere else). */
  cancel(): void {
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null;
    this.fling = null;
    this.samples = [];
  }

  private readonly step = (): void => {
    const fling = this.fling;
    if (!fling) {
      this.frame = null;
      return;
    }
    const now = this.clock.now();
    const frame = decayFling(fling, Math.min(MAX_FRAME_MS, now - this.lastFrameAt));
    this.lastFrameAt = now;
    const moved = this.panBy(frame.dx, frame.dy);
    // An axis stopped by the edge of the graph has nowhere left to glide.
    const vx = Math.abs(moved.dx - frame.dx) > 0.5 ? 0 : frame.next.vx;
    const vy = Math.abs(moved.dy - frame.dy) > 0.5 ? 0 : frame.next.vy;
    if (frame.done || (vx === 0 && vy === 0)) {
      this.fling = null;
      this.frame = null;
      return;
    }
    this.fling = { ...frame.next, vx, vy };
    this.frame = this.clock.request(this.step);
  };
}
