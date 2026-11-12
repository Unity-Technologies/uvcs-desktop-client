import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { formatDateTime } from '../../lib/formatDate';
import { changesetMark, changesetRowTip, newChangesetsOf, newToggleTip, reviewedSeparator } from './branchChangesetRows';

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
  it('goes above the first reviewed changeset shown, saying when', () => {
    expect(reviewedSeparator(branch, reviewedUpTo15, now, format)).toEqual({ beforeKey: '15', label: 'Reviewed by you · Nov 15', tip: formatDateTime(reviewedUpTo15.date) });
  });

  it('goes above the first reviewed one the filter leaves', () => {
    expect(reviewedSeparator([branch[0]!, branch[3]!], reviewedUpTo15, now, format)?.beforeKey).toBe('14');
  });

  it('goes on top when every changeset shown is reviewed', () => {
    expect(reviewedSeparator(branch.slice(2), reviewedUpTo15, now, format)?.beforeKey).toBe('15');
  });

  it("names the reviewer whose review it is when it isn't the user's own", () => {
    expect(reviewedSeparator(branch, { ...reviewedUpTo15, by: 'miryam.gomez@unity3d.com' }, now, format)?.label).toBe('Reviewed by Miryam Gomez · Nov 15');
  });

  it('is none before the user reviewed, or when no reviewed changeset shows', () => {
    expect(reviewedSeparator(branch, undefined, now, format)).toBeUndefined();
    expect(reviewedSeparator(branch.slice(0, 2), reviewedUpTo15, now, format)).toBeUndefined();
    expect(reviewedSeparator(branch, { date: '2026-11-01T10:00:00Z' }, now, format)).toBeUndefined();
  });

  it('names the year of a review from another year', () => {
    expect(reviewedSeparator(branch, { date: '2025-11-15T12:00:00Z', changesetId: 15 }, now, format)?.label).toBe('Reviewed by you · Nov 15, 2025');
  });
});

describe('changesetRowTip', () => {
  it("is the comment's first line, then who, when and which changeset", () => {
    expect(changesetRowTip(changeset(17, 'Fix the jump\n\nIt was too high', 'daniel.garcia@unity3d.com'))).toEqual({
      text: 'Fix the jump',
      sub: `Daniel Garcia · ${formatDateTime('2026-11-17T10:00:00Z')} · cs:17`,
    });
  });

  it('says there is no comment when there is none', () => {
    expect(changesetRowTip(changeset(17, '  ')).text).toBe('No comment');
  });
});

describe('newToggleTip', () => {
  it('says since whose last review the New toggle keeps changesets', () => {
    expect(newToggleTip({})).toBe('Only the changesets new since your last review');
    expect(newToggleTip({ by: 'miryam.gomez@unity3d.com' })).toBe("Only the changesets new since Miryam Gomez's last review");
  });
});
