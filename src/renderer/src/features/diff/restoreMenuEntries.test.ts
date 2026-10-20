import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { deletedItemRestores, restoreMenuEntries } from './restoreMenuEntries';

const repository = 'game@local';
const deleted = (path: string, itemType: DiffEntry['itemType'] = 'file', baseRevisionId = 18): DiffEntry => ({ status: 'deleted', path, itemType, baseRevisionId, revisionId: -1, repository });
const changed: DiffEntry = { status: 'changed', path: 'src/Game.cs', itemType: 'file', baseRevisionId: 10, revisionId: 30, repository };

const words = (entries: DiffEntry[], workspaceRepository: string | undefined = repository) =>
  restoreMenuEntries('/ws', entries, workspaceRepository).map((entry) => `${entry.id} | ${entry.label}`);

describe('deletedItemRestores', () => {
  it('brings each deleted item back where it was, from the revision its deletion removed', () => {
    expect(deletedItemRestores([deleted('src/Enemy.cs'), deleted('docs', 'directory', 24)], repository)).toEqual([
      { revision: { revisionId: 18, repository }, path: 'src/Enemy.cs' },
      { revision: { revisionId: 24, repository }, path: 'docs' },
    ]);
  });

  it('restores nothing unless every item was deleted: a selection mixing changes has nothing to restore as a whole', () => {
    expect(deletedItemRestores([deleted('src/Enemy.cs'), changed], repository)).toBeNull();
    expect(deletedItemRestores([], repository)).toBeNull();
  });

  it("restores only items of the workspace's own repository: an xlinked one's, or before the workspace is known, never", () => {
    expect(deletedItemRestores([{ ...deleted('lib/a.cs'), repository: 'thirdparty@local' }], repository)).toBeNull();
    expect(deletedItemRestores([deleted('src/Enemy.cs')], undefined)).toBeNull();
  });

  it('restores no deleted xlink, which cm undelete refuses', () => {
    expect(deletedItemRestores([deleted('lib', 'xlink', 30)], repository)).toBeNull();
  });

  it('needs the revision the deletion removed', () => {
    expect(deletedItemRestores([deleted('src/Enemy.cs', 'file', -1)], repository)).toBeNull();
  });
});

describe('restoreMenuEntries', () => {
  it('offers a deleted file back where it was, or anywhere else', () => {
    expect(words([deleted('src/Enemy.cs')])).toEqual(['restore | Restore file', 'restoreTo | Restore to…']);
  });

  it('names a folder, which comes back with everything it held', () => {
    expect(words([deleted('docs', 'directory', 24)])).toEqual(['restore | Restore folder', 'restoreTo | Restore to…']);
  });

  it('restores several items where they were, each to its own place', () => {
    expect(words([deleted('src/Enemy.cs'), deleted('docs', 'directory', 24)])).toEqual(['restore | Restore 2 items']);
  });

  it('offers nothing for what else a diff lists, nor for what it can’t restore', () => {
    expect(words([changed])).toEqual([]);
    expect(words([deleted('src/Enemy.cs'), changed])).toEqual([]);
    expect(words([{ ...deleted('lib/a.cs'), repository: 'thirdparty@local' }])).toEqual([]);
  });
});
