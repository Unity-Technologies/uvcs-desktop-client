import { describe, expect, it } from 'vitest';
import { isCut } from './isCut';

describe('isCut', () => {
  it('is cut when the content runs past the clamped height', () => {
    expect(isCut({ scrollHeight: 200, clientHeight: 93 })).toBe(true);
  });

  it('is whole when the content overflows only by rounding', () => {
    expect(isCut({ scrollHeight: 95, clientHeight: 93 })).toBe(false);
    expect(isCut({ scrollHeight: 93, clientHeight: 93 })).toBe(false);
  });

  it('is whole when there is no element (no description)', () => {
    expect(isCut(null)).toBe(false);
  });
});
