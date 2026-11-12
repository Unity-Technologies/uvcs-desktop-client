import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { formatDateTime } from '../../lib/formatDate';
import { changesetMark, newChangesetsOf, newChangesetsSpan, reviewedSeparator } from './branchChangesetRows';

const changeset = (id: number, comment = '', owner = 'ana'): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment, owner, date: `2026-11-${id}T10:00:00Z`, parent: id - 1, repository: 'game@local' });
const ids = (changesets: readonly Changeset[]): number[] => changesets.map((one) => one.id);

const branch = [changeset(17), changeset(16), changeset(15), changeset(14), changeset(13)];
const reviewedUpTo15 = { date: '2026-11-15T12:00:00Z', changesetId: 15 };
const now = Date.parse('2026-11-18T12:00:00Z');
const format = { locale: 'en-US', timeZone: 'UTC' };

describe('changesetMark', () => {
  it('marks nothing before the user reviewed', () => {
    expect(changesetMark(branch[0]!, undefined)).toBeNull();
  });

  it('marks what came after the changeset reviewed up to as new, and the rest as reviewed', () => {
    expect(branch.map((one) => changesetMark(one, reviewedUpTo15))).toEqual(['new', 'new', 'reviewed', 'reviewed', 'reviewed']);
  });

  // A status given before the branch's first changeset: every changeset came after it.
  it('marks every changeset new when the review was given before any of them', () => {
    expect(branch.map((one) => changesetMark(one, { date: '2026-11-01T10:00:00Z' }))).toEqual(['new', 'new', 'new', 'new', 'new']);
  });
});

describe('newChangesetsOf', () => {
  it('keeps the changesets new to the user, in the list order', () => {
    expect(ids(newChangesetsOf(branch, reviewedUpTo15))).toEqual([17, 16]);
  });

  it('keeps none before the user reviewed, or when nothing came since', () => {
    expect(newChangesetsOf(branch, undefined)).toEqual([]);
    expect(newChangesetsOf(branch, { date: '2026-11-20T10:00:00Z', changesetId: 17 })).toEqual([]);
  });
});

describe('reviewedSeparator', () => {
  // As the list shows them: oldest first.
  const listed = [...branch].reverse();

  it('goes between what was reviewed, above, and the first changeset new since, saying when', () => {
    expect(reviewedSeparator(listed, reviewedUpTo15, now, format)).toEqual({
      beforeKey: '16',
      label: 'Reviewed by you · Nov 15',
      tip: formatDateTime(reviewedUpTo15.date),
      showNew: { label: 'Show the 2 new', short: '2 new', span: { oldest: 16, newest: 17 } },
    });
  });

  it('offers the new changesets the filter leaves, a single one in words', () => {
    expect(reviewedSeparator([changeset(14), changeset(17)], reviewedUpTo15, now, format)?.showNew).toEqual({ label: 'Show the new one', short: '1 new', span: { oldest: 17, newest: 17 } });
  });

  it('goes before the first new one the filter leaves', () => {
    expect(reviewedSeparator([changeset(14), changeset(17)], reviewedUpTo15, now, format)?.beforeKey).toBe('17');
  });

  it("names the reviewer whose review it is when it isn't the user's own", () => {
    expect(reviewedSeparator(listed, { ...reviewedUpTo15, by: 'miryam.gomez@unity3d.com' }, now, format)?.label).toBe('Reviewed by Miryam Gomez · Nov 15');
  });

  it('is none before the user reviewed, or with nothing on one side of it', () => {
    expect(reviewedSeparator(listed, undefined, now, format)).toBeUndefined();
    expect(reviewedSeparator(listed.slice(0, 3), reviewedUpTo15, now, format)).toBeUndefined();
    expect(reviewedSeparator(listed.slice(3), reviewedUpTo15, now, format)).toBeUndefined();
    expect(reviewedSeparator(listed, { date: '2026-11-01T10:00:00Z' }, now, format)).toBeUndefined();
  });
});

describe('newChangesetsSpan', () => {
  const reviewedUpTo16 = { date: '2026-11-16T12:00:00Z', changesetId: 16 };

  it('spans the changesets checked in since the review, oldest to newest, in any order given', () => {
    expect(newChangesetsSpan(branch, { date: '2026-11-14T12:00:00Z', changesetId: 14 })).toEqual({ oldest: 15, newest: 17 });
    expect(newChangesetsSpan([...branch].reverse(), { date: '2026-11-14T12:00:00Z', changesetId: 14 })).toEqual({ oldest: 15, newest: 17 });
  });

  it('spans one changeset when only one came since', () => {
    expect(newChangesetsSpan(branch, reviewedUpTo16)).toEqual({ oldest: 17, newest: 17 });
  });

  it('spans the whole branch for a status given before its first changeset', () => {
    expect(newChangesetsSpan(branch, { date: '2026-11-01T12:00:00Z' })).toEqual({ oldest: 13, newest: 17 });
  });

  it('is none when nothing came since, before a review, or while the changesets are read', () => {
    expect(newChangesetsSpan(branch, { date: '2026-11-18T12:00:00Z', changesetId: 17 })).toBeUndefined();
    expect(newChangesetsSpan(branch, undefined)).toBeUndefined();
    expect(newChangesetsSpan(undefined, { date: '2026-11-01T12:00:00Z' })).toBeUndefined();
  });
});
