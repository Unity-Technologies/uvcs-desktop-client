import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { changeDiffSources } from './changeDiffSources';

const change = (kinds: PendingChange['kinds']): PendingChange => ({ path: 'src/a.ts', kinds, itemType: 'file', size: 1, lastModified: '' });
const onDisk = { kind: 'workspaceFile', path: 'src/a.ts' };
const loaded = { kind: 'workspaceBase', path: 'src/a.ts' };
const nothing = { kind: 'empty' };

describe('changeDiffSources', () => {
  it('compares the loaded revision with the file on disk for an edit or a move', () => {
    expect(changeDiffSources(change(['checkedOut', 'changed']))).toEqual({ original: loaded, modified: onDisk });
    expect(changeDiffSources(change(['moved', 'changed']))).toEqual({ original: loaded, modified: onDisk });
  });

  it('shows a file with no revision yet as all new', () => {
    for (const kinds of [['added'], ['private'], ['ignored'], ['cloaked']] as PendingChange['kinds'][]) {
      expect(changeDiffSources(change(kinds))).toEqual({ original: nothing, modified: onDisk });
    }
  });

  it('shows a deleted file as all gone, reading nothing from disk', () => {
    expect(changeDiffSources(change(['deleted']))).toEqual({ original: loaded, modified: nothing });
    expect(changeDiffSources(change(['locallyDeleted']))).toEqual({ original: loaded, modified: nothing });
  });
});
