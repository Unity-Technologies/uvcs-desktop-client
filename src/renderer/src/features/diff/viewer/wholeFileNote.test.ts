import { describe, expect, it } from 'vitest';
import { lineDiff } from './lineDiff';
import { typedIntoWhole, wholeFileNote } from './wholeFileNote';

const saved = { dirty: false, unsavedLineChanges: false };

describe('wholeFileNote', () => {
  it('says why the file as read shows whole', () => {
    expect(wholeFileNote({ ...saved, empty: true, identical: true })).toBe('empty');
    expect(wholeFileNote({ ...saved, empty: false, identical: true })).toBe('identical');
    expect(wholeFileNote({ ...saved, empty: false, identical: false })).toBe('ignored');
  });

  it('keeps a line while the file is typed into, about the unsaved text', () => {
    expect(wholeFileNote({ empty: true, identical: true, dirty: true, unsavedLineChanges: true })).toBe('unsaved');
    expect(wholeFileNote({ empty: false, identical: true, dirty: true, unsavedLineChanges: false })).toBe('ignored');
  });
});

describe('typedIntoWhole', () => {
  it('types a file whole when its diff as read has no lines to show: no content changes, empty, only hidden differences', () => {
    expect(typedIntoWhole(true, lineDiff('a\n', 'a\n', 'recognizeAll'))).toBe(true);
    expect(typedIntoWhole(true, lineDiff('', '', 'recognizeAll'))).toBe(true);
    expect(typedIntoWhole(true, lineDiff('a\r\n', 'a\n', 'ignoreEol'))).toBe(true);
    expect(typedIntoWhole(true, lineDiff('a\n', ' a \n', 'ignoreWhitespace'))).toBe(true);
  });

  it('types into the diff when it has lines to show, and never into a read-only one', () => {
    expect(typedIntoWhole(true, lineDiff('a\r\n', 'a\n', 'recognizeAll'))).toBe(false);
    expect(typedIntoWhole(false, lineDiff('a\n', 'a\n', 'recognizeAll'))).toBe(false);
    expect(typedIntoWhole(true, null)).toBe(false);
  });
});
