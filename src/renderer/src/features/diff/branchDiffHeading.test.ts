import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { branchDiffHeading } from './branchDiffHeading';

const changeset = (id: number): Changeset => ({ id, guid: `guid-${id}`, branch: '/main/task', comment: '', owner: 'ana', date: '2026-10-01T10:00:00Z', parent: id - 1, repository: 'game@local' });

describe('branchDiffHeading', () => {
  it('names all the changes while the All changes row is selected', () => {
    expect(branchDiffHeading({ kind: 'all' })).toBe('All changes on');
  });

  it('names the changeset selected, by its number', () => {
    expect(branchDiffHeading({ kind: 'changeset', changesetId: 1234 })).toBe('Changes in cs:1234 on');
  });

  it('names the ends of several changesets selected, oldest first', () => {
    const span = [changeset(17), changeset(16), changeset(15)];
    const choice = { kind: 'span', target: { kind: 'range', fromSpec: 'cs:14', toSpec: 'cs:17' }, changesets: span } as const;
    expect(branchDiffHeading(choice)).toBe('Changes in cs:15 to cs:17 on');
  });

  // A span asked for (a review's new changesets) waits for the list that tells where it starts.
  it("doesn't claim all the changes while the changesets asked for are read", () => {
    expect(branchDiffHeading({ kind: 'reading' })).toBe('Changes on');
  });
});
