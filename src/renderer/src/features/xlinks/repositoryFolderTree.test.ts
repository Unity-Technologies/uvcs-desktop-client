import { describe, expect, it } from 'vitest';
import { folderKey, folderRows, initiallyExpanded, openingFolder, parentFolder, toggled, type FolderListing } from './repositoryFolderTree';

const LISTINGS = new Map<string, FolderListing>([
  ['/', ['/Assets', '/Shaders']],
  ['/Assets', ['/Assets/Art', '/Assets/Lib']],
  ['/Assets/Art', []],
]);

const summary = (rows: ReturnType<typeof folderRows>) => rows.map((row) => `${'  '.repeat(row.level)}${row.name}${row.expanded ? ' -' : row.expandable ? ' +' : ''}`);

describe('The folder picker’s tree', () => {
  it('shows the root named after the repository, and the folders of each open folder under it', () => {
    expect(summary(folderRows('lib@local', LISTINGS, new Set(['/', '/Assets'])))).toEqual(['lib@local -', '  Assets -', '    Art', '    Lib +', '  Shaders +']);
  });

  it('opens on a folder typed in any form: without its slash, with backslashes or a trailing slash', () => {
    for (const typed of ['Assets/Lib', 'Assets\\Lib', '/Assets/Lib/', ' /Assets//Lib ']) {
      expect(openingFolder(typed)).toBe('/Assets/Lib');
      expect([...initiallyExpanded(typed)]).toEqual(['/', '/Assets']);
    }
    expect(openingFolder('')).toBe('/');
  });

  it('opens on the folder already chosen, every folder above it open', () => {
    expect([...initiallyExpanded('/Assets/Lib/Core')]).toEqual(['/', '/Assets/Lib', '/Assets']);
    expect([...initiallyExpanded('/')]).toEqual(['/']);
  });

  it('says a folder open but not read yet is loading, and one that couldn’t be read failed', () => {
    const rows = folderRows('lib@local', new Map<string, FolderListing>([['/', ['/Shaders']], ['/Shaders', 'failed']]), new Set(['/', '/Shaders']));

    expect(rows.map((row) => row.contents)).toEqual(['shown', 'failed']);
    expect(folderRows('lib@local', new Map(), new Set(['/']))[0]!.contents).toBe('loading');
  });

  it('keeps the root open, and opens or closes any other folder', () => {
    expect([...toggled(new Set(['/']), '/')]).toEqual(['/']);
    expect([...toggled(new Set(['/']), '/Assets')]).toEqual(['/', '/Assets']);
    expect([...toggled(new Set(['/', '/Assets']), '/Assets')]).toEqual(['/']);
  });

  it('knows each folder’s parent', () => {
    expect(parentFolder('/Assets/Lib')).toBe('/Assets');
    expect(parentFolder('/Assets')).toBe('/');
    expect(parentFolder('/')).toBe('/');
  });
});

describe('The folder picker’s keys', () => {
  const rows = folderRows('lib@local', LISTINGS, new Set(['/', '/Assets']));

  it('moves with the arrows, staying inside the tree', () => {
    expect(folderKey(rows, '/Assets', 'ArrowDown')).toEqual({ select: '/Assets/Art' });
    expect(folderKey(rows, '/', 'ArrowUp')).toEqual({ select: '/' });
    expect(folderKey(rows, '/Shaders', 'ArrowDown')).toEqual({ select: '/Shaders' });
  });

  it('opens a closed folder with →, and goes into an open one', () => {
    expect(folderKey(rows, '/Shaders', 'ArrowRight')).toEqual({ toggle: '/Shaders' });
    expect(folderKey(rows, '/Assets', 'ArrowRight')).toEqual({ select: '/Assets/Art' });
    expect(folderKey(rows, '/Assets/Art', 'ArrowRight')).toEqual({});
  });

  it('closes an open folder with ←, or goes to its parent; never closes the root', () => {
    expect(folderKey(rows, '/Assets', 'ArrowLeft')).toEqual({ toggle: '/Assets' });
    expect(folderKey(rows, '/Assets/Lib', 'ArrowLeft')).toEqual({ select: '/Assets' });
    expect(folderKey(rows, '/', 'ArrowLeft')).toEqual({});
  });

  it('chooses the selected folder with Enter, and leaves other keys alone', () => {
    expect(folderKey(rows, '/Assets/Lib', 'Enter')).toEqual({ choose: '/Assets/Lib' });
    expect(folderKey(rows, '/Assets/Lib', 'a')).toBeUndefined();
  });
});
