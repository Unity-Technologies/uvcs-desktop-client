import { describe, expect, it } from 'vitest';
import { parsedDate } from './parsedDate';

describe('parsedDate', () => {
  it("reads cm's round-trip dates, seven fraction digits and an offset, and toISOString's", () => {
    expect(parsedDate('2026-11-20T09:15:02.1234567+01:00')).toBe(Date.UTC(2026, 10, 20, 8, 15, 2, 123));
    expect(parsedDate('2026-11-20T08:15:02.000Z')).toBe(Date.UTC(2026, 10, 20, 8, 15, 2));
  });

  it('reads nothing from no text, or from text that is no date', () => {
    expect(parsedDate(undefined)).toBeUndefined();
    expect(parsedDate('')).toBeUndefined();
    expect(parsedDate('20/11/2026 9:15')).toBeUndefined();
  });
});
