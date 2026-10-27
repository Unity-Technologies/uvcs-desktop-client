import { describe, expect, it } from 'vitest';
import { goToFileKey } from './goToFileKeys';

describe('goToFileKey', () => {
  it('moves the highlight with the arrows, never past the first or the last result', () => {
    expect(goToFileKey('ArrowDown', 0, 3)).toEqual({ kind: 'highlight', index: 1 });
    expect(goToFileKey('ArrowDown', 2, 3)).toEqual({ kind: 'highlight', index: 2 });
    expect(goToFileKey('ArrowUp', 1, 3)).toEqual({ kind: 'highlight', index: 0 });
    expect(goToFileKey('ArrowUp', 0, 3)).toEqual({ kind: 'highlight', index: 0 });
  });

  it('picks the highlighted result on Enter', () => {
    expect(goToFileKey('Enter', 1, 3)).toEqual({ kind: 'pick', index: 1 });
  });

  it('does nothing without results, nor for any other key', () => {
    expect(goToFileKey('ArrowDown', 0, 0)).toBeNull();
    expect(goToFileKey('Enter', 0, 0)).toBeNull();
    expect(goToFileKey('a', 0, 3)).toBeNull();
  });
});
