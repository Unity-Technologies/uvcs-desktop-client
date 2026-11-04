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

describe('the orders that arrange in buckets', () => {
  const sample = files([
    ['b/z.png', 'added'],
    ['a/y.ts', 'changed'],
    ['a/x.PNG', 'private'],
    ['Makefile', 'changed'],
  ]);

  it.each(['status', 'extension'] as const)('arranges a list by %s as sorting it would, ties in path order', (sort) => {
    const order = fileListOrder(sort, facts)!;
    expect(order.arrange!(sample)).toEqual([...sample].sort(order.compare));
  });

  it('arranges without comparing two items', () => {
    let reads = 0;
    const order = fileListOrder<File>('status', { toneOf: (file) => (reads++, file.tone) })!;
    order.arrange!(sample);
    expect(reads).toBe(sample.length);
  });
});

describe('rankedOrder', () => {
  const sample = files([
    ['b.ts', 'added'],
    ['a.ts', 'changed'],
    ['c.ts', 'changed'],
  ]);
  /** The name order, counting how many times two items are compared. */
  const countedNameOrder = () => {
    const byName = fileListOrder('name', facts)!;
    const counted = { calls: 0, order: { compare: (a: File, b: File) => (counted.calls++, byName.compare(a, b)) } };
    return counted;
  };

  it('orders as the order it ranks by, items it never saw last', () => {
    const byStatus = rankedOrder(sample, fileListOrder('status', facts)!);
    const stranger: File = { path: 'z.ts', tone: 'changed' };
    expect([stranger, ...sample].sort(byStatus.compare).map((file) => file.path)).toEqual(['a.ts', 'c.ts', 'b.ts', 'z.ts']);
    expect(byStatus.arrange!([stranger, ...sample]).map((file) => file.path)).toEqual(['a.ts', 'c.ts', 'b.ts', 'z.ts']);
  });

  it('picks a filtered list out of the ranks, few items or most of them, without comparing names again', () => {
    const many = files(Array.from({ length: 200 }, (_, index): [string, StatusTone] => [`f${(index * 37) % 200}.ts`, 'changed']));
    const counted = countedNameOrder();
    const ranked = rankedOrder(many, counted.order);
    const ranking = counted.calls;
    const expected = (items: File[]) => [...items].sort(fileListOrder('name', facts)!.compare);
    expect(ranked.arrange!(many.slice(0, 150))).toEqual(expected(many.slice(0, 150)));
    expect(ranked.arrange!(many.slice(0, 3))).toEqual(expected(many.slice(0, 3)));
    expect(counted.calls).toBe(ranking);
  });

  it('keeps the order of the items a read before ranked, comparing only the new one against them', () => {
    const many = files(Array.from({ length: 1000 }, (_, index): [string, StatusTone] => [`d${index % 7}/f${index}.ts`, 'changed']));
    const first = rankedOrder(many, fileListOrder('name', facts)!);
    const added: File = { path: 'd3/f500b.ts', tone: 'changed' };
    const counted = countedNameOrder();
    const next = rankedOrder([...many, added], counted.order, first);
    // Merged in: about one comparison per item kept, where ranking afresh takes about log n each.
    expect(counted.calls).toBeLessThan(many.length * 1.1);
    expect(next.ordered).toEqual([...many, added].sort(fileListOrder('name', facts)!.compare));
  });

  it('ranks afresh when fewer than half the items are still there', () => {
    const first = rankedOrder(sample, fileListOrder('name', facts)!);
    const others = files([
      ['q.ts', 'added'],
      ['p.ts', 'added'],
      ['a.ts', 'changed'],
    ]);
    expect(rankedOrder(others, fileListOrder('name', facts)!, first).ordered.map((file) => file.path)).toEqual(['a.ts', 'p.ts', 'q.ts']);
  });
});
