import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressThrottle } from './ProgressThrottle';

describe('ProgressThrottle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('passes the first value at once and the latest of a burst after the interval', () => {
    const emitted: number[] = [];
    const throttle = new ProgressThrottle<number>((value) => emitted.push(value), 100);
    throttle.push(1);
    throttle.push(2);
    throttle.push(3);
    expect(emitted).toEqual([1]);
    vi.advanceTimersByTime(100);
    expect(emitted).toEqual([1, 3]);
  });

  it('passes urgent values at once', () => {
    const emitted: number[] = [];
    const throttle = new ProgressThrottle<number>((value) => emitted.push(value), 100);
    throttle.push(1);
    throttle.push(2, true);
    expect(emitted).toEqual([1, 2]);
    vi.advanceTimersByTime(100);
    expect(emitted).toEqual([1, 2]);
  });

  it('flushes what is pending, once', () => {
    const emitted: number[] = [];
    const throttle = new ProgressThrottle<number>((value) => emitted.push(value), 100);
    throttle.push(1);
    throttle.push(2);
    throttle.flush();
    throttle.flush();
    vi.advanceTimersByTime(100);
    expect(emitted).toEqual([1, 2]);
  });
});
