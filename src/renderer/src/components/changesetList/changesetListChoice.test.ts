import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { changesetListChoice, changesetSpanSummary } from './changesetListChoice';

const changeset = (id: number, owner = 'ana'): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment: '', owner, date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });
const newestFirst = [changeset(12), changeset(11), changeset(10)];

describe('changesetListChoice', () => {
  it('shows every changeset combined for the combined row, read or not', () => {
    expect(changesetListChoice(newestFirst, [])).toEqual({ kind: 'all' });
    expect(changesetListChoice(undefined, [])).toEqual({ kind: 'all' });
  });

  it('shows the diff of the changeset selected', () => {
    expect(changesetListChoice(newestFirst, [11])).toEqual({ kind: 'changeset', changesetId: 11 });
  });

  // A review going to a comment opens on its changeset before the branch's changesets are read.
  it('shows a changeset asked for while the changesets are read', () => {
    expect(changesetListChoice(undefined, [11])).toEqual({ kind: 'changeset', changesetId: 11 });
  });

  it('waits for the changesets to tell where a span starts', () => {
    expect(changesetListChoice(undefined, [10, 12])).toEqual({ kind: 'reading' });
  });

  it('shows several changesets selected as one diff, from before the oldest to the newest', () => {
    expect(changesetListChoice(newestFirst, [10, 11])).toEqual({
      kind: 'span',
      target: { kind: 'range', fromSpec: 'cs:9', toSpec: 'cs:11' },
      changesets: [newestFirst[1], newestFirst[2]],
    });
  });

  it('shows the whole span of changesets selected apart, whatever order they were picked in', () => {
    const branch = [changeset(15), changeset(14), changeset(13), changeset(12)];
    expect(changesetListChoice(branch, [15, 12])).toEqual({ kind: 'span', target: { kind: 'range', fromSpec: 'cs:11', toSpec: 'cs:15' }, changesets: branch });
  });

  // The branch's first changeset's parent is where it started, on its parent branch: the span holds what the first did.
  it("diffs from where a span starting at the branch's first changeset started", () => {
    const first: Changeset = { ...changeset(40), parent: 7 };
    const choice = changesetListChoice([changeset(41), first], [40, 41]);
    expect(choice.kind === 'span' && choice.target).toEqual({ kind: 'range', fromSpec: 'cs:7', toSpec: 'cs:41' });
  });

  it('shows the one changeset left of a selection the list no longer holds whole', () => {
    expect(changesetListChoice(newestFirst, [99, 11])).toEqual({ kind: 'changeset', changesetId: 11 });
  });

  // The list still holds another branch's changesets while the branch's own are read (`placeholderData`).
  it('shows a changeset the list doesn\'t hold by its number, and everything for a span it can\'t place', () => {
    expect(changesetListChoice(newestFirst, [99])).toEqual({ kind: 'changeset', changesetId: 99 });
    expect(changesetListChoice(newestFirst, [98, 99])).toEqual({ kind: 'all' });
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
