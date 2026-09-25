import { describe, expect, it } from 'vitest';
import type { Annotation } from '@shared/domain/annotate';
import { buildAnnotationRows, distinctAuthors } from './annotationRows';

const changeset = (changesetId: number, date: string, owner = 'jane@example.com') => ({
  changesetId,
  owner,
  date,
  branch: '/main',
  comment: `Changeset ${changesetId}`,
  isMerge: false,
});

const annotation: Annotation = {
  lines: [
    { lineNumber: 1, content: 'a', changesetId: 1 },
    { lineNumber: 2, content: 'b', changesetId: 1 },
    { lineNumber: 3, content: 'c', changesetId: 7 },
    { lineNumber: 4, content: 'd', changesetId: 4 },
    { lineNumber: 5, content: 'e', changesetId: 1 },
  ],
  changesets: [changeset(1, '2026-01-01T00:00:00Z'), changeset(7, '2026-09-01T00:00:00Z', 'bob@example.com'), changeset(4, '2026-03-01T00:00:00Z')],
};

describe('buildAnnotationRows', () => {
  it('marks where each run of lines from the same changeset starts', () => {
    expect(buildAnnotationRows(annotation).map((row) => row.isBlockStart)).toEqual([true, false, true, true, true]);
  });

  it('ranks changesets from oldest (0) to newest (1)', () => {
    expect(buildAnnotationRows(annotation).map((row) => row.recency)).toEqual([0, 0, 1, 0.5, 0]);
  });

  it('treats a single changeset as the newest', () => {
    const single: Annotation = { lines: [{ lineNumber: 1, content: 'a', changesetId: 1 }], changesets: [changeset(1, '2026-01-01T00:00:00Z')] };
    expect(buildAnnotationRows(single)[0]?.recency).toBe(1);
  });
});

describe('distinctAuthors', () => {
  it('counts each author once', () => {
    expect(distinctAuthors(annotation)).toBe(2);
  });
});
