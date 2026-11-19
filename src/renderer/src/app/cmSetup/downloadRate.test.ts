import { describe, expect, it } from 'vitest';
import { measureRate, secondsLeft, SETTLING_MS, startRate } from './downloadRate';

describe('downloadRate', () => {
  it('says nothing while the rate settles', () => {
    let rate = startRate(0, 0);
    rate = measureRate(rate, 1_000, 1_000_000);
    expect(secondsLeft(rate, 10_000_000)).toBeNull();
  });

  it('says the time left at a steady pace once settled', () => {
    let rate = startRate(0, 0);
    for (let at = 500; at <= SETTLING_MS; at += 500) rate = measureRate(rate, at, at * 1000);
    // 1 MB a second, 8 MB to go.
    expect(secondsLeft(rate, 10_000_000)).toBeCloseTo(8);
  });

  it('smooths a burst rather than jumping with it', () => {
    let rate = startRate(0, 0);
    for (let at = 500; at <= SETTLING_MS; at += 500) rate = measureRate(rate, at, at * 1000);
    rate = measureRate(rate, 2_500, 2_000_000 + 5_000_000);
    const left = secondsLeft(rate, 10_000_000)!;
    expect(left).toBeGreaterThan(3 / 10);
    expect(left).toBeLessThan(3);
  });

  it('says nothing without a size to reach', () => {
    let rate = startRate(0, 0);
    rate = measureRate(rate, SETTLING_MS, 2_000_000);
    expect(secondsLeft(rate, null)).toBeNull();
  });

  it('starts over when the download does', () => {
    let rate = startRate(0, 0);
    rate = measureRate(rate, SETTLING_MS, 2_000_000);
    rate = measureRate(rate, SETTLING_MS + 100, 0);
    expect(rate).toEqual(startRate(SETTLING_MS + 100, 0));
  });
});
