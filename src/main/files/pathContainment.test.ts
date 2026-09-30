import { describe, expect, it } from 'vitest';
import { countCharactersRead } from '@shared/testing/countCharactersRead';
import { isSameOrInside, outermostPaths } from './pathContainment';

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

describe('outermostPaths', () => {
  it('leaves out what a folder in the list holds, keeping the order given', () => {
    const picked = ['/wk/file333 copy.txt', '/wk/icon copy', '/wk/icon copy/buttonbookmark.png', '/wk/icon copy/plastic.ico', '/wk/ignore copy.conf'];
    expect(outermostPaths(picked, 'linux')).toEqual(['/wk/file333 copy.txt', '/wk/icon copy', '/wk/ignore copy.conf']);
  });

  it('keeps siblings that only start the same, and the folder when it comes after what it holds', () => {
    expect(outermostPaths(['/wk/icon copy/a.png', '/wk/icon', '/wk/icon copy', '/wk/icons/b.png'], 'linux')).toEqual(['/wk/icon', '/wk/icon copy', '/wk/icons/b.png']);
  });

  it('compares as the OS does: case on Windows and macOS, separators on Windows', () => {
    expect(outermostPaths(['C:\\wk\\Icons', 'c:/wk/icons/a.png'], 'win32')).toEqual(['C:\\wk\\Icons']);
    expect(outermostPaths(['/wk/Icons', '/wk/icons/a.png'], 'darwin')).toEqual(['/wk/Icons']);
    expect(outermostPaths(['/wk/Icons', '/wk/icons/a.png'], 'linux')).toEqual(['/wk/Icons', '/wk/icons/a.png']);
  });

  it('reads thousands of paths in one sorted pass: a few reads of each character, whatever the count', () => {
    const paths = [...Array.from({ length: 5_000 }, (_, index) => `/wk/dir${index % 100}/file${index}.txt`), '/wk/dir7'];
    const { result: outermost, charactersRead } = countCharactersRead(() => outermostPaths(paths, 'linux'));
    // About one read of each character; comparing each path with every other reads each thousands of times.
    expect(charactersRead / paths.join('').length).toBeLessThan(3);
    expect(outermost).toHaveLength(4_951);
  });
});
