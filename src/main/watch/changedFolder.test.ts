import { describe, expect, it } from 'vitest';
import { changedFolder } from './changedFolder';

describe('changedFolder', () => {
  it('is the folder holding the item, with either separator', () => {
    expect(changedFolder('src/deep/a.ts')).toBe('src/deep');
    expect(changedFolder('src\\deep\\a.ts')).toBe('src/deep');
    expect(changedFolder('readme.md')).toBe('');
  });

  it('is unknown when the platform did not name the item', () => {
    expect(changedFolder(undefined)).toBeNull();
  });
});
