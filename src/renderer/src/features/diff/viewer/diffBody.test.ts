import { describe, expect, it } from 'vitest';
import { diffBodyOf } from './diffBody';
import { lineDiff } from './lineDiff';

const text = (empty = false, identical = false) => ({ kind: 'text' as const, empty, identical });
const changed = lineDiff('a\n', 'b\n', 'recognizeAll', 'a.txt');
const onlyLineEndings = lineDiff('a\n', 'a\r\n', 'ignoreEol', 'a.txt');

describe('diffBodyOf', () => {
  it('types into a workspace file whatever its texts', () => {
    expect(diffBodyOf(text(true, true), true, lineDiff('', '', 'recognizeAll', 'a.txt'))).toBe('editable');
    expect(diffBodyOf(text(), true, changed)).toBe('editable');
  });

  it('says a read-only empty or unchanged file has nothing to compare', () => {
    expect(diffBodyOf(text(true, true), false, lineDiff('', '', 'recognizeAll', 'a.txt'))).toBe('emptyFile');
    expect(diffBodyOf(text(false, true), false, lineDiff('a\n', 'a\n', 'recognizeAll', 'a.txt'))).toBe('noContentChanges');
  });

  it('tells different texts the comparison method shows as equal from a diff', () => {
    expect(diffBodyOf(text(), false, onlyLineEndings)).toBe('onlyIgnoredChanges');
    expect(diffBodyOf(text(), false, changed)).toBe('textDiff');
  });

  it('shows what isn’t text as what it is, editable or not', () => {
    expect(diffBodyOf({ kind: 'tooLarge', content: 'text' }, true, null)).toBe('tooLarge');
    expect(diffBodyOf({ kind: 'image', comparable: true }, true, null)).toBe('image');
    expect(diffBodyOf({ kind: 'binary' }, false, null)).toBe('binary');
  });
});
