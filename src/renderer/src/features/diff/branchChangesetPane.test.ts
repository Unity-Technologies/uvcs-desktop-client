import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { branchChangesetPane } from './branchChangesetPane';

const changeset = (id: number): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment: '', owner: 'ana', date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });
const newestFirst = [changeset(12), changeset(11), changeset(10)];

describe('branchChangesetPane', () => {
  it('shows nothing while the changesets are read', () => {
    expect(branchChangesetPane(undefined, null)).toEqual({ kind: 'reading' });
  });

  it('says the branch has none when it has none', () => {
    expect(branchChangesetPane([], null)).toEqual({ kind: 'noChangesets' });
  });

  it('shows the newest changeset until one is selected, never saying a branch with changesets has none', () => {
    expect(branchChangesetPane(newestFirst, null)).toEqual({ kind: 'changeset', changesetId: 12 });
  });

  it('shows the diff of the changeset selected', () => {
    expect(branchChangesetPane(newestFirst, 11)).toEqual({ kind: 'changeset', changesetId: 11 });
  });
});
