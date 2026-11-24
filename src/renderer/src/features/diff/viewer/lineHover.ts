/** Where a frame's work is asked for and called off: the window's animation frames, or a test's. */
export interface FrameScheduler {
  request: (run: () => void) => number;
  cancel: (id: number) => void;
}

export const ANIMATION_FRAMES: FrameScheduler = {
  request: (run) => requestAnimationFrame(run),
  cancel: (id) => cancelAnimationFrame(id),
};

/**
 * The line under the pointer, for a button that follows it (a review's "+", `useLineActionButton`). Pierre says a line
 * was left before it says the next one was entered: cleared at once, the button would be gone between the two, a
 * flicker on every line. So a line left clears a frame later, unless another is entered first, and `dispose` calls off
 * a clear still waiting.
 *
 * The button is drawn over the diff, so the pointer on it leaves the line. `hold` keeps the line while it's there, and
 * `release` lets it go: not by order, since React says the button was entered before Pierre says the line was left
 * (React's `onPointerEnter` comes from the native `pointerout`, Pierre listens to `pointerleave`).
 */
export function lineHover<Line>(show: (line: Line | null) => void, frames: FrameScheduler = ANIMATION_FRAMES) {
  let clearing: number | null = null;
  let held = false;
  const keep = (): void => {
    if (clearing !== null) frames.cancel(clearing);
    clearing = null;
  };
  const leave = (): void => {
    keep();
    if (held) return;
    clearing = frames.request(() => {
      clearing = null;
      show(null);
    });
  };
  return {
    enter: (line: Line | null): void => {
      keep();
      // The pointer is on a line, so off the button, even if the button never said it was left (it went away under it).
      held = false;
      show(line);
    },
    leave,
    hold: (): void => {
      keep();
      held = true;
    },
    release: (): void => {
      held = false;
      leave();
    },
    dispose: keep,
  };
}
