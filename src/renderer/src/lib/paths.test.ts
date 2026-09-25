import { describe, expect, it } from 'vitest';
import { joinPath, lastSegment, parentDirectory } from './paths';

describe('paths', () => {
  it('joins with the separator the folder uses', () => {
    expect(joinPath('/Users/me/wkspaces', 'game')).toBe('/Users/me/wkspaces/game');
    expect(joinPath('C:\\work\\', 'game')).toBe('C:\\work\\game');
  });

  it('returns the last segment of a path', () => {
    expect(lastSegment('/Users/me/wkspaces/game/')).toBe('game');
  });

  it('returns the folder containing a path', () => {
    expect(parentDirectory('/Users/me/wkspaces/game/')).toBe('/Users/me/wkspaces');
    expect(parentDirectory('C:\\work\\game')).toBe('C:\\work');
    expect(parentDirectory('/game')).toBe('/');
  });
});
