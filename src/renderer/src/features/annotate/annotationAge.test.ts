import { describe, expect, it } from 'vitest';
import type { AnnotationChangeset } from '@shared/domain/annotate';
import { AGE_BUCKETS, ageBucket, recencyByChangeset } from './annotationAge';

const changeset = (changesetId: number, date: string): AnnotationChangeset => ({
  changesetId,
  owner: 'jane@example.com',
  date,
  branch: '/main',
  comment: '',
  isMerge: false,
});

describe('recencyByChangeset', () => {
  it('ranks changesets from oldest (0) to newest (1) by date, whatever their numbers', () => {
    const recency = recencyByChangeset([changeset(1, '2026-01-01T00:00:00Z'), changeset(7, '2026-09-01T00:00:00Z'), changeset(4, '2026-03-01T00:00:00Z')]);
    expect([recency.get(1), recency.get(4), recency.get(7)]).toEqual([0, 0.5, 1]);
  });

  it('treats a single changeset as the newest', () => {
    expect(recencyByChangeset([changeset(1, '2026-01-01T00:00:00Z')]).get(1)).toBe(1);
  });
});

describe('ageBucket', () => {
  it('splits recency into equal shades, the newest in the last', () => {
    expect([0, 0.19, 0.2, 0.5, 0.79, 0.8, 1].map(ageBucket)).toEqual([1, 1, 2, 3, 4, 5, AGE_BUCKETS]);
  });

  it('stays within the shades', () => {
    expect([ageBucket(-1), ageBucket(2)]).toEqual([1, AGE_BUCKETS]);
  });
});
