import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import type { ItemType } from '@shared/domain/pendingChanges';
import { toggled } from './downloadSelection';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import {
  downloadKey,
  downloadRows,
  downloadSearchChangeset,
  downloadSearchName,
  downloadTreeOf,
  downloadTreePoint,
  foldersToReadLoaded,
  revealedDownload,
  rootStatus,
  rulesSummary,
  type DownloadRow,
} from './downloadTree';

function item(path: string, itemType: ItemType): TreeItem {
  return {
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    itemType,
    size: 0,
    date: '',
    isPrivate: false,
    isCheckedOut: false,
    changeset: 1,
    branch: '/main',
    owner: '',
    revisionId: 1,
    parentRevisionId: -1,
    repository: 'game@local',
    itemId: 1,
  };
}

/** A repository holding `Assets/{Textures/a.png,hero.fbx}`, `Lib` (an xlink) and `readme.md`. */
const listings = new Map<string, TreeItem[]>([
  ['', [item('Assets', 'directory'), item('Lib', 'xlink'), item('readme.md', 'file')]],
  ['Assets', [item('Assets/Textures', 'directory'), item('Assets/hero.fbx', 'binaryFile')]],
  ['Assets/Textures', [item('Assets/Textures/a.png', 'binaryFile')]],
]);

/** Each row as `level name [check] marker`: `+` closed folder, `-` open one, `…` being read, `!` failed. */
function summary(rows: readonly DownloadRow[]): string[] {
  return rows.map((row) => {
    const check = row.check === 'mixed' ? '~' : row.check ? 'x' : ' ';
    const marker = !row.expandable ? '' : row.expanded ? ' -' : ' +';
    const note = row.note === 'loading' ? ' …' : row.note === 'failed' ? ' !' : '';
    return `${'  '.repeat(row.level)}${row.name} [${check}]${marker}${note}`;
  });
}

describe('downloadTreeOf', () => {
  it('takes folders as folders and everything else, xlinks included, as items downloaded whole', () => {
    const tree = downloadTreeOf(listings, new Map([['', []]]));
    expect(tree.items.get('')).toEqual([
      { path: 'Assets', isDirectory: true, iconType: 'directory' },
      { path: 'Lib', isDirectory: false, iconType: 'xlink' },
      { path: 'readme.md', isDirectory: false, iconType: 'file' },
    ]);
    expect(tree.loadedIn.get('')).toEqual([]);
  });

  it('takes a folder `cm ls` lists with an xlink target as an xlink, downloaded whole', () => {
    const xlinked: TreeItem = {
      ...item('Lib', 'directory'),
      xlink: { writable: false, path: '/', changeset: 12, repository: 'lib', server: 'local' },
    };
    const tree = downloadTreeOf(new Map([['', [xlinked]]]), new Map([['', []]]));
    expect(tree.items.get('')).toEqual([{ path: 'Lib', isDirectory: false, iconType: 'xlink' }]);
  });
});

describe('foldersToReadLoaded', () => {
  it('reads what the root and each open loaded folder hold, once', () => {
    const tree = downloadTreeOf(listings, new Map([['', ['Assets']]]));
    expect(foldersToReadLoaded(tree, new Set(['Assets', 'Assets/Textures']))).toEqual(['', 'Assets']);
  });

  it('never asks about a folder that isn’t loaded, which cm can’t list', () => {
    const tree = downloadTreeOf(listings, new Map([['', []]]));
    expect(foldersToReadLoaded(tree, new Set(['Assets']))).toEqual(['']);
  });

  it('asks about a folder inside one only once that one is read', () => {
    const before = downloadTreeOf(listings, new Map([['', ['Assets']]]));
    expect(foldersToReadLoaded(before, new Set(['Assets', 'Assets/Textures']))).not.toContain('Assets/Textures');
    const after = downloadTreeOf(listings, new Map([['', ['Assets']], ['Assets', ['Assets/Textures']]]));
    expect(foldersToReadLoaded(after, new Set(['Assets', 'Assets/Textures']))).toContain('Assets/Textures');
  });
});

