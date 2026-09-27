import { describe, expect, it } from 'vitest';
import { hasRevisionType, itemTypeLabel } from './itemType';

describe('itemTypeLabel', () => {
  it('names symbolic links as links, not as the file they point to', () => {
    expect(itemTypeLabel('symlink')).toBe('Symbolic link');
    expect(itemTypeLabel('binaryFile')).toBe('Binary file');
  });
});

describe('hasRevisionType', () => {
  it('holds for files only, so a link never changes its target', () => {
    expect(hasRevisionType('file')).toBe(true);
    expect(hasRevisionType('binaryFile')).toBe(true);
    expect(hasRevisionType('symlink')).toBe(false);
    expect(hasRevisionType('directory')).toBe(false);
    expect(hasRevisionType('xlink')).toBe(false);
  });
});
