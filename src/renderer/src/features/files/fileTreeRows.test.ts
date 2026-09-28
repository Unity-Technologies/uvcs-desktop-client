import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import { treeArrowMove } from '../../lib/treeArrowMove';
import { ancestorsOf, buildFileTreeRows, fileTreeArrowRows, indentOf, parentOf, sortItems } from './fileTreeRows';

function item(path: string, itemType: TreeItem['itemType'] = 'file'): TreeItem {
  return {
    path,
    name: path.split('/').at(-1)!,
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

const tree = new Map<string, TreeItem[]>([
  ['', [item('readme.md'), item('src', 'directory'), item('Assets', 'directory')]],
  ['src', [item('src/b.ts'), item('src/a.ts'), item('src/lib', 'directory')]],
]);

describe('buildFileTreeRows', () => {
  it('lists directories first, sorted by name', () => {
    const rows = buildFileTreeRows({ childrenByDirectory: tree, expanded: new Set() });
    expect(rows.map((row) => row.item.path)).toEqual(['Assets', 'src', 'readme.md']);
  });

  it('shows the children of expanded directories and flags unlisted ones as loading', () => {
    const rows = buildFileTreeRows({ childrenByDirectory: tree, expanded: new Set(['src', 'src/lib']) });
    expect(rows.map((row) => [row.item.path, row.depth])).toEqual([
      ['Assets', 0],
      ['src', 0],
      ['src/lib', 1],
      ['src/a.ts', 1],
      ['src/b.ts', 1],
      ['readme.md', 0],
    ]);
    expect(rows.find((row) => row.item.path === 'src/lib')?.isLoading).toBe(true);
  });

  it('keeps the directories of matching items when filtering', () => {
    const rows = buildFileTreeRows({ childrenByDirectory: tree, expanded: new Set(['src']), filter: 'A.T' });
    expect(rows.map((row) => row.item.path)).toEqual(['src', 'src/a.ts']);
  });

  it('needs every word of the filter in one name', () => {
    expect(buildFileTreeRows({ childrenByDirectory: tree, expanded: new Set(['src']), filter: 'ts a.' }).map((row) => row.item.path)).toEqual(['src', 'src/a.ts']);
    expect(buildFileTreeRows({ childrenByDirectory: tree, expanded: new Set(['src']), filter: 'src a.ts' })).toEqual([]);
  });

  it('puts everything under the workspace root when there is one, filtered or not', () => {
    const root = { item: item('', 'directory'), expanded: true };
    const rows = buildFileTreeRows({ childrenByDirectory: tree, expanded: new Set(['src']), filter: 'a.ts', root });
    expect(rows.map((row) => [row.item.path, row.depth])).toEqual([
      ['', 0],
      ['src', 1],
      ['src/a.ts', 2],
    ]);
  });

  it('shows just the root while it is collapsed, and loading until the root is listed', () => {
    expect(buildFileTreeRows({ childrenByDirectory: tree, expanded: new Set(), root: { item: item('', 'directory'), expanded: false } })).toHaveLength(1);
    const [loading] = buildFileTreeRows({ childrenByDirectory: new Map(), expanded: new Set(), root: { item: item('', 'directory'), expanded: true } });
    expect(loading?.isLoading).toBe(true);
  });
});

describe('big trees', () => {
  it('sorts each listing once, however often the rows are rebuilt', () => {
    const listing = [item('b.ts'), item('a.ts')];
    expect(sortItems(listing)).toBe(sortItems(listing));
    expect(listing.map((entry) => entry.path)).toEqual(['b.ts', 'a.ts']);
  });

  it('lists as the official client does: controlled folders, private folders, controlled files, private files', () => {
    const privately = (entry: TreeItem): TreeItem => ({ ...entry, isPrivate: true });
    const listing = [privately(item('notes.txt')), item('b.ts'), privately(item('build', 'directory')), item('Assets', 'directory'), item('lib', 'xlink'), item('a.ts')];
    expect(sortItems(listing).map((entry) => entry.name)).toEqual(['Assets', 'lib', 'build', 'a.ts', 'b.ts', 'notes.txt']);
  });

  it('filters a deep tree reading each folder once, not once per folder above it', () => {
    const depth = 30;
    const chain = Array.from({ length: depth }, (_, level) => Array.from({ length: level + 1 }, (_, index) => `d${index}`).join('/'));
    const listings = new Map<string, TreeItem[]>([['', [item(chain[0]!, 'directory')]]]);
    chain.forEach((directory, level) => listings.set(directory, [...(chain[level + 1] ? [item(chain[level + 1]!, 'directory')] : []), item(`${directory}/${level === depth - 1 ? 'target' : 'other'}.ts`)]));
    let reads = 0;
    const counted = new Map(listings);
    counted.get = (key) => (reads++, listings.get(key));

    const rows = buildFileTreeRows({ childrenByDirectory: counted, expanded: new Set(chain), filter: 'target' });
    expect(rows).toHaveLength(depth + 1);
    expect(reads).toBeLessThanOrEqual(4 * (depth + 1));
  });
});

describe('path helpers', () => {
  it('returns ancestors outermost first', () => {
    expect(ancestorsOf('a/b/c.ts')).toEqual(['a', 'a/b']);
    expect(ancestorsOf('c.ts')).toEqual([]);
  });

  it('returns the parent directory', () => {
    expect(parentOf('a/b/c.ts')).toBe('a/b');
    expect(parentOf('c.ts')).toBe('');
  });
});

describe('indentOf', () => {
  it('indents the first levels in full and deeper ones by less, so deep names keep room', () => {
    expect(indentOf(0)).toBe(0);
    expect(indentOf(8)).toBe(128);
    expect(indentOf(9)).toBe(132);
    expect(indentOf(20)).toBe(176);
  });
});

describe('fileTreeArrowRows', () => {
  const rows = buildFileTreeRows({ childrenByDirectory: tree, expanded: new Set(['src']) });
  const arrowRows = fileTreeArrowRows(rows);
  const at = (path: string) => rows.findIndex((row) => row.item.path === path);

  it('opens a closed folder, then steps into it', () => {
    expect(treeArrowMove(arrowRows, at('Assets'), 'ArrowRight')).toEqual({ kind: 'toggle' });
    expect(treeArrowMove(arrowRows, at('src'), 'ArrowRight')).toEqual({ kind: 'moveBy', step: 1 });
    expect(treeArrowMove(arrowRows, at('src/a.ts'), 'ArrowRight')).toBeNull();
  });

  it('closes an open folder, and goes from a child up to its folder', () => {
    expect(treeArrowMove(arrowRows, at('src'), 'ArrowLeft')).toEqual({ kind: 'toggle' });
    expect(treeArrowMove(arrowRows, at('src/b.ts'), 'ArrowLeft')).toEqual({ kind: 'moveBy', step: at('src') - at('src/b.ts') });
    expect(treeArrowMove(arrowRows, at('readme.md'), 'ArrowLeft')).toBeNull();
  });
});
