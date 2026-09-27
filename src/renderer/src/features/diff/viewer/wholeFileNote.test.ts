import { describe, expect, it } from 'vitest';
import { wholeFileNote } from './wholeFileNote';

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
