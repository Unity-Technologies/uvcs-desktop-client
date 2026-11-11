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
 */
export function lineHover<Line>(show: (line: Line | null) => void, frames: FrameScheduler = ANIMATION_FRAMES) {
  let clearing: number | null = null;
  const keep = (): void => {
    if (clearing !== null) frames.cancel(clearing);
    clearing = null;
  };
  return {
    enter: (line: Line | null): void => {
      keep();
      show(line);
    },
    leave: (): void => {
      keep();
      clearing = frames.request(() => {
        clearing = null;
        show(null);
      });
    },
    dispose: keep,
  };
}
