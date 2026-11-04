import { describe, expect, it, vi } from 'vitest';
import { compareNames, comparePaths } from '@shared/pathOrder';
import { countCalls } from '@shared/testing/countCalls';
import { countedReads } from '@shared/testing/countedReads';
import { arranged, layoutPathItems } from '../lib/pathTree';
import { extensionOf, fileListOrder, rankedOrder, rankList } from './fileListOrder';
import type { FileListSort } from './fileListViewStore';
import type { StatusTone } from './StatusBadge';

interface File {
  path: string;
  tone: StatusTone;
}

vi.mock('@shared/pathOrder', async (original) => {
  const actual = await original<typeof import('@shared/pathOrder')>();
  return { ...actual, compareNames: vi.fn(actual.compareNames) };
});

const facts = { toneOf: (file: File) => file.tone };
const files = (entries: [string, StatusTone][]): File[] => entries.map(([path, tone]) => ({ path, tone })).sort((a, b) => comparePaths(a.path, b.path));
const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
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

  // A million changes ranked by name compared about 20 million pairs of names (4 s); a project's files share names
  // (`index.ts`, `README.md`, `Player.prefab` in each scene), which are compared once.
  it('sorts by name comparing each name only once whatever the files that share it', () => {
    const many = files(Array.from({ length: 1000 }, (_, index): [string, StatusTone] => [`d${index}/name${index % 10}.ts`, 'changed']));
    vi.mocked(compareNames).mockClear();
    const sorted = arranged(many, fileListOrder('name', facts)!);
    expect(vi.mocked(compareNames).mock.calls.length).toBeLessThan(10 * 10);
    expect(sorted.map((file) => file.path)).toEqual([...many].sort((a, b) => compareNames(nameOf(a.path), nameOf(b.path))).map((file) => file.path));
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

  it.each(['name', 'status', 'extension'] as const)('arranges a list by %s as sorting it would, ties in path order', (sort) => {
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

  // A filter over a million changes grouped by changelist and status picks each group out of the ranks: sorting a group
  // by a function looking ranks up took a second for 900,000 changes, and a slot per rank went over every rank per group.
  it.each([3, 150, 200])('picks %i items out of the ranks with one look-up each', (count) => {
    const many = files(Array.from({ length: 200 }, (_, index): [string, StatusTone] => [`f${(index * 37) % 200}.ts`, 'changed']));
    const ranked = rankedOrder(many, fileListOrder('name', facts)!);
    const shuffled = many.slice(0, count).reverse();
    const { result, calls } = countCalls(Map.prototype, 'get', () => ranked.arrange!(shuffled));
    expect(result).toEqual([...shuffled].sort(ranked.compare));
    expect(calls).toBe(count);
  });

  // A read of a million changes where one file was edited keeps every other change: it is found its place among them,
  // where going over them all compared half a million names (0.5 s).
  it('keeps the order of the items a read before ranked, finding the new one its place in about log n comparisons', () => {
    const many = files(Array.from({ length: 1000 }, (_, index): [string, StatusTone] => [`d${index % 7}/f${index}.ts`, 'changed']));
    const first = rankedOrder(many, fileListOrder('name', facts)!);
    const added: File = { path: 'd3/f500b.ts', tone: 'changed' };
    const counted = countedNameOrder();
    const next = rankedOrder([...many.slice(1), added], counted.order, first);
    expect(counted.calls).toBeLessThanOrEqual(Math.ceil(Math.log2(many.length)) + 1);
    expect(next.ordered).toEqual([...many.slice(1), added].sort(fileListOrder('name', facts)!.compare));
  });

  it.each(['status', 'extension'] as const)('keeps the order of the items a read before ranked by %s, reading only the new one and a few others', (sort) => {
    const tones: StatusTone[] = ['changed', 'added', 'private'];
    const many = files(Array.from({ length: 1000 }, (_, index): [string, StatusTone] => [`d${index % 7}/f${index}.${['ts', 'png'][index % 2]}`, tones[index % 3]!]));
    const added: File = { path: 'd3/f500b.cs', tone: 'added' };
    const { items, reads } = countedReads([...many, added]);
    const first = rankedOrder(items.slice(0, -1), fileListOrder(sort, facts)!);
    const readBefore = reads();
    const next = rankedOrder(items, fileListOrder(sort, facts)!, first);
    // Each item is looked up among the ranks, unread: only those the new one is compared with are read.
    expect(reads() - readBefore).toBeLessThan(10 * Math.log2(many.length));
    const inPathOrder = [...many, added].sort((a, b) => comparePaths(a.path, b.path));
    expect(next.ordered.map((file) => file.path)).toEqual(fileListOrder(sort, facts)!.arrange!(inPathOrder).map((file) => file.path));
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

describe('rankList', () => {
  const sample = files([
    ['b/a.ts', 'added'],
    ['a/c.ts', 'changed'],
    ['c/b.ts', 'changed'],
  ]);

  it('ranks the list afresh when the sort changes, rather than keeping the last sort\'s order', () => {
    const byStatus = rankList(sample, 'status', facts, undefined);
    expect(rankList(sample, 'name', facts, byStatus).order!.ordered.map((file) => file.path)).toEqual(['b/a.ts', 'c/b.ts', 'a/c.ts']);
  });

  it('starts from the last ranking of the same sort', () => {
    const first = rankList(sample, 'name', facts, undefined);
    const added: File = { path: 'a/b.ts', tone: 'added' };
    const next = rankList([added, ...sample], 'name', facts, first);
    expect(next.order!.ordered.map((file) => file.path)).toEqual(['b/a.ts', 'a/b.ts', 'c/b.ts', 'a/c.ts']);
  });

  it('has no ranking for the path order the items come in', () => {
    expect(rankList(sample, 'path', facts, undefined).order).toBeUndefined();
  });
});
