import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { canAnnotateComparison, itemComparison } from './itemComparison';

const file = { itemType: 'file' as const, isPrivate: false, revisionId: 45 };
const change = (kinds: PendingChange['kinds']): PendingChange => ({ path: 'a.cs', kinds, itemType: 'file', size: 1, lastModified: '' });

describe('itemComparison', () => {
  it('compares a changed, checked out, moved or deleted file with its loaded revision', () => {
    for (const kinds of [['changed'], ['checkedOut'], ['moved', 'changed'], ['locallyDeleted']] as PendingChange['kinds'][]) {
      expect(itemComparison(file, change(kinds), true)).toEqual({ kind: 'changes', change: change(kinds) });
    }
  });

  it('shows an up-to-date file as its last change, as every file of a repository tree', () => {
    expect(itemComparison(file, undefined, true)).toEqual({ kind: 'lastChange' });
    expect(itemComparison(file, undefined, false)).toEqual({ kind: 'lastChange' });
  });

  it('shows a file with no revision yet whole, as new', () => {
    expect(itemComparison({ ...file, revisionId: -1 }, change(['added']), true)).toEqual({ kind: 'new', reason: 'added', change: change(['added']) });
    expect(itemComparison({ ...file, isPrivate: true }, undefined, true)).toEqual({ kind: 'new', reason: 'private' });
    expect(itemComparison({ ...file, isPrivate: true }, change(['private']), true)).toEqual({ kind: 'new', reason: 'private' });
    expect(itemComparison({ ...file, isPrivate: true }, change(['ignored']), true)).toEqual({ kind: 'new', reason: 'ignored' });
  });

  it('compares nothing for a folder', () => {
    expect(itemComparison({ ...file, itemType: 'directory' }, undefined, true)).toBeNull();
  });
});

describe('canAnnotateComparison', () => {
  it('annotates what has revisions and is still on disk', () => {
    expect(canAnnotateComparison({ kind: 'lastChange' })).toBe(true);
    expect(canAnnotateComparison({ kind: 'changes', change: change(['changed']) })).toBe(true);
    expect(canAnnotateComparison({ kind: 'changes', change: change(['locallyDeleted']) })).toBe(false);
    expect(canAnnotateComparison({ kind: 'new', reason: 'added' })).toBe(false);
    expect(canAnnotateComparison(null)).toBe(false);
  });
});
