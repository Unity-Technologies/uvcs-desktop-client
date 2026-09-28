import { describe, expect, it } from 'vitest';
import type { PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import { pendingChangesetKey, pendingChangesetOf } from './pendingChangeset';

function snapshot(kinds: PendingChange['kinds'][], mergeLinks: PendingChangesSnapshot['mergeLinks'] = []): PendingChangesSnapshot {
  const changes = kinds.map((kind, index) => ({ path: `f${index}`, kinds: kind, itemType: 'file' as const, size: 1, lastModified: '' }));
  return { changes, changelists: [], loadedChangeset: 12, mergeLinks };
}

describe('pendingChangesetOf', () => {
  it('draws the changes under version control as a child of the loaded changeset, with the merges in progress', () => {
    const links = [{ type: 'merge' as const, sourceChangeset: 242 }];
    expect(pendingChangesetOf(snapshot([['checkedOut', 'changed'], ['private']], links), 243, '/main/task')).toEqual({
      branch: '/main/task',
      parent: 243,
      mergeLinks: links,
    });
  });

  it('draws nothing for private files alone, no changes, or before the workspace is known', () => {
    expect(pendingChangesetOf(snapshot([['private'], ['ignored']]), 12, '/main')).toBeNull();
    expect(pendingChangesetOf(snapshot([]), 12, '/main')).toBeNull();
    expect(pendingChangesetOf(undefined, 12, '/main')).toBeNull();
    expect(pendingChangesetOf(snapshot([['changed']]), null, '/main')).toBeNull();
    expect(pendingChangesetOf(snapshot([['changed']]), 12, null)).toBeNull();
  });
});

describe('pendingChangesetKey', () => {
  it('is the same for the same pending changeset read again', () => {
    const read = (): ReturnType<typeof pendingChangesetOf> => pendingChangesetOf(snapshot([['changed']], [{ type: 'merge', sourceChangeset: 3 }]), 12, '/main');
    expect(pendingChangesetKey(read())).toBe(pendingChangesetKey(read()));
    expect(pendingChangesetKey(read())).not.toBe(pendingChangesetKey(pendingChangesetOf(snapshot([['changed']]), 12, '/main')));
    expect(pendingChangesetKey(null)).toBe('');
  });
});
