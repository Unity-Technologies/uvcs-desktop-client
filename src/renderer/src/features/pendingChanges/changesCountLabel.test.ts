import { describe, expect, it } from 'vitest';
import { changesCountLabel } from './changesCountLabel';

describe('changesCountLabel', () => {
  it('counts the files listed, none too', () => {
    expect(changesCountLabel(5, 5)).toBe('5 files');
    expect(changesCountLabel(1, 1)).toBe('1 file');
    expect(changesCountLabel(0, 0)).toBe('0 files');
  });

  it('says how many of them show while the filter hides some', () => {
    expect(changesCountLabel(1204, 2)).toBe('2 of 1,204');
  });

  it('has no count until the changes are read', () => {
    expect(changesCountLabel(undefined, 0)).toBeNull();
  });
});