describe('downloadRows', () => {
  const nothingLoaded = downloadTreeOf(listings, new Map([['', []]]));

  it('shows the root’s items, closed, unticked when nothing is loaded', () => {
    expect(summary(downloadRows(nothingLoaded, new Map(), new Set(), new Map()))).toEqual([
      'Assets [ ] +',
      'Lib [ ]',
      'readme.md [ ]',
    ]);
  });

  it('gives each row the icon Files draws for it', () => {
    const rows = downloadRows(nothingLoaded, new Map(), new Set(['Assets']), new Map());
    expect(rows.map((row) => row.iconType)).toEqual(['directory', 'directory', 'binaryFile', 'xlink', 'file']);
  });

  it('shows an open folder’s items below it, and its check from them', () => {
    const choices = toggled('Assets/hero.fbx', nothingLoaded, new Map());
    expect(summary(downloadRows(nothingLoaded, choices, new Set(['Assets']), new Map()))).toEqual([
      'Assets [~] -',
      '  Textures [ ] +',
      '  hero.fbx [x]',
      'Lib [ ]',
      'readme.md [ ]',
    ]);
  });

  it('notes an open folder still being read, and one that failed', () => {
    const partlyRead = downloadTreeOf(new Map([['', listings.get('')!], ['Assets', listings.get('Assets')!]]), new Map([['', []]]));
    const rows = downloadRows(partlyRead, new Map(), new Set(['Assets', 'Assets/Textures']), new Map());
    expect(summary(rows)).toContain('  Textures [ ] - …');
    const failed = downloadRows(partlyRead, new Map(), new Set(['Assets', 'Assets/Textures']), new Map([['Assets/Textures', 'Couldn’t read this folder']]));
    expect(summary(failed)).toContain('  Textures [ ] - !');
    expect(failed.find((row) => row.path === 'Assets/Textures')?.failure).toBe('Couldn’t read this folder');
  });

  it('shows a folder of nothing as not expandable once read', () => {
    const empty = downloadTreeOf(new Map([['', [item('Empty', 'directory')]], ['Empty', []]]), new Map([['', []]]));
    expect(summary(downloadRows(empty, new Map(), new Set(['Empty']), new Map()))).toEqual(['Empty [ ]']);
  });

  it('ticks a loaded folder whose loaded items are being read, and notes it', () => {
    const tree = downloadTreeOf(listings, new Map([['', ['Assets']]]));
    expect(summary(downloadRows(tree, new Map(), new Set(['Assets']), new Map()))[0]).toBe('Assets [x] - …');
  });
});

describe('downloadKey', () => {
  const tree = downloadTreeOf(listings, new Map([['', []]]));
  const closed = downloadRows(tree, new Map(), new Set(), new Map());
  const open = downloadRows(tree, new Map(), new Set(['Assets']), new Map());

  it('moves with the arrows, Home and End', () => {
    expect(downloadKey(closed, 'Assets', 'ArrowDown')).toEqual({ select: 'Lib' });
    expect(downloadKey(closed, 'Lib', 'ArrowUp')).toEqual({ select: 'Assets' });
    expect(downloadKey(closed, 'Assets', 'End')).toEqual({ select: 'readme.md' });
    expect(downloadKey(closed, 'readme.md', 'Home')).toEqual({ select: 'Assets' });
  });

  it('opens and closes folders with → and ←, and goes in and out of them', () => {
    expect(downloadKey(closed, 'Assets', 'ArrowRight')).toEqual({ expand: 'Assets' });
    expect(downloadKey(open, 'Assets', 'ArrowRight')).toEqual({ select: 'Assets/Textures' });
    expect(downloadKey(open, 'Assets/hero.fbx', 'ArrowLeft')).toEqual({ select: 'Assets' });
    expect(downloadKey(open, 'Assets', 'ArrowLeft')).toEqual({ expand: 'Assets' });
    expect(downloadKey(closed, 'readme.md', 'ArrowRight')).toEqual({});
    expect(downloadKey(closed, 'Assets', 'ArrowLeft')).toEqual({});
  });

  it('ticks or unticks the selected item with Space', () => {
    expect(downloadKey(closed, 'readme.md', ' ')).toEqual({ check: 'readme.md' });
  });

  it('lets any other key through', () => {
    expect(downloadKey(closed, 'Assets', 'Enter')).toBeUndefined();
    expect(downloadKey(closed, 'Assets', 'a')).toBeUndefined();
  });

  it('starts from the first row when nothing is selected yet', () => {
    expect(downloadKey(closed, '', 'ArrowDown')).toEqual({ select: 'Lib' });
  });
});

