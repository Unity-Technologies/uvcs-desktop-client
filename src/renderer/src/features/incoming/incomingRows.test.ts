import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry } from '@shared/domain/diff';
import { incomingRows, selectionKey } from './incomingRows';

const changeset = (id: number): Changeset => ({ id, comment: `cs ${id}`, owner: 'dev', date: '2026-01-01T00:00:00Z', branch: '/main' }) as Changeset;
const file = (path: string, extra: Partial<DiffEntry> = {}): DiffEntry => ({ path, status: 'changed', ...extra }) as DiffEntry;

describe('incomingRows', () => {
  it('lists the files changed on both sides first, then the changesets, then the other files', () => {
    const { rows, entries } = incomingRows(
      [changeset(3), changeset(2)],
      [file('/a.ts'), file('/b.ts'), file('/c.ts', { status: 'moved', oldPath: '/old.ts' })],
      new Set(['/b.ts']),
      new Set(['/old.ts']),
    );
    expect(rows.map((row) => row.key)).toEqual([
      'section:Changed on both sides',
      'file:/b.ts',
      'file:/c.ts',
      'section:Changesets',
      'changeset:3',
      'changeset:2',
      'section:Files',
      'file:/a.ts',
    ]);
    expect(entries.map((entry) => entry.selection)).toEqual([
      { kind: 'file', path: '/b.ts' },
      { kind: 'file', path: '/c.ts' },
      { kind: 'changeset', id: 3 },
      { kind: 'changeset', id: 2 },
      { kind: 'file', path: '/a.ts' },
    ]);
  });

  it('leaves out the file sections with nothing in them, never the changesets', () => {
    expect(incomingRows([changeset(1)], [], new Set(), new Set()).rows.map((row) => row.key)).toEqual(['section:Changesets', 'changeset:1']);
  });

  it('finds each selectable row by its key, and knows its place among them', () => {
    const { rows, rowIndexOf } = incomingRows([changeset(7)], [file('/a.ts')], new Set(), new Set());
    const row = rows[rowIndexOf.get(selectionKey({ kind: 'file', path: '/a.ts' }))!]!;
    expect(row).toMatchObject({ type: 'file', entryIndex: 1 });
  });

  it('builds the rows of 100,000 files in linear time', () => {
    const files = Array.from({ length: 100_000 }, (_, index) => file(`/src/${index}.ts`));
    const conflicts = new Set(files.filter((_, index) => index % 10 === 0).map((entry) => entry.path));
    const started = performance.now();
    const { rows } = incomingRows([changeset(1)], files, conflicts, new Set());
    expect(rows).toHaveLength(100_000 + 1 + 3);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
