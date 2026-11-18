import { describe, expect, it } from 'vitest';
import { choicesAwaitReads, downloadSearchCheck, foldersAboveResults, isLoadKnown } from './downloadSearch';
import { downloadRules, toggled, type DownloadItem, type DownloadTree, type DownloadedChoices } from './downloadSelection';

const file = (path: string): DownloadItem => ({ path, isDirectory: false, iconType: 'file' });
const folder = (path: string): DownloadItem => ({ path, isDirectory: true, iconType: 'directory' });

/** A repository holding `Assets/{Textures/{a.png,b.png},hero.fbx}`, `Code/main.cs` and `readme.md`. */
function tree(loadedIn: Record<string, string[]>, read: string[]): DownloadTree {
  const items: Record<string, DownloadItem[]> = {
    '': [folder('Assets'), folder('Code'), file('readme.md')],
    Assets: [folder('Assets/Textures'), file('Assets/hero.fbx')],
    'Assets/Textures': [file('Assets/Textures/a.png'), file('Assets/Textures/b.png')],
    Code: [file('Code/main.cs')],
  };
  return { items: new Map(read.map((path) => [path, items[path]!])), loadedIn: new Map(Object.entries(loadedIn)) };
}

const none: DownloadedChoices = new Map();

describe('isLoadKnown', () => {
  it('waits for each loaded folder above the item to be read', () => {
    expect(isLoadKnown('Assets/Textures/a.png', tree({ '': ['Assets'] }, ['']))).toBe(false);
    expect(isLoadKnown('Assets/Textures/a.png', tree({ '': ['Assets'], Assets: ['Assets/Textures'] }, ['']))).toBe(false);
    expect(
      isLoadKnown('Assets/Textures/a.png', tree({ '': ['Assets'], Assets: ['Assets/Textures'], 'Assets/Textures': [] }, [''])),
    ).toBe(true);
  });

  it('knows nothing is loaded below a folder the workspace holds nothing of, with nothing more to read', () => {
    expect(isLoadKnown('Assets/Textures/a.png', tree({ '': [] }, ['']))).toBe(true);
    expect(isLoadKnown('Assets/Textures/a.png', tree({ '': ['Assets'], Assets: ['Assets/hero.fbx'] }, ['']))).toBe(true);
  });

  it('waits for the root itself', () => {
    expect(isLoadKnown('readme.md', tree({}, []))).toBe(false);
  });
});

describe('foldersAboveResults', () => {
  it('lists each folder above the results once, never the root', () => {
    expect(foldersAboveResults(['Assets/Textures/a.png', 'Assets/Textures/b.png', 'Code/main.cs', 'readme.md']).sort()).toEqual(
      ['Assets', 'Assets/Textures', 'Code'].sort(),
    );
    expect(foldersAboveResults([])).toEqual([]);
  });
});

describe('downloadSearchCheck', () => {
  it('shows nothing until whether the result is loaded is known', () => {
    expect(downloadSearchCheck('Code/main.cs', tree({ '': ['Code'] }, ['']), none)).toBeUndefined();
  });

  it('ticks a loaded result and unticks one that is not, with no change to apply', () => {
    const loaded = tree({ '': ['Code'], Code: ['Code/main.cs'] }, ['']);
    expect(downloadSearchCheck('Code/main.cs', loaded, none)).toEqual({ check: true, change: 'kept' });
    expect(downloadSearchCheck('Assets/hero.fbx', loaded, none)).toEqual({ check: false, change: 'none' });
  });

  it('shows what Apply does once the user ticks or unticks a result', () => {
    const loaded = tree({ '': ['Code'], Code: ['Code/main.cs'] }, ['']);
    expect(downloadSearchCheck('Code/main.cs', loaded, toggled('Code/main.cs', loaded, none))).toEqual({ check: false, change: 'unload' });
    expect(downloadSearchCheck('Assets/hero.fbx', loaded, toggled('Assets/hero.fbx', loaded, none))).toEqual({ check: true, change: 'load' });
  });

  it('ticks a loaded folder found by the search though its items are not read, as the tree does', () => {
    expect(downloadSearchCheck('Assets/Textures', tree({ '': ['Assets'], Assets: ['Assets/Textures'] }, ['']), none)).toEqual({
      check: true,
      change: 'kept',
    });
  });
});

describe('choicesAwaitReads', () => {
  it('waits while a folder above a choice is not read, then makes its rule', () => {
    const unread = tree({ '': [] }, ['']);
    const choices = toggled('Assets/Textures/a.png', unread, none);
    expect(choicesAwaitReads(unread, choices)).toBe(true);

    const read = tree({ '': [] }, ['', 'Assets', 'Assets/Textures']);
    expect(choicesAwaitReads(read, choices)).toBe(false);
    expect(downloadRules(read, choices)).toEqual([{ path: 'Assets/Textures/a.png', load: true }]);
  });

  it('waits for nothing without choices', () => {
    expect(choicesAwaitReads(tree({}, []), none)).toBe(false);
  });
});
