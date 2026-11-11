import { describe, expect, it } from 'vitest';
import { checkStateOf, downloadRules, isFolderRead, toggled, type DownloadItem, type DownloadTree, type DownloadedChoices } from './downloadSelection';

const file = (path: string): DownloadItem => ({ path, isDirectory: false, iconType: 'file' });
const folder = (path: string): DownloadItem => ({ path, isDirectory: true, iconType: 'directory' });

/** A repository holding `Assets/{Textures/{a.png,b.png},hero.fbx}`, `Code/main.cs` and `readme.md`. */
function tree(loadedIn: Record<string, string[]>, read: string[] = ['', 'Assets', 'Assets/Textures', 'Code']): DownloadTree {
  const items: Record<string, DownloadItem[]> = {
    '': [folder('Assets'), folder('Code'), file('readme.md')],
    Assets: [folder('Assets/Textures'), file('Assets/hero.fbx')],
    'Assets/Textures': [file('Assets/Textures/a.png'), file('Assets/Textures/b.png')],
    Code: [file('Code/main.cs')],
  };
  return {
    items: new Map(read.map((path) => [path, items[path]!])),
    loadedIn: new Map(Object.entries(loadedIn)),
  };
}

const none: DownloadedChoices = new Map();
const nothingLoaded = tree({ '': [] });

describe('checkStateOf', () => {
  it('ticks what the workspace has loaded, until the user chooses otherwise', () => {
    const loaded = tree({ '': ['Code'], Code: ['Code/main.cs'] });
    expect(checkStateOf('Code', loaded, none)).toBe(true);
    expect(checkStateOf('Code/main.cs', loaded, none)).toBe(true);
    expect(checkStateOf('readme.md', loaded, none)).toBe(false);
    expect(checkStateOf('Assets/hero.fbx', loaded, none)).toBe(false);
  });

  it('shows a folder some of whose items are chosen as mixed', () => {
    const loaded = tree({ '': ['Assets'], Assets: ['Assets/hero.fbx'] });
    expect(checkStateOf('Assets', loaded, none)).toBe('mixed');
    expect(checkStateOf('', loaded, none)).toBe('mixed');
  });

  it('ticks a loaded folder not read yet, which may be only partly loaded', () => {
    const loaded = tree({ '': ['Assets'] }, ['']);
    expect(checkStateOf('Assets', loaded, none)).toBe(true);
  });

  it('keeps a folder of nothing as chosen or not', () => {
    const empty: DownloadTree = { items: new Map([['', [folder('Empty')]], ['Empty', []]]), loadedIn: new Map([['', ['Empty']]]) };
    expect(checkStateOf('Empty', empty, none)).toBe(true);
    expect(checkStateOf('Empty', empty, toggled('Empty', empty, none))).toBe(false);
  });
});

describe('toggled', () => {
  it('chooses everything below a folder the user ticks', () => {
    const choices = toggled('Assets', nothingLoaded, none);
    expect(checkStateOf('Assets', nothingLoaded, choices)).toBe(true);
    expect(checkStateOf('Assets/Textures/a.png', nothingLoaded, choices)).toBe(true);
  });

  it('ticks a mixed folder whole, overriding what was chosen below it', () => {
    const someChosen = toggled('Assets/hero.fbx', nothingLoaded, none);
    expect(checkStateOf('Assets', nothingLoaded, someChosen)).toBe('mixed');
    const all = toggled('Assets', nothingLoaded, someChosen);
    expect(checkStateOf('Assets', nothingLoaded, all)).toBe(true);
    expect(toggled('Assets', nothingLoaded, all)).toEqual(new Map([['Assets', false]]));
  });

  it('unticks a loaded item', () => {
    const loaded = tree({ '': ['readme.md'] });
    expect(checkStateOf('readme.md', loaded, toggled('readme.md', loaded, none))).toBe(false);
  });
});

describe('isFolderRead', () => {
  it('needs the repository and, for a loaded folder, the workspace to have been read', () => {
    expect(isFolderRead('Assets', tree({ '': ['Assets'] }))).toBe(false);
    expect(isFolderRead('Assets', tree({ '': ['Assets'], Assets: [] }))).toBe(true);
    expect(isFolderRead('Assets', tree({ '': [] }))).toBe(true);
    expect(isFolderRead('Assets', tree({ '': [] }, ['']))).toBe(false);
  });
});

describe('downloadRules', () => {
  it('asks nothing when nothing changed', () => {
    expect(downloadRules(tree({ '': ['Code'], Code: ['Code/main.cs'] }), none)).toEqual([]);
  });

  it('downloads a folder chosen whole with one rule', () => {
    expect(downloadRules(nothingLoaded, toggled('Assets', nothingLoaded, none))).toEqual([{ path: 'Assets', load: true }]);
  });

  it('downloads a folder whose every item the user ticked one by one with one rule', () => {
    const choices = toggled('Code/main.cs', nothingLoaded, none);
    expect(downloadRules(nothingLoaded, choices)).toEqual([{ path: 'Code', load: true }]);
  });

  it('downloads only the chosen items of a folder chosen in part', () => {
    const choices = toggled('Assets/Textures/a.png', nothingLoaded, toggled('Assets/hero.fbx', nothingLoaded, none));
    expect(downloadRules(nothingLoaded, choices)).toEqual([
      { path: 'Assets/Textures/a.png', load: true },
      { path: 'Assets/hero.fbx', load: true },
    ]);
  });

  it('removes a loaded folder unticked whole with one rule', () => {
    const loaded = tree({ '': ['Assets'], Assets: ['Assets/hero.fbx'] });
    const unticked = toggled('Assets', loaded, toggled('Assets', loaded, none));
    expect(checkStateOf('Assets', loaded, unticked)).toBe(false);
    expect(downloadRules(loaded, unticked)).toEqual([{ path: 'Assets', load: false }]);
  });

  it('completes a partly loaded folder item by item, since cm takes a folder holding anything as loaded', () => {
    const loaded = tree({ '': ['Assets'], Assets: ['Assets/hero.fbx'] });
    expect(downloadRules(loaded, toggled('Assets', loaded, none))).toEqual([{ path: 'Assets/Textures', load: true }]);
  });

  it('downloads and removes in one go', () => {
    const loaded = tree({ '': ['Code'], Code: ['Code/main.cs'] });
    const choices = toggled('readme.md', loaded, toggled('Code', loaded, none));
    expect(downloadRules(loaded, choices)).toEqual([
      { path: 'Code', load: false },
      { path: 'readme.md', load: true },
    ]);
  });

  it('never removes the root, even with every item unticked', () => {
    const loaded = tree({ '': ['Code', 'readme.md'], Code: ['Code/main.cs'] });
    const choices = toggled('readme.md', loaded, toggled('Code', loaded, none));
    expect(downloadRules(loaded, choices)).toEqual([
      { path: 'Code', load: false },
      { path: 'readme.md', load: false },
    ]);
  });

  it('leaves alone a loaded folder not read yet that stays ticked', () => {
    const loaded = tree({ '': ['Assets'] }, ['']);
    expect(downloadRules(loaded, toggled('readme.md', loaded, none))).toEqual([{ path: 'readme.md', load: true }]);
  });
});
