import { describe, expect, it } from 'vitest';
import { isSameOrInside } from './pathContainment';

describe('isSameOrInside', () => {
  it('takes the folder itself and what is inside it, not a sibling that starts the same', () => {
    expect(isSameOrInside('/home/me/wk', '/home/me/wk', 'linux')).toBe(true);
    expect(isSameOrInside('/home/me/wk', '/home/me/wk/src/a.ts', 'linux')).toBe(true);
    expect(isSameOrInside('/home/me/wk', '/home/me/wk-2/a.ts', 'linux')).toBe(false);
    expect(isSameOrInside('/home/me/wk/', '/home/me/wk/src', 'linux')).toBe(true);
    expect(isSameOrInside('/home/me/wk', '/home/me/wk/src/../../other', 'linux')).toBe(false);
  });

  it('compares Windows paths whatever their case, separators and trailing separator', () => {
    expect(isSameOrInside('C:\\Work\\Game', 'c:\\work\\game\\Assets\\a.cs', 'win32')).toBe(true);
    expect(isSameOrInside('C:\\Work\\Game\\', 'C:/Work/Game/Assets', 'win32')).toBe(true);
    expect(isSameOrInside('C:\\Work\\Game', 'C:\\Work\\Game2', 'win32')).toBe(false);
    expect(isSameOrInside('C:\\Work\\Game', 'D:\\Work\\Game', 'win32')).toBe(false);
    expect(isSameOrInside('C:\\', 'C:\\Work', 'win32')).toBe(true);
  });

  it('handles UNC shares', () => {
    expect(isSameOrInside('\\\\server\\share\\wk', '\\\\SERVER\\share\\wk\\src', 'win32')).toBe(true);
    expect(isSameOrInside('\\\\server\\share\\wk', '\\\\server\\other\\wk', 'win32')).toBe(false);
  });

  it('ignores case and how accents are composed on macOS, but not on Linux', () => {
    const composed = '/Users/me/Café';
    const decomposed = composed.normalize('NFD');
    expect(isSameOrInside(composed, `${decomposed}/src`, 'darwin')).toBe(true);
    expect(isSameOrInside('/Users/me/WK', '/users/me/wk/src', 'darwin')).toBe(true);
    expect(isSameOrInside(composed, `${decomposed}/src`, 'linux')).toBe(false);
    expect(isSameOrInside('/home/me/WK', '/home/me/wk/src', 'linux')).toBe(false);
  });
});
