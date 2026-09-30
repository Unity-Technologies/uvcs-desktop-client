import type { FrameClock } from './frameClock';
import { accumulateZoom, cubicEaseOut, type ZoomMomentum } from './zoom';

/** Turns discrete zoom steps (wheel notches, buttons, keys) into an eased glide (see zoom.ts), one frame at a time. */
export class ZoomAnimation {
  private momentum: ZoomMomentum | null = null;
  private glide: { anchorX: number; anchorY: number; from: number } | null = null;
  private frame: number | null = null;

  constructor(
    /** Sets an absolute zoom keeping the anchor screen point over the same world point. */
    private readonly applyZoomAt: (anchorX: number, anchorY: number, zoom: number) => void,
    private readonly currentZoom: () => number,
    private readonly clock: FrameClock,
  ) {}

  /** Folds one zoom step in and glides towards the accumulated target, keeping the anchor still. */
  zoomStep(anchorX: number, anchorY: number, factor: number): void {
    const from = this.currentZoom();
    this.momentum = accumulateZoom(this.momentum, from, factor, this.clock.now());
    this.glide = { anchorX, anchorY, from };
    this.frame ??= this.clock.request(this.step);
  }

  /** Freezes the glide where it is; anything else that moves the view calls this first. */
  stop(): void {
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null;
    this.momentum = null;
    this.glide = null;
  }

  private readonly step = (): void => {
    const { momentum, glide } = this;
    if (!momentum || !glide) {
      this.frame = null;
      return;
    }
    const t = Math.min(1, (this.clock.now() - momentum.startedAt) / momentum.duration);
    this.applyZoomAt(glide.anchorX, glide.anchorY, glide.from + (momentum.target - glide.from) * cubicEaseOut(t));
    if (t < 1) {
      this.frame = this.clock.request(this.step);
      return;
    }
    // Landed; the momentum stays so a quick next step compounds from this target.
    this.glide = null;
    this.frame = null;
  };
}
