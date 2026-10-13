import type { FrameClock } from '../../../../lib/frameClock';
import type { PressedKey } from '../../../../lib/shortcuts';
import { flyDirectionOf, flyMoveOf, type FlyDirection } from './flyKeys';
import { flown, flyStep, workingDepth, type OrbitView, type Vector } from './orbitCamera';

/** A frame after a stall (a hidden window) counts no longer than this, so the camera never jumps. */
const MAX_FRAME_SECONDS = 0.1;

/**
 * Moves the camera while W, A, S, D, Q, E or the arrows are held (`flyDirectionOf`): every frame, by the time since
 * the last, so it moves as smoothly as the screen draws, never at the keyboard's repeat, speeding up the longer they're
 * held (`flyStep`). Keys are held by their position (`code`). ⌘, Ctrl or Alt joining in stops it all: macOS sends no
 * key up for a key let go while ⌘ is down, which left the camera flying for good. Shift speeds up at once.
 */
export class FlyKeysLoop {
  private readonly held = new Map<string, FlyDirection>();
  private fast = false;
  private frame: number | null = null;
  private startedAt = 0;
  private lastAt = 0;

  constructor(
    private readonly view: () => OrbitView,
    private readonly onView: (view: OrbitView) => void,
    /** The centre of what is shown: the keys move at its depth (`workingDepth`), whatever the orbit's target. */
    private readonly modelCentre: () => Vector | null,
    private readonly clock: FrameClock,
  ) {}

  /** Whether the key moves the camera (the caller then lets it do nothing else). */
  keyDown(event: PressedKey): boolean {
    this.fast = event.shiftKey;
    if (event.metaKey || event.ctrlKey || event.altKey) {
      this.stop();
      return false;
    }
    const direction = flyDirectionOf(event);
    if (!direction) return false;
    this.held.set(event.code, direction);
    if (this.frame === null) this.start();
    return true;
  }

  keyUp(event: PressedKey): void {
    this.fast = event.shiftKey;
    this.held.delete(event.code);
  }

  /** Lets go of every key: the stage lost focus, or the view goes. */
  stop(): void {
    this.held.clear();
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null;
  }

  private start(): void {
    this.startedAt = this.lastAt = this.clock.now();
    this.frame = this.clock.request(this.step);
  }

  private readonly step = (): void => {
    if (this.held.size === 0) {
      this.frame = null;
      return;
    }
    const now = this.clock.now();
    const seconds = Math.min(Math.max(now - this.lastAt, 0) / 1000, MAX_FRAME_SECONDS);
    this.lastAt = now;
    const view = this.view();
    const step = flyStep(workingDepth(view, null, this.modelCentre()), (now - this.startedAt) / 1000, seconds, this.fast);
    this.onView(flown(view, flyMoveOf(this.held.values()), step));
    this.frame = this.clock.request(this.step);
  };
}
