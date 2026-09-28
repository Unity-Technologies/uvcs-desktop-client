import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { expectedCheckinResult, releasedCheckoutsNote } from './checkinOutcome';

function change(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 1, lastModified: '' };
}

const unchanged = [change('a.txt', ['checkedOut']), change('b.txt', ['checkedOut'])];
const created = { kind: 'created', changesetId: 12, branch: '/main' } as const;

describe('expectedCheckinResult', () => {
  it('takes no changeset when every change was a checkout without edits: cm released them', () => {
    expect(expectedCheckinResult({ kind: 'noChanges' }, unchanged)).toEqual({ kind: 'noChanges' });
  });

  it('takes the changeset of a checkin mixing edits and checkouts without them', () => {
    expect(expectedCheckinResult(created, [...unchanged, change('c.txt', ['checkedOut', 'changed'])])).toEqual(created);
  });

  it('fails when changes with content went in and no changeset came out', () => {
    expect(() => expectedCheckinResult({ kind: 'noChanges' }, [...unchanged, change('c.txt', ['checkedOut', 'changed'])])).toThrow(
      'no changeset was created',
    );
    expect(() => expectedCheckinResult({ kind: 'noChanges' }, [change('new.txt', ['private'])])).toThrow();
  });
});

describe('releasedCheckoutsNote', () => {
  it('tells quietly what was released', () => {
    expect(releasedCheckoutsNote(4)).toEqual({ kind: 'info', title: 'Nothing to check in', detail: 'Released 4 checkouts without edits.' });
    expect(releasedCheckoutsNote(1).detail).toBe('Released 1 checkout without edits.');
  });
});
