import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { canAnnotateComparison, itemComparison } from './itemComparison';

const wk = '/wk';
const file = { itemType: 'file' as const, isPrivate: false, revisionId: 45 };
const change = (kinds: PendingChange['kinds']): PendingChange => ({ path: 'a.cs', kinds, itemType: 'file', size: 1, lastModified: '' });

describe('itemComparison', () => {
  it('compares a changed, checked out, moved or deleted file with its loaded revision', () => {
    for (const kinds of [['changed'], ['checkedOut'], ['moved', 'changed'], ['locallyDeleted']] as PendingChange['kinds'][]) {
      expect(itemComparison(file, change(kinds), wk)).toEqual({ kind: 'changes', workspacePath: wk, change: change(kinds) });
    }
  });

  it('shows an up-to-date file as its last change, as every file of a repository tree', () => {
    expect(itemComparison(file, undefined, wk)).toEqual({ kind: 'lastChange' });
    expect(itemComparison(file, undefined, null)).toEqual({ kind: 'lastChange' });
  });

  it('shows a file with no revision yet whole, as new', () => {
    expect(itemComparison({ ...file, revisionId: -1 }, change(['added']), wk)).toEqual({ kind: 'new', workspacePath: wk, reason: 'added', change: change(['added']) });
    expect(itemComparison({ ...file, isPrivate: true }, undefined, wk)).toEqual({ kind: 'new', workspacePath: wk, reason: 'private' });
    expect(itemComparison({ ...file, isPrivate: true }, change(['private']), wk)).toEqual({ kind: 'new', workspacePath: wk, reason: 'private' });
    expect(itemComparison({ ...file, isPrivate: true }, change(['ignored']), wk)).toEqual({ kind: 'new', workspacePath: wk, reason: 'ignored' });
  });

  it('compares a repository tree\'s files as revisions, whatever a workspace holds at their paths', () => {
    expect(itemComparison(file, change(['changed']), null)).toEqual({ kind: 'lastChange' });
    expect(itemComparison({ ...file, isPrivate: true, revisionId: -1 }, undefined, null)).toBeNull();
  });

  it('compares nothing for a folder', () => {
    expect(itemComparison({ ...file, itemType: 'directory' }, undefined, wk)).toBeNull();
  });
});

describe('canAnnotateComparison', () => {
  it('annotates what has revisions and is still on disk', () => {
    expect(canAnnotateComparison({ kind: 'lastChange' })).toBe(true);
    expect(canAnnotateComparison({ kind: 'changes', workspacePath: wk, change: change(['changed']) })).toBe(true);
    expect(canAnnotateComparison({ kind: 'changes', workspacePath: wk, change: change(['locallyDeleted']) })).toBe(false);
    expect(canAnnotateComparison({ kind: 'new', workspacePath: wk, reason: 'added' })).toBe(false);
    expect(canAnnotateComparison(null)).toBe(false);
  });
});
