import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrailingDebounce } from './trailingDebounce';

describe('createTrailingDebounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles once, on the last value, when values stop coming: 4, 42, 420, 4207 typed reads 4207 alone', () => {
    vi.useFakeTimers();
    const settled: number[] = [];
    const debounce = createTrailingDebounce<number>((value) => settled.push(value));
    for (const value of [4, 42, 420, 4207]) {
      debounce.push(value, 300);
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(300);
    expect(settled).toEqual([4207]);
  });

  it('settles on nothing once stopped', () => {
    vi.useFakeTimers();
    const settled: number[] = [];
    const debounce = createTrailingDebounce<number>((value) => settled.push(value));
    debounce.push(12, 300);
    debounce.stop();
    vi.advanceTimersByTime(600);
    expect(settled).toEqual([]);
  });
});