describe('rulesSummary', () => {
  it('counts what is downloaded and removed', () => {
    expect(rulesSummary([])).toBe('No changes');
    expect(rulesSummary([{ path: 'a', load: true }])).toBe('1 item to download');
    expect(rulesSummary([{ path: 'a', load: true }, { path: 'b', load: true }, { path: 'c', load: false }])).toBe(
      '2 items to download, 1 to remove',
    );
    expect(rulesSummary([{ path: 'c', load: false }, { path: 'd', load: false }])).toBe('2 items to remove');
  });
});

describe('rootStatus', () => {
  it('waits for both sides of the root, then shows its items or says it holds none', () => {
    expect(rootStatus(downloadTreeOf(new Map(), new Map([['', []]])), new Map())).toBe('loading');
    expect(rootStatus(downloadTreeOf(listings, new Map()), new Map())).toBe('loading');
    expect(rootStatus(downloadTreeOf(listings, new Map([['', []]])), new Map())).toBe('ready');
    expect(rootStatus(downloadTreeOf(new Map([['', []]]), new Map([['', []]])), new Map())).toBe('empty');
  });

  it('says so when the root couldn’t be read', () => {
    expect(rootStatus(downloadTreeOf(new Map(), new Map()), new Map([['', 'Couldn’t read this folder']]))).toBe('failed');
  });
});

describe('downloadTreePoint', () => {
  const on = (selector: WorkspaceSelector, loadedChangeset: number | null) => ({ selector, loadedChangeset });

  it("shows the tree of the changeset the workspace loaded", () => {
    expect(downloadTreePoint(on({ kind: 'label', name: 'v1' }, 12))).toEqual({ kind: 'changeset', changeset: 12 });
  });

  it("shows a branch's tree when a partial workspace on it loaded no one changeset", () => {
    expect(downloadTreePoint(on({ kind: 'branch', name: '/main/task' }, null))).toEqual({ kind: 'branch', branch: '/main/task' });
  });

  it('shows nothing on a shelve, whose tree is no changeset of the repository', () => {
    expect(downloadTreePoint(on({ kind: 'shelve', name: '7' }, null))).toBeNull();
  });
});

describe('revealedDownload', () => {
  it('opens every folder above a found item and selects it', () => {
    const revealed = revealedDownload('Assets/Textures/a.png', new Set());
    expect([...revealed.expanded].sort()).toEqual(['Assets', 'Assets/Textures']);
    expect(revealed.selected).toBe('Assets/Textures/a.png');
  });

  it('keeps the folders already open, and leaves a found folder itself closed', () => {
    const revealed = revealedDownload('Assets/Textures', new Set(['Lib']));
    expect([...revealed.expanded].sort()).toEqual(['Assets', 'Lib']);
    expect(revealed.selected).toBe('Assets/Textures');
  });

  it('selects an item of the root without opening anything', () => {
    expect(revealedDownload('readme.md', new Set())).toEqual({ expanded: new Set(), selected: 'readme.md' });
  });
});

describe('downloadSearchChangeset', () => {
  it("searches the changeset the tree shows", () => {
    expect(downloadSearchChangeset({ kind: 'changeset', changeset: 12 }, undefined)).toBe(12);
  });

  it("searches a branch's head once it is read, and nothing before", () => {
    expect(downloadSearchChangeset({ kind: 'branch', branch: '/main/task' }, 40)).toBe(40);
    expect(downloadSearchChangeset({ kind: 'branch', branch: '/main/task' }, undefined)).toBeNull();
  });

  it('searches nothing without a tree', () => {
    expect(downloadSearchChangeset(null, 40)).toBeNull();
  });
});

describe('downloadSearchName', () => {
  it("names the branch or label the workspace is on, as the search's notes say it", () => {
    expect(downloadSearchName({ kind: 'branch', name: '/main/task' })).toBe('/main/task');
    expect(downloadSearchName({ kind: 'label', name: 'BL100' })).toBe('BL100');
  });

  it('names a changeset by its number', () => {
    expect(downloadSearchName({ kind: 'changeset', name: '12' })).toBe('changeset 12');
  });
});
