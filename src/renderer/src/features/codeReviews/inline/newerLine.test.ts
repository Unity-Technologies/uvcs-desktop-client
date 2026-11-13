import { describe, expect, it } from 'vitest';
import { newerLineFinder, newerLineOf, newerRangeInContextOf, newerRangeOf, type VersionDiff } from './newerLine';

const lines = (...texts: string[]): string => texts.map((text) => `${text}\n`).join('');
const TEN = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`);

describe('newerLineOf', () => {
  it('keeps the line where nothing changed', () => {
    expect(newerLineOf(lines(...TEN), lines(...TEN), 4)).toBe(4);
  });

  it('moves a line down by what was added above it, far from the change', () => {
    const newer = lines('new a', 'new b', ...TEN);
    expect(newerLineOf(lines(...TEN), newer, 1)).toBe(3);
    expect(newerLineOf(lines(...TEN), newer, 10)).toBe(12);
  });

  it('moves a line up by what was removed above it', () => {
    const newer = lines(...TEN.slice(3));
    expect(newerLineOf(lines(...TEN), newer, 9)).toBe(6);
  });

  it('follows a line inside a hunk, through the context around a change', () => {
    const newer = lines(...TEN.slice(0, 5), 'inserted', ...TEN.slice(5));
    expect(newerLineOf(lines(...TEN), newer, 5)).toBe(5);
    expect(newerLineOf(lines(...TEN), newer, 6)).toBe(7);
  });

  it('follows lines past several hunks', () => {
    const many = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`);
    const newer = [...many];
    newer.splice(30, 1); // removes line 31
    newer.splice(5, 0, 'a', 'b'); // adds two before line 6
    expect(newerLineOf(lines(...many), lines(...newer), 20)).toBe(22);
    expect(newerLineOf(lines(...many), lines(...newer), 40)).toBe(41);
  });

  it('has no line for one changed or removed', () => {
    const changed = lines(...TEN.slice(0, 4), 'line 5 edited', ...TEN.slice(5));
    expect(newerLineOf(lines(...TEN), changed, 5)).toBeNull();
    const removed = lines(...TEN.slice(0, 4), ...TEN.slice(5));
    expect(newerLineOf(lines(...TEN), removed, 5)).toBeNull();
  });

  it('has no line past the earlier version, nor before its first', () => {
    expect(newerLineOf(lines(...TEN), lines(...TEN), 11)).toBeNull();
    expect(newerLineOf(lines(...TEN), lines(...TEN), 0)).toBeNull();
  });

  it('keeps comments of a file that only changed its line ends', () => {
    expect(newerLineOf(TEN.join('\n'), TEN.join('\r\n'), 7)).toBe(7);
  });

  it('reads a line added at the very start of an earlier empty-looking file', () => {
    expect(newerLineOf(lines('only'), lines('first', 'only'), 1)).toBe(2);
  });

  it('keeps a line of text in any script', () => {
    const earlier = lines('名前', 'ñandú', '🎮 game');
    expect(newerLineOf(earlier, lines('añadido', '名前', 'ñandú', '🎮 game'), 3)).toBe(4);
  });
});

describe('newerLineFinder', () => {
  it('diffs each earlier version once, however many of its lines are followed', () => {
    let diffs = 0;
    const counted = (earlier: string): VersionDiff => {
      diffs += 1;
      return { hunks: [], earlierLineCount: earlier.split('\n').length - 1 };
    };
    const find = newerLineFinder(lines(...TEN), counted);
    expect([find(lines(...TEN), 1), find(lines(...TEN), 4), find(lines(...TEN.slice(1)), 2)]).toEqual([1, 4, 2]);
    expect(diffs).toBe(2);
  });
});

describe('newerRangeOf', () => {
  it('follows a block of lines moved down whole', () => {
    expect(newerRangeOf(lines(...TEN), lines('new', ...TEN), { firstLine: 3, lastLine: 5 })).toEqual({ firstLine: 4, lastLine: 6 });
  });

  it('follows one line as newerLineOf does', () => {
    expect(newerRangeOf(lines(...TEN), lines(...TEN.slice(2)), { firstLine: 7, lastLine: 7 })).toEqual({ firstLine: 5, lastLine: 5 });
  });

  it('loses a block one of whose lines changed, or that a line now splits', () => {
    const changed = [...TEN];
    changed[3] = 'line 4 edited';
    expect(newerRangeOf(lines(...TEN), lines(...changed), { firstLine: 3, lastLine: 5 })).toBeNull();
    expect(newerRangeOf(lines(...TEN), lines(...TEN.slice(0, 3), 'inserted', ...TEN.slice(3)), { firstLine: 3, lastLine: 5 })).toBeNull();
  });

  it('loses a block past the end of the earlier version', () => {
    expect(newerRangeOf(lines(...TEN), lines(...TEN), { firstLine: 9, lastLine: 11 })).toBeNull();
  });
});

describe('newerRangeInContextOf', () => {
  it('follows a block whose neighbors moved with it', () => {
    expect(newerRangeInContextOf(lines(...TEN), lines('new', ...TEN), { firstLine: 3, lastLine: 5 })).toEqual({ firstLine: 4, lastLine: 6 });
  });

  it('takes the first and last lines, which have a neighbor on one side only', () => {
    expect(newerRangeInContextOf(lines(...TEN), lines(...TEN), { firstLine: 1, lastLine: 1 })).toEqual({ firstLine: 1, lastLine: 1 });
    expect(newerRangeInContextOf(lines(...TEN), lines('new', ...TEN), { firstLine: 10, lastLine: 10 })).toEqual({ firstLine: 11, lastLine: 11 });
  });

  it('loses a lone brace paired with another once code moved around it', () => {
    expect(newerRangeOf(lines('a', 'b', '}'), lines('a', '}', 'b'), { firstLine: 3, lastLine: 3 })).toEqual({ firstLine: 2, lastLine: 2 });
    expect(newerRangeInContextOf(lines('a', 'b', '}'), lines('a', '}', 'b'), { firstLine: 3, lastLine: 3 })).toBeNull();
  });

  it('loses a block a line was put right next to', () => {
    expect(newerRangeInContextOf(lines(...TEN), lines(...TEN.slice(0, 2), 'new', ...TEN.slice(2)), { firstLine: 3, lastLine: 4 })).toBeNull();
  });
});
