import { describe, expect, it } from 'vitest';
import { keepInPlace } from './keepInPlace';

/** A resize watch the test triggers, as layouts would. */
function resizes() {
  let listener: (() => void) | null = null;
  return {
    watch: (onResize: () => void) => {
      listener = onResize;
      return () => (listener = null);
    },
    layout: () => listener?.(),
  };
}

describe('keepInPlace', () => {
  it('scrolls back whatever each layout after the change moved, until released', () => {
    let top = 300;
    const scrolled: number[] = [];
    const scrollBy = (delta: number) => {
      scrolled.push(delta);
      top -= delta;
    };
    const layouts = resizes();
    let stop = () => {};
    keepInPlace(() => top, scrollBy, () => (top = 420), layouts.watch, (release) => (stop = release));
    layouts.layout();
    expect([top, scrolled]).toEqual([300, [120]]);
    top = 280; // Laid out again, a box above it redrawn.
    layouts.layout();
    expect([top, scrolled]).toEqual([300, [120, -20]]);
    stop();
    top = 250;
    layouts.layout();
    expect(scrolled).toEqual([120, -20]);
  });

  it('scrolls nothing when a layout moved nothing', () => {
    const scrolled: number[] = [];
    const layouts = resizes();
    keepInPlace(() => 300, (delta) => scrolled.push(delta), () => {}, layouts.watch, () => {});
    layouts.layout();
    expect(scrolled).toEqual([]);
  });
});
