// `localChangesForUpdateOf` lives in shared/, but this test lives in main: it reads both statuses with main's own reader
// (`readPendingChanges`), which merges codes and lists each item as Changes shows it (`listedCodes`), so the update's
// local changes are compared with Changes' as the app reads them, not as a test would write them.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { PendingChangesFilter } from '@shared/domain/pendingChanges';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { findUpdateBlockers, findUpdateConflicts, localChangesForUpdateOf } from '@shared/updateCollisions';
import { pendingChangesStatusOptions } from '../cm/pendingChangesStatusOptions';
import { change, pendingStatus, pendingStatusInChangelists, type StatusChange } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { readPendingChanges } from '../workspace/readPendingChanges';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

/** Every filter on: Changes lists every kind of change `cm status` can print. */
const SHOW_EVERYTHING: PendingChangesFilter = {
  ...DEFAULT_SETTINGS.pendingChanges,
  showPrivate: true,
  showIgnored: true,
  showCloaked: true,
  showHiddenChanged: true,
  detectLocalMoves: true,
};
/** Every filter off: only what Changes always asks for (controlled changes, changes, local deletes). */
const SHOW_LEAST: PendingChangesFilter = { ...SHOW_EVERYTHING, showPrivate: false, showIgnored: false, showCloaked: false, showHiddenChanged: false, detectLocalMoves: false };

/** Changes printed the same by all three statuses. */
const ALWAYS: StatusChange[] = [
  change('CO', 'src/checkedout.cs'),
  change('CH', 'src/changed.cs'),
  change('AD', 'src/added.cs'),
  change('DE', 'src/removed.cs'),
  change('MV', 'src/moved-to.cs', { oldPath: 'src/moved-from.cs' }),
  change('RP', 'src/replaced.cs'),
  change('CO+RP', 'src/checkedout-replaced.cs'),
  change('CH+MV', 'src/moved-edited-to.cs', { oldPath: 'src/moved-edited-from.cs' }),
  change('CO+HC', 'src/checkedout-hidden.cs'),
];

/** Changes' status with every filter on: each kind as `cm` marks it, codes joined as it joins them. */
const CHANGES_SHOWING_EVERYTHING = pendingStatusInChangelists(WORKSPACE, [
  {
    name: 'Default',
    changes: [
      ...ALWAYS,
      change('CO+CH', 'src/edited.cs'),
      change('CO+CH+CL', 'src/cloaked-edited.cs'),
      change('CH+CL', 'src/cloaked-changed.cs'),
      change('CH+HC', 'src/hidden.cs'),
      change('LD', 'src/deleted-on-disk.cs'),
      change('LM', 'src/renamed-on-disk.cs', { oldPath: 'src/renamed-from.cs' }),
      change('CH+LM', 'src/renamed-edited.cs', { oldPath: 'src/renamed-edited-from.cs' }),
      change('CO+LM', 'src/checkout-renamed.cs', { oldPath: 'src/checkout-renamed-from.cs' }),
      change('PR', 'src/private.cs'),
      change('IG', 'src/ignored.cs'),
    ],
  },
]);

/** Changes' status with every filter off: no local moves (each is deleted where it was), no private, ignored or hidden. */
const CHANGES_SHOWING_LEAST = pendingStatusInChangelists(WORKSPACE, [
  {
    name: 'Default',
    changes: [
      ...ALWAYS,
      change('CO+CH', 'src/edited.cs'),
      change('CO+CH', 'src/cloaked-edited.cs'),
      change('CH', 'src/cloaked-changed.cs'),
      change('LD', 'src/deleted-on-disk.cs'),
      change('LD', 'src/renamed-from.cs'),
      change('LD', 'src/renamed-edited-from.cs'),
    ],
  },
]);

/** The update's own status (`--controlledchanged --changed`): no `--iscochanged`, so an edited checkout is a checkout. */
const UPDATE_STATUS = pendingStatus(
  WORKSPACE,
  ...ALWAYS,
  change('CO', 'src/edited.cs'),
  change('CO', 'src/cloaked-edited.cs'),
  change('CH', 'src/cloaked-changed.cs'),
);
/** With local moves on, the update's status also prints the checkout moved on disk, where the workspace has it. */
const UPDATE_STATUS_WITH_MOVED_CHECKOUT = pendingStatus(WORKSPACE, ...ALWAYS, change('CO', 'src/edited.cs'), change('CO', 'src/cloaked-edited.cs'), change('CH', 'src/cloaked-changed.cs'), change('CO', 'src/checkout-renamed-from.cs'));

