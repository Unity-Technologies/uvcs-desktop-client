import { describe, expect, it } from 'vitest';
import type { ItemRevision } from '@shared/domain/history';
import { comparedRevisions } from './comparedRevisions';

const revision = (changesetId: number, parentRevisionId: number): ItemRevision => ({ changesetId, revisionId: changesetId * 10, parentRevisionId }) as ItemRevision;

// Newest first; cs:9 was made from cs:3 on another branch than cs:7's; cs:3 added the file.
const cs9 = revision(9, 30);
const cs7 = revision(7, 30);
const cs3 = revision(3, -1);
const revisions = [cs9, cs7, cs3];
const changesets = (pair: (ItemRevision | undefined)[]) => pair.map((compared) => compared?.changesetId);

describe('comparedRevisions', () => {
  it('compares one revision with the one it was made from', () => {
    expect(changesets(comparedRevisions(revisions, [cs9]))).toEqual([9, 3]);
  });

  it('shows the revision that added the file alone', () => {
    expect(changesets(comparedRevisions(revisions, [cs3]))).toEqual([3, undefined]);
  });

  it('compares two selected revisions with each other, newer first, however they were selected', () => {
    expect(changesets(comparedRevisions(revisions, [cs3, cs9]))).toEqual([9, 3]);
    expect(changesets(comparedRevisions(revisions, [cs7, cs3, cs9]))).toEqual([9, 7]);
  });

  it('compares nothing with nothing selected', () => {
    expect(comparedRevisions(revisions, [])).toEqual([undefined, undefined]);
  });
});
