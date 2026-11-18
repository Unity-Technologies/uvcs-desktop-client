import { describe, expect, it } from 'vitest';
import { choicesAwaitReads, downloadSearchRow, foldersAboveResults, foldersOfResultsSoFar, isLoadKnown } from './downloadSearch';
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
const noFailures: ReadonlyMap<string, string> = new Map();

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

describe('foldersOfResultsSoFar', () => {
  it('adds the folders above new results to those already known', () => {
    const known = new Set(['Code']);
    expect([...foldersOfResultsSoFar(known, ['Assets/hero.fbx', 'Code/main.cs'])].sort()).toEqual(['Assets', 'Code']);
  });

  it('keeps the same set when the results add no folder, so nothing is read again', () => {
    const known = new Set(['Assets', 'Code']);
    expect(foldersOfResultsSoFar(known, ['Code/main.cs', 'readme.md'])).toBe(known);
  });
});

describe('downloadSearchRow', () => {
  const loaded = tree({ '': ['Code'], Code: ['Code/main.cs'] }, ['']);

  it('shows a spinner until whether the result is loaded is known', () => {
    expect(downloadSearchRow('Code/main.cs', tree({ '': ['Code'] }, ['']), none, noFailures)).toEqual({ kind: 'loading' });
  });

  it('ticks a loaded result and unticks one that is not, named by its last name, with no change to apply', () => {
    expect(downloadSearchRow('Code/main.cs', loaded, none, noFailures)).toEqual({
      kind: 'check',
      check: true,
      label: 'main.cs',
      change: 'kept',
      marker: undefined,
    });
    expect(downloadSearchRow('Assets/hero.fbx', loaded, none, noFailures)).toMatchObject({ check: false, change: 'none', marker: undefined });
  });

  it('shows what Apply does once the user ticks or unticks a result', () => {
    expect(downloadSearchRow('Code/main.cs', loaded, toggled('Code/main.cs', loaded, none), noFailures)).toMatchObject({
      check: false,
      marker: 'Remove',
    });
    expect(downloadSearchRow('Assets/hero.fbx', loaded, toggled('Assets/hero.fbx', loaded, none), noFailures)).toMatchObject({
      check: true,
      marker: 'Download',
    });
  });

  it('ticks a loaded folder found by the search though its items are not read, as the tree does', () => {
    const folderLoaded = tree({ '': ['Assets'], Assets: ['Assets/Textures'] }, ['']);
    expect(downloadSearchRow('Assets/Textures', folderLoaded, none, noFailures)).toMatchObject({ check: true, change: 'kept' });
  });

  it('says why a result below a folder that could not be read cannot be chosen', () => {
    const failures = new Map([['Code', "Couldn't read this folder."]]);
    expect(downloadSearchRow('Code/main.cs', tree({ '': ['Code'] }, ['']), none, failures)).toEqual({
      kind: 'failed',
      failure: "Couldn't read this folder.",
    });
  });
});
describe('choicesAwaitReads', () => {
  it('waits while a folder above a choice is not read, then makes its rule', () => {
    const unread = tree({ '': [] }, ['']);
    const choices = toggled('Assets/Textures/a.png', unread, none);
    expect(choicesAwaitReads(unread, choices, noFailures)).toBe(true);

    const read = tree({ '': [] }, ['', 'Assets', 'Assets/Textures']);
    expect(choicesAwaitReads(read, choices, noFailures)).toBe(false);
    expect(downloadRules(read, choices)).toEqual([{ path: 'Assets/Textures/a.png', load: true }]);
  });

  it('waits for nothing without choices', () => {
    expect(choicesAwaitReads(tree({}, []), none, noFailures)).toBe(false);
  });

  it('stops waiting for a folder that could not be read, whose choices make no rule', () => {
    const unread = tree({ '': [] }, ['', 'Assets']);
    const choices = toggled('Assets/Textures/a.png', unread, none);
    const failures = new Map([['Assets/Textures', "Couldn't read this folder."]]);
    expect(choicesAwaitReads(unread, choices, failures)).toBe(false);
    expect(downloadRules(unread, choices)).toEqual([]);
  });
});
