import { describe, expect, it } from 'vitest';
import { trashName } from './trashName';

describe('trashName', () => {
  it('names the Recycle Bin on Windows and the trash elsewhere', () => {
    expect(trashName('win32')).toBe('Recycle Bin');
    expect(trashName('darwin')).toBe('trash');
    expect(trashName('linux')).toBe('trash');
  });
});
