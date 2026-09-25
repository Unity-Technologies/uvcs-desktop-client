import { describe, expect, it } from 'vitest';
import { editsWholeFile } from './editsWholeFile';

describe('editsWholeFile', () => {
  it('edits a file with no changes yet (checked out, or moved) on its own, since its diff has no lines', () => {
    expect(editsWholeFile('one\ntwo\n', 'one\ntwo\n', 'recognizeAll')).toBe(true);
    expect(editsWholeFile('one\r\ntwo\r\n', 'one\r\ntwo\r\n', 'recognizeAll')).toBe(true);
  });

  it('edits an empty file on its own', () => {
    expect(editsWholeFile('', '', 'recognizeAll')).toBe(true);
  });

  it('edits on its own a file whose only changes the comparison method hides', () => {
    expect(editsWholeFile('one\ntwo\n', 'one\r\ntwo\r\n', 'ignoreEol')).toBe(true);
    expect(editsWholeFile('one\n', '  one\n', 'ignoreWhitespace')).toBe(true);
  });

  it('edits a changed or added file in the diff', () => {
    expect(editsWholeFile('one\ntwo\n', 'one\n2\n', 'recognizeAll')).toBe(false);
    expect(editsWholeFile('', 'added\n', 'recognizeAll')).toBe(false);
    expect(editsWholeFile('one\ntwo\n', 'one\r\ntwo\r\n', 'recognizeAll')).toBe(false);
  });
});
