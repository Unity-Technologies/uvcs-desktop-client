import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import type { DiffEntry } from '@shared/domain/diff';
import { findUpdateBlockers, findUpdateConflicts, localChangesForUpdateOf } from '@shared/updateCollisions';
import { pendingChangesStatusOptions } from '../cm/pendingChangesStatusOptions';
import { change, pendingStatus, pendingStatusInChangelists } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { readPendingChanges } from '../workspace/readPendingChanges';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

/** Every filter on: Changes lists every kind of change `cm status` can print. */
const SHOW_EVERYTHING = { ...DEFAULT_SETTINGS.pendingChanges, showPrivate: true, showIgnored: true, showCloaked: true, showHiddenChanged: true, detectLocalMoves: true };

// The same workspace, as Changes' `cm status` prints it and as the update's (`--controlledchanged --changed`) does.
const CHANGES_STATUS = pendingStatusInChangelists(WORKSPACE, [
  {
    name: 'Default',
    changes: [
      change('CO', 'src/checkedout.cs'),
      change('CO+CH', 'src/edited.cs'),
      change('CH', 'src/changed.cs'),
      change('AD', 'src/added.cs'),
      change('DE', 'src/removed.cs'),
      change('MV', 'src/moved-to.cs', { oldPath: 'src/moved-from.cs' }),
      change('RP', 'src/replaced.cs'),
      change('LD', 'src/deleted-on-disk.cs'),
      change('LM', 'src/renamed-on-disk.cs', { oldPath: 'src/renamed-from.cs' }),
      change('PR', 'src/private.cs'),
      change('IG', 'src/ignored.cs'),
      change('CL', 'src/cloaked.cs'),
      change('HC', 'src/hidden.cs'),
    ],
  },
]);
const UPDATE_STATUS = pendingStatus(
  WORKSPACE,
  change('CO', 'src/checkedout.cs'),
  change('CO', 'src/edited.cs'),
  change('CH', 'src/changed.cs'),
  change('AD', 'src/added.cs'),
  change('DE', 'src/removed.cs'),
  change('MV', 'src/moved-to.cs', { oldPath: 'src/moved-from.cs' }),
  change('RP', 'src/replaced.cs'),
);

const incoming = (path: string, status: DiffEntry['status']): DiffEntry => ({ path, status, itemType: 'file', baseRevisionId: 10, revisionId: 20, repository: 'game@local' });

/** The branch changed, deleted or moved every path either list names. */
const BRANCH_TOUCHES_ALL: DiffEntry[] = [
  'src/checkedout.cs', 'src/edited.cs', 'src/changed.cs', 'src/replaced.cs', 'src/private.cs', 'src/ignored.cs', 'src/cloaked.cs', 'src/hidden.cs', 'src/renamed-on-disk.cs',
].map((path) => incoming(path, 'changed')).concat(
  ['src/removed.cs', 'src/moved-from.cs', 'src/deleted-on-disk.cs', 'src/renamed-from.cs', 'src/added.cs'].map((path) => incoming(path, 'deleted')),
);

describe("the local changes an update collides with, out of Changes' pending changes", () => {
  it("are those the update's own status finds, whatever Changes' filter shows: the same conflicts and the same blocked files", async () => {
    const { cm } = fakeCmClient({ 'status --iscochanged': CHANGES_STATUS, 'status --controlledchanged': UPDATE_STATUS });
    const changes = await readPendingChanges(cm, WORKSPACE, pendingChangesStatusOptions(SHOW_EVERYTHING));
    const { changes: update } = await readPendingChanges(cm, WORKSPACE, ['--controlledchanged', '--changed']);

    const fromChanges = localChangesForUpdateOf(changes);

    expect(fromChanges.map((item) => item.path).sort()).toEqual(update.map((item) => item.path).sort());
    expect(findUpdateConflicts(BRANCH_TOUCHES_ALL, fromChanges)).toEqual(findUpdateConflicts(BRANCH_TOUCHES_ALL, update));
    expect(findUpdateBlockers(BRANCH_TOUCHES_ALL, fromChanges).sort()).toEqual(findUpdateBlockers(BRANCH_TOUCHES_ALL, update).sort());
  });

  it('leave out what only shows on disk: a file deleted or moved without cm, private, ignored, cloaked or hidden', async () => {
    const { cm } = fakeCmClient({ 'status --iscochanged': CHANGES_STATUS });
    const changes = await readPendingChanges(cm, WORKSPACE, pendingChangesStatusOptions(SHOW_EVERYTHING));

    const paths = localChangesForUpdateOf(changes).map((item) => item.path);

    for (const path of ['src/deleted-on-disk.cs', 'src/renamed-on-disk.cs', 'src/private.cs', 'src/ignored.cs', 'src/cloaked.cs', 'src/hidden.cs']) expect(paths).not.toContain(path);
  });
});
