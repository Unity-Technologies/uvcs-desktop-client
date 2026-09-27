import { describe, expect, it } from 'vitest';
import { visibleRows } from './visibleRows';

const layout = { count: 50_000, rowHeight: 20, offsetTop: 8, overscan: 10 };

describe('visibleRows', () => {
  it('renders the rows in view and the overscan below them at the top', () => {
    expect(visibleRows({ scrollTop: 0, height: 400 }, layout)).toEqual({ first: 0, end: 30 });
  });

  it('follows the scroll position, past the padding above the first row', () => {
    expect(visibleRows({ scrollTop: 20_008, height: 400 }, layout)).toEqual({ first: 990, end: 1030 });
  });

  it('stays within the rows at the end and for short files', () => {
    expect(visibleRows({ scrollTop: 999_700, height: 400 }, layout)).toEqual({ first: 49_974, end: 50_000 });
    expect(visibleRows({ scrollTop: 0, height: 400 }, { ...layout, count: 3 })).toEqual({ first: 0, end: 3 });
    expect(visibleRows({ scrollTop: 0, height: 400 }, { ...layout, count: 0 })).toEqual({ first: 0, end: 0 });
  });
});
