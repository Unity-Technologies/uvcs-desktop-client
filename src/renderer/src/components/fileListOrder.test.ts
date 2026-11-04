import { describe, expect, it } from 'vitest';
import { comparePaths } from '@shared/pathOrder';
import { layoutPathItems } from '../lib/pathTree';
import { extensionOf, fileListOrder, rankedOrder } from './fileListOrder';
import type { FileListSort } from './fileListViewStore';
import type { StatusTone } from './StatusBadge';

interface File {
  path: string;
  tone: StatusTone;
}

const facts = { toneOf: (file: File) => file.tone };
const files = (entries: [string, StatusTone][]): File[] => entries.map(([path, tone]) => ({ path, tone })).sort((a, b) => comparePaths(a.path, b.path));
/** The paths of a flat list of `items` sorted by `sort`. */
const listed = (items: File[], sort: FileListSort): string[] =>
  layoutPathItems(items, (file) => file.path, { tree: false, folderScope: 'all', order: fileListOrder(sort, facts) }).map((row) => row.key);

describe('fileListOrder', () => {
  const sample = files([
    ['src/zeta.ts', 'added'],
    ['src/Alpha.png', 'changed'],
    ['docs/beta.md', 'deleted'],
    ['Makefile', 'changed'],
    ['src/file_10.ts', 'moved'],
    ['src/file_2.ts', 'changed'],
  ]);

  it('keeps the path order by path', () => {
    expect(fileListOrder('path', facts)).toBeUndefined();
    expect(listed(sample, 'path')).toEqual(['docs/beta.md', 'Makefile', 'src/Alpha.png', 'src/file_2.ts', 'src/file_10.ts', 'src/zeta.ts']);
  });

  it('sorts by the file names alone, numbers as people read them, whatever their folders', () => {
    expect(listed(sample, 'name')).toEqual(['src/Alpha.png', 'docs/beta.md', 'src/file_2.ts', 'src/file_10.ts', 'Makefile', 'src/zeta.ts']);
  });

  it("sorts by status in the chips' order, keeping the path order within one status", () => {
    expect(listed(sample, 'status')).toEqual(['Makefile', 'src/Alpha.png', 'src/file_2.ts', 'src/file_10.ts', 'docs/beta.md', 'src/zeta.ts']);
  });

  it('sorts by extension, files without one first, keeping the path order within one', () => {
    expect(listed(sample, 'extension')).toEqual(['Makefile', 'docs/beta.md', 'src/Alpha.png', 'src/file_2.ts', 'src/file_10.ts', 'src/zeta.ts']);
  });
});

describe('extensionOf', () => {
  it('reads the last extension of the name, in lower case', () => {
    expect(extensionOf('a/b.PNG')).toBe('png');
    expect(extensionOf('a.b/c.tar.gz')).toBe('gz');
  });

  it('finds none in a name without a dot, or one that only starts with one', () => {
    expect(extensionOf('a.b/Makefile')).toBe('');
    expect(extensionOf('src/.gitignore')).toBe('');
  });
});

describe('rankedOrder', () => {
  const sample = files([
    ['b.ts', 'added'],
    ['a.ts', 'changed'],
    ['c.ts', 'changed'],
  ]);

  it('orders as the order it ranks by, items it never saw last', () => {
    const byStatus = rankedOrder(sample, fileListOrder('status', facts)!);
    const stranger: File = { path: 'z.ts', tone: 'changed' };
    expect([stranger, ...sample].sort(byStatus).map((file) => file.path)).toEqual(['a.ts', 'c.ts', 'b.ts', 'z.ts']);
  });

  it('compares the items once, when ranking them, and never again however often it sorts', () => {
    const byName = fileListOrder('name', facts)!;
    let calls = 0;
    const order = rankedOrder(sample, (a, b) => {
      calls++;
      return byName(a, b);
    });
    const ranking = calls;
    [...sample].sort(order);
    [...sample].reverse().sort(order);
    expect(calls).toBe(ranking);
  });
});
