import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { deletedItemRestores, restoreMenuEntries } from './restoreMenuEntries';

const repository = 'game@local';
const deleted = (path: string, itemType: DiffEntry['itemType'] = 'file', baseRevisionId = 18): DiffEntry => ({ status: 'deleted', path, itemType, baseRevisionId, revisionId: -1, repository });
const changed: DiffEntry = { status: 'changed', path: 'src/Game.cs', itemType: 'file', baseRevisionId: 10, revisionId: 30, repository };

const words = (entries: DiffEntry[], workspaceRepository: string | undefined = repository, diffEntries: DiffEntry[] = entries) =>
  restoreMenuEntries('/ws', entries, diffEntries, workspaceRepository).map((entry) => `${entry.id} | ${entry.label}`);

describe('deletedItemRestores', () => {
  it('brings each deleted item back where it was, from the revision its deletion removed', () => {
    expect(deletedItemRestores([deleted('src/Enemy.cs'), deleted('docs', 'directory', 24)], [deleted('src/Enemy.cs'), deleted('docs', 'directory', 24)], repository)).toEqual([
      { revision: { revisionId: 18, repository }, path: 'src/Enemy.cs' },
      { revision: { revisionId: 24, repository }, path: 'docs' },
    ]);
  });

  it('restores nothing unless every item was deleted: a selection mixing changes has nothing to restore as a whole', () => {
    expect(deletedItemRestores([deleted('src/Enemy.cs'), changed], [deleted('src/Enemy.cs'), changed], repository)).toBeNull();
    expect(deletedItemRestores([], [], repository)).toBeNull();
  });

  it("restores only items of the workspace's own repository: an xlinked one's, or before the workspace is known, never", () => {
    expect(deletedItemRestores([{ ...deleted('lib/a.cs'), repository: 'thirdparty@local' }], [{ ...deleted('lib/a.cs'), repository: 'thirdparty@local' }], repository)).toBeNull();
    expect(deletedItemRestores([deleted('src/Enemy.cs')], [deleted('src/Enemy.cs')], undefined)).toBeNull();
  });

  it('restores no deleted xlink, which cm undelete refuses', () => {
    expect(deletedItemRestores([deleted('lib', 'xlink', 30)], [deleted('lib', 'xlink', 30)], repository)).toBeNull();
  });

  it('brings a file of a deleted folder back with its folder, which must come back first', () => {
    const docs = deleted('docs', 'directory', 24);
    const guide = deleted('docs/guide.md', 'file', 14);
    const logo = deleted('docs/images/logo.svg', 'file', 15);
    const diff = [docs, deleted('docs/images', 'directory', 33), guide, logo, deleted('src/Enemy.cs')];
    expect(deletedItemRestores([guide], diff, repository)).toEqual([{ revision: { revisionId: 24, repository }, path: 'docs' }]);
    // The folder's row of a tree selects every file under it: one restore of the folder.
    expect(deletedItemRestores([guide, logo, deleted('src/Enemy.cs')], diff, repository)).toEqual([
      { revision: { revisionId: 24, repository }, path: 'docs' },
      { revision: { revisionId: 18, repository }, path: 'src/Enemy.cs' },
    ]);
  });

  it('needs the revision the deletion removed', () => {
    expect(deletedItemRestores([deleted('src/Enemy.cs', 'file', -1)], [deleted('src/Enemy.cs', 'file', -1)], repository)).toBeNull();
  });
});

describe('restoreMenuEntries', () => {
  it('offers a deleted file back where it was, or anywhere else', () => {
    expect(words([deleted('src/Enemy.cs')])).toEqual(['restore | Restore file', 'restoreTo | Restore to…']);
  });

  it('names a folder, which comes back with everything it held', () => {
    expect(words([deleted('docs', 'directory', 24)])).toEqual(['restore | Restore folder', 'restoreTo | Restore to…']);
  });

  it('names the deleted folder a file comes back with', () => {
    const guide = deleted('docs/guide.md', 'file', 14);
    expect(words([guide], repository, [deleted('docs', 'directory', 24), guide])).toEqual(['restore | Restore folder docs', 'restoreTo | Restore to…']);
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
