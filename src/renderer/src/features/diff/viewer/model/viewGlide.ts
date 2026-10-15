// The model's camera gliding from where it is to a view the app chose (a changed region stepped to, F, a part
// picked), as the Branch Explorer glides to what it reveals (`ViewportGlide`): a jump left the user unsure what the
// view had done, above all when it also turned. It eases in and out, as what moves between two places does
// (`--ease-in-out`), turns the short way round, and zooms by ratio, so closing in on a small part slows as it nears.

import type { FrameClock } from '../../../../lib/frameClock';
import type { OrbitView } from './orbitCamera';

/** Long enough to follow a turn, short enough not to wait for: a touch longer than the Branch Explorer's 420 ms glide. */
export const VIEW_GLIDE_MS = 500;

/**
 * Glides the camera to a view, a frame at a time. Anything else that places the camera (a gesture, the keys, the
 * wheel) calls `stop` first, so the hand takes over at once from where the glide was (`useModelCamera`).
 */
export class ViewGlide {
  private frame: number | null = null;

  constructor(
    private readonly view: () => OrbitView,
    private readonly onView: (view: OrbitView) => void,
    private readonly clock: FrameClock,
    /** How long a glide takes: 0 places the camera at once, as reduced motion asks. */
    private readonly duration: () => number,
  ) {}

  glideTo(to: OrbitView): void {
    this.stop();
    const duration = this.duration();
    if (duration <= 0) return this.onView(to);
    const from = this.view();
    const startedAt = this.clock.now();
    const step = (): void => {
      const t = Math.min(1, (this.clock.now() - startedAt) / duration);
      this.frame = t < 1 ? this.clock.request(step) : null;
      this.onView(t < 1 ? viewBetween(from, to, easeInOut(t)) : to);
    };
    this.frame = this.clock.request(step);
  }

  stop(): void {
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null;
  }

  gliding(): boolean {
    return this.frame !== null;
  }
}

/** The view `along` the way from `from` to `to` (0 to 1). */
function viewBetween(from: OrbitView, to: OrbitView, along: number): OrbitView {
  const between = (a: number, b: number): number => a + (b - a) * along;
  return {
    target: from.target.map((value, i) => between(value, to.target[i]!)) as OrbitView['target'],
    yaw: from.yaw + shortestTurn(from.yaw, to.yaw) * along,
    pitch: between(from.pitch, to.pitch),
    distance: from.distance * (to.distance / from.distance) ** along,
  };
}

/** The turn from `from` to `to`, in radians, the short way round: within half a turn either way. */
function shortestTurn(from: number, to: number): number {
  const full = 2 * Math.PI;
  const turn = (((to - from) % full) + full) % full;
  return turn > Math.PI ? turn - full : turn;
}

/** Slow start, slow landing: cubic, as the `--ease-in-out` token's curve. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}
