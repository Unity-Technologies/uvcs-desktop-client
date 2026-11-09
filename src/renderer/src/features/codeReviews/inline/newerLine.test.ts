import { describe, expect, it } from 'vitest';
import { newerLineOf } from './newerLine';

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
