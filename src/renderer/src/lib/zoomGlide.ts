import type { FrameClock } from './frameClock';
import { accumulateZoom, cubicEaseOut, type ZoomLimits, type ZoomMomentum } from './wheelZoom';

/**
 * Turns discrete zoom steps (wheel notches, buttons, keys) into an eased glide (see wheelZoom.ts), one frame at a
 * time, towards an anchor that stays still: what the view zooms at (a screen point, a point of a model).
 */
export class ZoomGlide<Anchor> {
  private momentum: ZoomMomentum | null = null;
  private glide: { anchor: Anchor; from: number } | null = null;
  private frame: number | null = null;

  constructor(
    /** Sets an absolute zoom keeping the anchor where it is on screen. */
    private readonly applyZoomAt: (anchor: Anchor, zoom: number) => void,
    private readonly currentZoom: () => number,
    private readonly clock: FrameClock,
    private readonly limits: ZoomLimits,
  ) {}

  /** Folds one zoom step in and glides towards the accumulated target, keeping the anchor still. */
  zoomStep(anchor: Anchor, factor: number): void {
    const from = this.currentZoom();
    this.momentum = accumulateZoom(this.momentum, from, factor, this.clock.now(), this.limits);
    this.glide = { anchor, from };
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
    this.applyZoomAt(glide.anchor, glide.from + (momentum.target - glide.from) * cubicEaseOut(t));
    if (t < 1) {
      this.frame = this.clock.request(this.step);
      return;
    }
    // Landed; the momentum stays so a quick next step compounds from this target.
    this.glide = null;
    this.frame = null;
  };
}
