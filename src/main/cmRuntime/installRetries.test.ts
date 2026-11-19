import { describe, expect, it } from 'vitest';
import { retriesByItself, retryDelayAfter } from './installRetries';

describe('retryDelayAfter', () => {
  it('waits longer after each failure, then every five minutes', () => {
    expect([0, 1, 2, 3, 4, 10].map(retryDelayAfter)).toEqual([5_000, 15_000, 60_000, 300_000, 300_000, 300_000]);
  });
});

describe('retriesByItself', () => {
  it('retries only what the network may fix by itself', () => {
    expect(retriesByItself('offline')).toBe(true);
    expect(retriesByItself('unreachable')).toBe(true);
    for (const failure of ['diskFull', 'notWritable', 'proxyAuthentication', 'damaged', 'unavailable'] as const) expect(retriesByItself(failure)).toBe(false);
  });
});
