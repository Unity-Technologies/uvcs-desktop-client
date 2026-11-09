import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keySettle } from './keySettle';

describe('keySettle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('settles a key once it stayed put for the whole delay, the first one too: a row reached after a pause waits as any', () => {
    const settled = vi.fn();
    const settle = keySettle(settled, 300);
    settle.show('cs:4');
    vi.advanceTimersByTime(299);
    expect(settled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(settled).toHaveBeenCalledWith('cs:4');
  });

  it('settles only the key a quick run of changes stops on', () => {
    const settled = vi.fn();
    const settle = keySettle(settled, 300);
    for (const key of ['cs:1', 'cs:2', 'cs:3']) {
      settle.show(key);
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(300);
    expect(settled.mock.calls).toEqual([['cs:3']]);
  });

  it('settles nothing once stopped, nor a key shown again unchanged', () => {
    const settled = vi.fn();
    const settle = keySettle(settled, 300);
    settle.show('cs:4');
    vi.advanceTimersByTime(300);
    settle.show('cs:4');
    vi.advanceTimersByTime(300);
    settle.show('cs:5');
    settle.stop();
    vi.advanceTimersByTime(300);
    expect(settled.mock.calls).toEqual([['cs:4']]);
  });
});
