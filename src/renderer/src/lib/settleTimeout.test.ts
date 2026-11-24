import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onPendingSettlesChange, pendingSettleCount, settleTimeout } from './settleTimeout';

describe('settleTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts a wait as pending until it settles, then runs it', () => {
    const settled = vi.fn();
    settleTimeout(settled, 300);
    expect(pendingSettleCount()).toBe(1);
    vi.advanceTimersByTime(300);
    expect(settled).toHaveBeenCalledOnce();
    expect(pendingSettleCount()).toBe(0);
  });

  it('stops counting a wait cancelled, never runs it, and cancelling it twice counts it off once', () => {
    const settled = vi.fn();
    const cancel = settleTimeout(settled, 300);
    const other = settleTimeout(() => {}, 300);
    cancel();
    cancel();
    expect(pendingSettleCount()).toBe(1);
    vi.advanceTimersByTime(300);
    expect(settled).not.toHaveBeenCalled();
    expect(pendingSettleCount()).toBe(0);
    other();
    expect(pendingSettleCount()).toBe(0);
  });

  it('tells its listeners as a wait starts and ends, already counted', () => {
    const counts: number[] = [];
    const stop = onPendingSettlesChange(() => counts.push(pendingSettleCount()));
    settleTimeout(() => {}, 300);
    vi.advanceTimersByTime(300);
    stop();
    settleTimeout(() => {}, 300)();
    expect(counts).toEqual([1, 0]);
  });
});
