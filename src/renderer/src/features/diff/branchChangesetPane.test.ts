import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { branchChangesetPane, changesetSpanSummary } from './branchChangesetPane';

const changeset = (id: number, owner = 'ana'): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment: '', owner, date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });
const newestFirst = [changeset(12), changeset(11), changeset(10)];

describe('branchChangesetPane', () => {
  it('shows nothing while the changesets are read', () => {
    expect(branchChangesetPane(undefined, [])).toEqual({ kind: 'reading' });
  });

  it('says the branch has none when it has none', () => {
    expect(branchChangesetPane([], [])).toEqual({ kind: 'noChangesets' });
  });

  it('shows the newest changeset until one is selected, never saying a branch with changesets has none', () => {
    expect(branchChangesetPane(newestFirst, [])).toEqual({ kind: 'changeset', changesetId: 12 });
  });

  it('shows the diff of the changeset selected', () => {
    expect(branchChangesetPane(newestFirst, [11])).toEqual({ kind: 'changeset', changesetId: 11 });
  });

  it('shows several changesets selected as one diff, from before the oldest to the newest', () => {
    expect(branchChangesetPane(newestFirst, [10, 11])).toEqual({
      kind: 'span',
      target: { kind: 'range', fromSpec: 'cs:9', toSpec: 'cs:11' },
      changesets: [newestFirst[1], newestFirst[2]],
    });
  });

  it('shows the whole span of changesets selected apart, whatever order they were picked in', () => {
    const branch = [changeset(15), changeset(14), changeset(13), changeset(12)];
    expect(branchChangesetPane(branch, [15, 12])).toEqual({ kind: 'span', target: { kind: 'range', fromSpec: 'cs:11', toSpec: 'cs:15' }, changesets: branch });
  });

  // The branch's first changeset's parent is where it started, on its parent branch: the span holds what the first did.
  it("diffs from where a span starting at the branch's first changeset started", () => {
    const first: Changeset = { ...changeset(40), parent: 7 };
    const pane = branchChangesetPane([changeset(41), first], [40, 41]);
    expect(pane.kind === 'span' && pane.target).toEqual({ kind: 'range', fromSpec: 'cs:7', toSpec: 'cs:41' });
  });

  it('shows the one changeset left on the branch of a selection the branch no longer holds whole', () => {
    expect(branchChangesetPane(newestFirst, [99, 11])).toEqual({ kind: 'changeset', changesetId: 11 });
  });
});

describe('changesetSpanSummary', () => {
  it('counts the span, names its ends, oldest first, and who checked it in', () => {
    expect(changesetSpanSummary([changeset(17, 'daniel'), changeset(16, 'daniel'), changeset(15, 'daniel')])).toEqual({
      count: '3 changesets',
      ends: 'cs:15 to cs:17',
      authors: 'Daniel',
    });
  });

  it('names every author once, as they first checked in', () => {
    expect(changesetSpanSummary([changeset(17, 'daniel'), changeset(16, 'ana.lopez@unity3d.com'), changeset(15, 'daniel')]).authors).toBe('Daniel and Ana Lopez');
    expect(changesetSpanSummary([changeset(18, 'rosa'), changeset(17, 'luis'), changeset(16, 'ana'), changeset(15, 'daniel')]).authors).toBe('Daniel, Ana and 2 others');
  });

  it('takes an author written two ways as one', () => {
    expect(changesetSpanSummary([changeset(16, 'Daniel'), changeset(15, 'daniel')]).authors).toBe('Daniel');
  });
});
