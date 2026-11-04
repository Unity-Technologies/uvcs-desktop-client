import { describe, expect, it } from 'vitest';
import { diffBodyOf, stepsCanCome, type DiffBody } from './diffBody';
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
    expect(diffBodyOf({ kind: 'model', comparable: false }, false, null)).toBe('model');
    expect(diffBodyOf({ kind: 'binary' }, false, null)).toBe('binary');
  });

  it('says both versions were purged, editable or not', () => {
    expect(diffBodyOf({ kind: 'purged' }, true, null)).toBe('purged');
  });
});

describe('stepsCanCome', () => {
  it('lets a read-only text diff and a file typed into as a diff step through their changes, which may come a render later', () => {
    expect(stepsCanCome('textDiff', { wholeFile: false, stepsThroughChanges: true })).toBe(true);
    expect(stepsCanCome('editable', { wholeFile: false, stepsThroughChanges: true })).toBe(true);
  });

  it('never steps a file typed into whole, nor where the view steps instead (a merged result)', () => {
    expect(stepsCanCome('editable', { wholeFile: true, stepsThroughChanges: true })).toBe(false);
    expect(stepsCanCome('textDiff', { wholeFile: false, stepsThroughChanges: false })).toBe(false);
  });

  it('never steps what has no changes to show (only ignored changes included): its arrows go on to the files at once', () => {
    const none: (DiffBody | 'metaModel')[] = ['emptyFile', 'noContentChanges', 'onlyIgnoredChanges', 'tooLarge', 'image', 'model', 'binary', 'purged', 'metaModel'];
    for (const body of none) expect(stepsCanCome(body, { wholeFile: false, stepsThroughChanges: true }), body).toBe(false);
  });
});
