import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { colorArrival, colorArrivalDelay, TYPING_PAUSE_MS } from './colorArrival';

describe('colorArrivalDelay', () => {
  it('redraws with the colors at once after a pause in typing, and waits out the rest of one while typing', () => {
    expect(colorArrivalDelay(1000, 0)).toBe(0);
    expect(colorArrivalDelay(1000, 900)).toBe(100);
    expect(colorArrivalDelay(1000, 1000)).toBe(200);
  });
});

describe('colorArrival', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('brings colors at once when nothing was typed', () => {
    const arrive = vi.fn();
    colorArrival(arrive, () => Date.now()).arrived();
    expect(arrive).toHaveBeenCalledTimes(1);
  });

  it('holds colors while typing goes on, and brings them once, when it pauses', () => {
    const arrive = vi.fn();
    const arrival = colorArrival(arrive, () => Date.now());
    arrival.typed();
    arrival.arrived();
    vi.advanceTimersByTime(150);
    arrival.typed();
    arrival.arrived();
    vi.advanceTimersByTime(150);
    expect(arrive).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TYPING_PAUSE_MS);
    expect(arrive).toHaveBeenCalledTimes(1);
  });

  it('brings nothing once the editor is gone', () => {
    const arrive = vi.fn();
    const arrival = colorArrival(arrive, () => Date.now());
    arrival.typed();
    arrival.arrived();
    arrival.stop();
    vi.advanceTimersByTime(TYPING_PAUSE_MS);
    expect(arrive).not.toHaveBeenCalled();
  });
});
