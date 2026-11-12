import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { branchDiffFocusFor, branchStartOfChangesets, initialBranchDiffFocus, showsChangesetList } from './branchDiffChangesets';

const changeset = (id: number): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment: '', owner: 'ana', date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });

const branch = [changeset(280536), changeset(280535), changeset(280532), changeset(280530)];

describe('showsChangesetList', () => {
  it('shows while the changesets are read, and when there are several', () => {
    expect(showsChangesetList(undefined)).toBe(true);
    expect(showsChangesetList(branch)).toBe(true);
  });

  it("doesn't show for a branch with one changeset, or none", () => {
    expect(showsChangesetList([branch[0]!])).toBe(false);
    expect(showsChangesetList([])).toBe(false);
  });
});

describe('branchStartOfChangesets', () => {
  it('is the oldest changeset and its parent, the list being the whole branch, newest first', () => {
    expect(branchStartOfChangesets('/main/task', branch)).toEqual({ firstChangeset: 280530, base: 280529 });
  });

  it("isn't known while the changesets are read, nor for a branch with none", () => {
    expect(branchStartOfChangesets('/main/task', undefined)).toBeNull();
    expect(branchStartOfChangesets('/main/task', [])).toBeNull();
  });

  // The list keeps the previous branch's changesets while the next branch's are read.
  it("isn't known from another branch's changesets", () => {
    expect(branchStartOfChangesets('/main/other', branch)).toBeNull();
  });
});

describe('initialBranchDiffFocus', () => {
  it("opens on all the branch's changes unless a changeset or a span is asked for", () => {
    expect(initialBranchDiffFocus(undefined, undefined)).toEqual({ kind: 'all' });
    expect(initialBranchDiffFocus(12, undefined)).toEqual({ kind: 'changeset', changesetId: 12 });
    expect(initialBranchDiffFocus(12, { oldest: 15, newest: 17 })).toEqual({ kind: 'span', span: { oldest: 15, newest: 17 } });
  });
});

describe('branchDiffFocusFor', () => {
  it("selects the changeset asked for, or all the branch's changes", () => {
    expect(branchDiffFocusFor({ changesetId: 5 })).toEqual({ kind: 'changeset', changesetId: 5 });
    expect(branchDiffFocusFor({ changesetId: null })).toEqual({ kind: 'all' });
  });

  it('selects the span asked for', () => {
    expect(branchDiffFocusFor({ changesets: { oldest: 15, newest: 17 } })).toEqual({ kind: 'span', span: { oldest: 15, newest: 17 } });
  });

  // Asked again for the same changeset (the user stepped elsewhere meanwhile), it selects it again.
  it('is a new focus each time it is asked', () => {
    expect(branchDiffFocusFor({ changesetId: 5 })).not.toBe(branchDiffFocusFor({ changesetId: 5 }));
  });

  it('leaves the selection as it is when the request names none, or there is none', () => {
    expect(branchDiffFocusFor({})).toBeNull();
    expect(branchDiffFocusFor(null)).toBeNull();
  });
});
