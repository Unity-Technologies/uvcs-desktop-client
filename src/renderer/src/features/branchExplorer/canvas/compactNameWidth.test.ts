import { describe, expect, it } from 'vitest';
import { compactNameWidth } from './compactNameWidth';

describe('compactNameWidth', () => {
  it('lets a name run a little past the end of its band', () => {
    expect(compactNameWidth(100, 140, Number.POSITIVE_INFINITY, 1000)).toBe(120);
  });

  it('stops before the next branch on the row', () => {
    expect(compactNameWidth(100, 400, 90, 1000)).toBe(90);
  });

  it('shortens a name near the right edge instead of letting the edge cut it', () => {
    expect(compactNameWidth(900, 960, Number.POSITIVE_INFINITY, 1000)).toBe(94);
  });

  it('keeps a minimum room when squeezed', () => {
    expect(compactNameWidth(980, 990, 20, 1000)).toBe(60);
  });
});
