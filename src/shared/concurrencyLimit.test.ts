import { describe, expect, it } from 'vitest';
import { concurrencyLimit } from './concurrencyLimit';

describe('concurrencyLimit', () => {
  it('runs at most so many at once, the rest in the order they came', async () => {
    const limit = concurrencyLimit(2);
    let running = 0;
    let most = 0;
    const order: number[] = [];
    const task = (n: number) => async () => {
      most = Math.max(most, ++running);
      await Promise.resolve();
      await Promise.resolve();
      order.push(n);
      running--;
    };
    await Promise.all([1, 2, 3, 4, 5].map((n) => limit(task(n))));
    expect(most).toBe(2);
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  it('hands a finished slot to the next waiting, so one asking just then waits its turn', async () => {
    const limit = concurrencyLimit(1);
    let running = 0;
    let most = 0;
    const task = async () => {
      most = Math.max(most, ++running);
      await Promise.resolve();
      running--;
    };
    const first = limit(task);
    const second = limit(task);
    // Asked as the first one ends, before the second has run.
    await first.then(() => limit(task));
    await second;
    expect(most).toBe(1);
  });

  it('frees the slot of a task that failed', async () => {
    const limit = concurrencyLimit(1);
    await expect(limit(() => Promise.reject(new Error('busy')))).rejects.toThrow('busy');
    expect(await limit(() => Promise.resolve('next'))).toBe('next');
  });
});
