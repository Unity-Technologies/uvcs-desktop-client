/** Animation frames and the time they run at: the browser's in the app, a fake one in tests. */
export interface FrameClock {
  /** Runs `callback` on the next frame; returns an id to cancel it with. */
  request: (callback: () => void) => number;
  cancel: (id: number) => void;
  /** Milliseconds, on the clock frames and pointer events share (`performance.now()`). */
  now: () => number;
}

export const browserFrameClock: FrameClock = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
};
