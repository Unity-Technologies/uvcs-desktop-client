import type { FlingFeel } from '../../../../lib/fling';
import type { FrameClock } from '../../../../lib/frameClock';
import { PanInertia } from '../../../../lib/panInertia';
import type { OrbitView } from './orbitCamera';

/**
 * A drag's coast on the model's camera (`PanInertia`): once let go, it goes on moving the view as the drag did
 * (`move`: a pan, a turn), and stops for good as soon as anything else places the camera (F, 0, the keys, a framing),
 * which a coast going on would throw off the frame.
 */
export class ViewCoast {
  private readonly inertia: PanInertia;
  /** The view the coast set last, or the one it was let go on: any other means the camera was taken over. */
  private placed: OrbitView | null = null;

  constructor(
    private readonly view: () => OrbitView,
    private readonly onView: (view: OrbitView) => void,
    private readonly move: (view: OrbitView, dx: number, dy: number) => OrbitView,
    clock: FrameClock,
    feel: FlingFeel,
  ) {
    this.inertia = new PanInertia((dx, dy) => this.coast(dx, dy), clock, feel);
  }

  sample(x: number, y: number, t: number): void {
    this.inertia.sample(x, y, t);
  }

  release(): void {
    this.placed = this.view();
    this.inertia.release();
  }

  cancel(): void {
    this.inertia.cancel();
  }

  private coast(dx: number, dy: number): { dx: number; dy: number } {
    const current = this.view();
    if (this.placed !== null && current !== this.placed) {
      this.inertia.cancel();
      return { dx: 0, dy: 0 };
    }
    this.placed = this.move(current, dx, dy);
    this.onView(this.placed);
    return { dx, dy };
  }
}
