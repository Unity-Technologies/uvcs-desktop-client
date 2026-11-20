import { describe, expect, it } from 'vitest';
import { keepInPlace } from './keepInPlace';

/** Frames run when the test says, as the window would. */
function frames() {
  const queued: (() => void)[] = [];
  return { request: (run: () => void) => queued.push(run), next: () => queued.shift()?.() };
}

describe('keepInPlace', () => {
  it('scrolls back whatever the change moved, frame after frame, as it lays out', () => {
    let top = 300;
    const scrolled: number[] = [];
    const scrollBy = (delta: number) => {
      scrolled.push(delta);
      top -= delta;
    };
    const clock = frames();
    keepInPlace(() => top, scrollBy, () => (top = 420), clock.request, 3);
    clock.next();
    expect([top, scrolled]).toEqual([300, [120]]);
    top = 280; // Laid out again a frame later.
    clock.next();
    clock.next();
    expect([top, scrolled]).toEqual([300, [120, -20]]);
    clock.next();
    expect(scrolled).toEqual([120, -20]);
  });

  it('scrolls nothing when the change moved nothing', () => {
    const scrolled: number[] = [];
    const clock = frames();
    keepInPlace(() => 300, (delta) => scrolled.push(delta), () => {}, clock.request, 2);
    clock.next();
    clock.next();
    expect(scrolled).toEqual([]);
  });
});
