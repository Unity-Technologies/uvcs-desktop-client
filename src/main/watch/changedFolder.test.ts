import { describe, expect, it } from 'vitest';
import { changedFolder } from './changedFolder';

describe('changedFolder', () => {
  it('is the folder holding the item, with either separator', () => {
    expect(changedFolder('src/deep/a.ts', 'linux')).toBe('src/deep');
    expect(changedFolder('src\\deep\\a.ts', 'win32')).toBe('src/deep');
    expect(changedFolder('readme.md', 'darwin')).toBe('');
  });

  it('names folders on macOS the way cm does, decomposed', () => {
    expect(changedFolder('Café/menu.txt'.normalize('NFC'), 'darwin')).toBe('Café'.normalize('NFD'));
    expect(changedFolder('Café/menu.txt'.normalize('NFC'), 'linux')).toBe('Café'.normalize('NFC'));
  });

  it('is unknown when the platform did not name the item', () => {
    expect(changedFolder(undefined, 'win32')).toBeNull();
  });
});
