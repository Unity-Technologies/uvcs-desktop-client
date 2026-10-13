import type { FrameClock } from '../lib/frameClock';

export const FRAME_MS = 16;

/** Frames that run only when the test says, at a time the test sets. */
export function fakeFrames() {
  let time = 1000;
  let nextId = 1;
  const pending = new Map<number, () => void>();
  const clock: FrameClock = {
    request: (callback) => {
      pending.set(nextId, callback);
      return nextId++;
    },
    cancel: (id) => void pending.delete(id),
    now: () => time,
  };
  /** Runs one frame `ms` after the last one. */
  const frame = (ms = FRAME_MS): void => {
    time += ms;
    const due = [...pending.values()];
    pending.clear();
    for (const callback of due) callback();
  };
  return {
    clock,
    frame,
    /** Lets time pass without a frame (a drag's pause). */
    wait: (ms: number) => void (time += ms),
    /** Runs frames until nothing asks for another; returns how many ran. */
    settle: (max = 2000): number => {
      let frames = 0;
      while (pending.size > 0 && frames < max) {
        frame();
        frames++;
      }
      return frames;
    },
    animating: () => pending.size > 0,
  };
}
