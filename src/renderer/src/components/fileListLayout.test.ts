import { describe, expect, it, vi } from 'vitest';
import { compareNames, comparePaths } from '@shared/pathOrder';
import { layoutFileList } from './fileListLayout';
import { fileListOrder, rankedOrder } from './fileListOrder';
import { statusGroup, type GroupedFileListFacts, type StatusGroup } from './statusGroups';
import type { StatusTone } from './StatusBadge';

vi.mock('@shared/pathOrder', async (original) => {
  const actual = await original<typeof import('@shared/pathOrder')>();
  return { ...actual, compareNames: vi.fn(actual.compareNames) };
});

interface File {
  path: string;
  tone: StatusTone;
}

const facts: GroupedFileListFacts<File, StatusGroup> = { toneOf: (file) => file.tone, statusGroup };
const keyOf = (file: File): string => file.path;
const TONES: StatusTone[] = ['changed', 'added', 'deleted'];
const many = Array.from({ length: 300 }, (_, index): File => ({ path: `d${index % 9}/f${(index * 7) % 300}.ts`, tone: TONES[index % 3]! })).sort((a, b) => comparePaths(a.path, b.path));

describe('layoutFileList', () => {
  // A diff of 50,000 files sorted by name took 100 ms a key typed in its filter, sorting what it left by name again.
  it.each([
    ['a list', false, false],
    ['a list grouped by status', false, true],
    ['a tree grouped by status', true, true],
  ])('lays %s out of a filtered list in an order ranked over the whole list, comparing no names', (_, tree, groupByStatus) => {
    const order = rankedOrder(many, fileListOrder('name', facts)!);
    const filtered = many.filter((_, index) => index % 4 !== 0);
    vi.mocked(compareNames).mockClear();
    const rows = layoutFileList({ sorted: filtered }, keyOf, { tree, groupByStatus, order }, facts);
    expect(compareNames).not.toHaveBeenCalled();
    const unranked = layoutFileList({ sorted: filtered }, keyOf, { tree, groupByStatus, order: fileListOrder('name', facts) }, facts);
    expect(rows.map((row) => row.key)).toEqual(unranked.map((row) => row.key));
  });
});
