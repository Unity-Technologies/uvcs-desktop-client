import { describe, expect, it } from 'vitest';
import { positionsInTrimmed, trimFolderToFit, trimMiddleToFit, trimToFit } from './trimToFit';

const measure = (text: string): number => Array.from(text).length;

describe('trimToFit', () => {
  it('keeps text that fits', () => {
    expect(trimToFit('src/app/', 8, measure)).toBe('src/app/');
  });

  it('cuts the end and adds an ellipsis', () => {
    expect(trimToFit('src/app/main/', 6, measure)).toBe('src/a…');
  });

  it('returns nothing when not even the ellipsis fits', () => {
    expect(trimToFit('src/', 0, measure)).toBe('');
  });

  it('never splits a surrogate pair', () => {
    expect(trimToFit('a😀bcd', 3, measure)).toBe('a😀…');
  });
});

describe('trimMiddleToFit', () => {
  it('keeps text that fits', () => {
    expect(trimMiddleToFit('cm status', 9, measure)).toBe('cm status');
  });

  it('cuts the middle, keeping both ends', () => {
    expect(trimMiddleToFit('cm update /work/game', 9, measure)).toBe('cm u…game');
    expect(trimMiddleToFit('cm update /work/game', 10, measure)).toBe('cm up…game');
  });

  it('returns nothing when not even the ellipsis fits', () => {
    expect(trimMiddleToFit('cm status', 0, measure)).toBe('');
    expect(trimMiddleToFit('cm status', 1, measure)).toBe('…');
  });
});

describe('trimFolderToFit', () => {
  const branchParent = '/main/child-br-cr-sample/empty-branch2/child_1/';

  it('keeps a folder that fits', () => {
    expect(trimFolderToFit(branchParent, 100, measure)).toBe(branchParent);
  });

  it('drops middle segments, keeping the first and as many of the last as fit', () => {
    expect(trimFolderToFit(branchParent, 30, measure)).toBe('/main/…/empty-branch2/child_1/');
    expect(trimFolderToFit(branchParent, 20, measure)).toBe('/main/…/child_1/');
    expect(trimFolderToFit(branchParent, 10, measure)).toBe('/main/…/');
  });

  it('works on relative paths', () => {
    expect(trimFolderToFit('Assets/Scripts/Gameplay/', 20, measure)).toBe('Assets/…/Gameplay/');
  });

  it('leaves only an ellipsis when not even the first segment fits', () => {
    expect(trimFolderToFit(branchParent, 6, measure)).toBe('…/');
    expect(trimFolderToFit('/main/', 4, measure)).toBe('…/');
    expect(trimFolderToFit(branchParent, 1, measure)).toBe('');
  });
});

describe('positionsInTrimmed', () => {
  it('keeps positions of text shown whole', () => {
    expect(positionsInTrimmed('src/app/', 'src/app/', [0, 4])).toEqual([0, 4]);
  });

  it('moves positions after a cut in the middle and drops the cut ones', () => {
    // '/main/' + '…' + '/child_1/' out of '/main/child-br/empty/child_1/'.
    expect(positionsInTrimmed('/main/child-br/empty/child_1/', '/main/…/child_1/', [1, 6, 21])).toEqual([1, 8]);
  });

  it('drops positions cut from the end', () => {
    expect(positionsInTrimmed('src/app/main/', 'src/a…', [0, 4, 6])).toEqual([0, 4]);
  });
});
