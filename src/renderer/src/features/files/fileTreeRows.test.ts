import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import { ancestorsOf, buildFileTreeRows, indentOf, parentOf } from './fileTreeRows';

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
