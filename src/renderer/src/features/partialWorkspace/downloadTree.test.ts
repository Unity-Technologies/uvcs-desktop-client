import { describe, expect, it } from 'vitest';
import type { ItemType, TreeItem } from '@shared/domain/explorer';
import { toggled } from './downloadSelection';
import { downloadKey, downloadRows, downloadTreeOf, foldersToReadLoaded, rulesSummary, type DownloadRow } from './downloadTree';

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
      { path: 'Assets', isDirectory: true },
      { path: 'Lib', isDirectory: false },
      { path: 'readme.md', isDirectory: false },
    ]);
    expect(tree.loadedIn.get('')).toEqual([]);
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
