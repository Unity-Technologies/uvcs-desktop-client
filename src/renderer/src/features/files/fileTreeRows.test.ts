import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import { ancestorsOf, buildFileTreeRows, parentOf } from './fileTreeRows';

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
