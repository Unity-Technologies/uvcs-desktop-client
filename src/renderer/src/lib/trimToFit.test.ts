import { describe, expect, it } from 'vitest';
import { fitPath, fittedPathWidth, positionsInTrimmed, trimFolderToFit, trimMiddleToFit, trimToFit } from './trimToFit';

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

describe('fitPath', () => {
  const fit = (folder: string, name: string, width: number) => {
    const { folder: shownFolder, name: shownName } = fitPath(folder, name, width, measure);
    return shownFolder + shownName;
  };

  it('keeps a path that fits', () => {
    expect(fit('/main/', 'login', 11)).toBe('/main/login');
  });

  it('drops whole folders from the middle first', () => {
    expect(fit('/main/task/sub/', 'login', 17)).toBe('/main/…/sub/login');
  });

  it('then keeps …/ before the whole name', () => {
    expect(fit('/main/', 'bulk-40', 9)).toBe('…/bulk-40');
  });

  it('cuts a name too long from its middle, still after …/, so the path never reads as top-level', () => {
    expect(fit('/main/', 'ghost-mode-fix', 11)).toBe('…/ghos…-fix');
  });

  it('gives the name all the room when …/ would leave it too little', () => {
    expect(fit('/main/', 'ghost-mode-fix', 6)).toBe('gho…ix');
  });

  it('cuts a top-level name from its middle', () => {
    expect(fit('/', 'main', 3)).toBe('m…n');
    expect(fit('', 'Assets.meta', 7)).toBe('Ass…eta');
  });
});

describe('fittedPathWidth', () => {
  const folder = '/main/child-br-cr-sample/empty-branch2/child_1/';

  it('is the whole path, with a pixel to spare', () => {
    expect(fittedPathWidth(folder, 'subtask', measure)).toEqual({ width: 55, nameWidth: 8 });
    expect(fittedPathWidth('/', 'main', measure, 40)).toEqual({ width: 6, nameWidth: 5 });
  });

  it('is what is left of a path fitted to its maximum, not the maximum', () => {
    expect(fittedPathWidth(folder, 'subtask', measure, 40)).toEqual({ width: 38, nameWidth: 8 });
  });

  it('fits the path the same way again at that width', () => {
    const { width } = fittedPathWidth(folder, 'subtask', measure, 40);
    expect(fitPath(folder, 'subtask', width - 1, measure)).toEqual(fitPath(folder, 'subtask', 39, measure));
  });
});
