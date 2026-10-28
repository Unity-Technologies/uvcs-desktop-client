import { describe, expect, it } from 'vitest';
import { colorArrivalDelay } from './colorArrival';

describe('colorArrivalDelay', () => {
  it('redraws with the colors at once after a pause in typing, and waits out the rest of one while typing', () => {
    expect(colorArrivalDelay(1000, 0)).toBe(0);
    expect(colorArrivalDelay(1000, 900)).toBe(100);
    expect(colorArrivalDelay(1000, 1000)).toBe(200);
  });
});
