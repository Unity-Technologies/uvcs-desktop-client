import { describe, expect, it } from 'vitest';
import { headerCardLeft } from './headerCardLeft';

describe('headerCardLeft', () => {
  it('sits on the start of its band while that is on screen', () => {
    expect(headerCardLeft(300, 120, 108, Number.POSITIVE_INFINITY)).toBe(300);
  });

  it('pins to the left edge while the start is scrolled away', () => {
    expect(headerCardLeft(-500, 120, 108, Number.POSITIVE_INFINITY)).toBe(108);
  });

  it('stays whole at the edge even when only the end of its band still shows', () => {
    expect(headerCardLeft(-500, 200, 108, Number.POSITIVE_INFINITY)).toBe(108);
  });

  it('is pushed off the edge only by the next branch on its row', () => {
    expect(headerCardLeft(-500, 200, 108, 250)).toBe(50);
  });
});