const incoming = (path: string, status: DiffEntry['status']): DiffEntry => ({ path, status, itemType: 'file', baseRevisionId: 10, revisionId: 20, repository: 'game@local' });

/** Every path either list names, as the branch changed it, and as it deleted it. */
function branchTouching(paths: string[]): DiffEntry[][] {
  return [paths.map((path) => incoming(path, 'changed')), paths.map((path) => incoming(path, 'deleted'))];
}

async function compare(changesStatus: string, filter: PendingChangesFilter, updateStatus: string) {
  const { cm } = fakeCmClient({ 'status --iscochanged': changesStatus, 'status --controlledchanged': updateStatus });
  const changes = await readPendingChanges(cm, WORKSPACE, pendingChangesStatusOptions(filter));
  const { changes: update } = await readPendingChanges(cm, WORKSPACE, ['--controlledchanged', '--changed']);
  return { fromChanges: localChangesForUpdateOf(changes), update, everyPath: [...changes.changes, ...update].flatMap((item) => [item.path, ...(item.oldPath ? [item.oldPath] : [])]) };
}

describe("the local changes an update collides with, out of Changes' pending changes", () => {
  it.each([
    ['every filter on', CHANGES_SHOWING_EVERYTHING, SHOW_EVERYTHING, UPDATE_STATUS_WITH_MOVED_CHECKOUT],
    ['every filter off', CHANGES_SHOWING_LEAST, SHOW_LEAST, UPDATE_STATUS],
  ])("are those the update's own status finds with %s: the same conflicts and the same blocked files", async (_, changesStatus, filter, updateStatus) => {
    const { fromChanges, update, everyPath } = await compare(changesStatus, filter, updateStatus);

    expect(fromChanges.map((item) => item.path).sort()).toEqual(update.map((item) => item.path).sort());
    for (const branch of branchTouching(everyPath)) {
      expect(findUpdateConflicts(branch, fromChanges)).toEqual(findUpdateConflicts(branch, update));
      expect(findUpdateBlockers(branch, fromChanges).sort()).toEqual(findUpdateBlockers(branch, update).sort());
    }
  });

  it('keep a cloaked file checked out or changed, whatever the filter: the mark only says the update skips it', async () => {
    for (const [status, filter] of [[CHANGES_SHOWING_EVERYTHING, SHOW_EVERYTHING], [CHANGES_SHOWING_LEAST, SHOW_LEAST]] as const) {
      const { fromChanges } = await compare(status, filter, UPDATE_STATUS);
      expect(fromChanges.map((item) => item.path)).toEqual(expect.arrayContaining(['src/cloaked-edited.cs', 'src/cloaked-changed.cs']));
    }
  });

  it('take a checkout moved on disk as checked out where the workspace has it, and leave out anything else moved on disk', async () => {
    const { fromChanges } = await compare(CHANGES_SHOWING_EVERYTHING, SHOW_EVERYTHING, UPDATE_STATUS_WITH_MOVED_CHECKOUT);

    expect(fromChanges.find((item) => item.path === 'src/checkout-renamed-from.cs')).toMatchObject({ kinds: ['checkedOut'] });
    expect(fromChanges.map((item) => item.path)).not.toContain('src/checkout-renamed.cs');
    expect(fromChanges.map((item) => item.path)).not.toContain('src/renamed-edited.cs');
  });

  it("miss a checkout deleted on disk: Changes lists it only as deleted, where the update's status still prints the checkout", async () => {
    const deletedCheckout = pendingStatusInChangelists(WORKSPACE, [{ name: 'Default', changes: [change('LD+CO', 'src/gone.cs')] }]);
    const { fromChanges, update } = await compare(deletedCheckout, SHOW_LEAST, pendingStatus(WORKSPACE, change('CO', 'src/gone.cs')));

    expect(update.map((item) => item.path)).toEqual(['src/gone.cs']);
    expect(fromChanges).toEqual([]);
  });
});
