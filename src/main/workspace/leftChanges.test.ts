import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { branchFound, shelvesFound, statusHeader, WORKSPACE_GUID, WORKSPACE_NAMES } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { recordingContext } from '../operations/testing/recordingContext';
import { memorySettings } from '../settings/testing/memorySettings';
import { LeftChangesFinder } from './leftChanges';
import { SwitchShelveRecords } from './switchShelveRecords';
import { applyShelveCleanly } from './applyShelveCleanly';
import { detachReplacedFiles } from './detachReplacedFiles';
import { deleteShelves } from './verifiedShelve';

vi.mock('./applyShelveCleanly', () => ({ applyShelveCleanly: vi.fn() }));
vi.mock('./detachReplacedFiles', () => ({ detachReplacedFiles: vi.fn(async () => {}) }));
vi.mock('./verifiedShelve', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./verifiedShelve')>()),
  deleteShelves: vi.fn(async () => {}),
}));

const LEFT_ON_TASK1 = 'Automatic shelve created during switch operation (from br:37)';

/** A `cm` on /main/task1 whose server holds `shelves`. */
function fakeCm(shelves: string) {
  return fakeCmClient({
    'status --header --xml': statusHeader('/main/task1'),
    getworkspacefrompath: WORKSPACE_NAMES,
    'find shelve': shelves,
    'find branch': branchFound('/main/task1', 37),
    diff: '',
  });
}

function recordsOf(records: SwitchShelveRecord[]): SwitchShelveRecords {
  return new SwitchShelveRecords(memorySettings({ switchShelves: records }));
}

const ownRecord = (shelveId: number, sourceSpec: string): SwitchShelveRecord => ({
  workspaceGuid: WORKSPACE_GUID,
  shelveId,
  repository: 'eco@local',
  source: { spec: sourceSpec, name: sourceSpec.slice(3), objectRef: 'br:37' },
  target: { spec: 'br:/main', name: '/main' },
  mode: 'leave',
  createdAt: '2026-09-25T21:17:30.000Z',
  paths: ['src/file4.txt'],
  changelists: [],
});

const shelvedAway = (shelveId: number): SwitchShelveRecord => ({ ...ownRecord(shelveId, 'br:/main/task1'), reason: 'shelve' });

const { context } = recordingContext();

describe('LeftChangesFinder', () => {
  it("doesn't look the branch up when no automatic shelve could have been left by another client", async () => {
    const { cm, lines } = fakeCm(shelvesFound({ id: 2, comment: LEFT_ON_TASK1 }));
    const finder = new LeftChangesFinder(cm, recordsOf([ownRecord(2, 'br:/main/task1')]));

    expect(await finder.find('/work')).toEqual([expect.objectContaining({ shelveId: 2, foreign: false })]);
    expect(lines().some((command) => command.startsWith('find branch'))).toBe(false);
  });

  it('finds the changes another client left on the branch by its object id', async () => {
    const { cm, lines } = fakeCm(shelvesFound({ id: 2, comment: LEFT_ON_TASK1 }, { id: 3, comment: 'Automatic shelve created during switch operation (from br:4)' }));
    const finder = new LeftChangesFinder(cm, recordsOf([]));

    expect(await finder.find('/work')).toEqual([expect.objectContaining({ shelveId: 2, foreign: true })]);
    expect(lines()).toContain("find branch where name = 'task1' --xml --nototal");
  });

  it('offers changes still waiting to be brought elsewhere as left here, once the workspace is back where they were made', async () => {
    const { cm } = fakeCm(shelvesFound({ id: 2, comment: LEFT_ON_TASK1 }));
    const bringing: SwitchShelveRecord = { ...ownRecord(2, 'br:/main/task1'), mode: 'bring' };

    expect(await new LeftChangesFinder(cm, recordsOf([bringing])).find('/work')).toEqual([
      expect.objectContaining({ shelveId: 2, mode: 'leave', sourceName: '/main/task1', targetName: '/main' }),
    ]);
    expect(await new LeftChangesFinder(cm, recordsOf([bringing])).hasOwnWaiting('/work')).toBe(true);
  });

  it("tells whether this app left changes on what the workspace is on, without asking the server", async () => {
    const { cm, lines } = fakeCm(shelvesFound());

    expect(await new LeftChangesFinder(cm, recordsOf([ownRecord(2, 'br:/main/task1')])).hasOwnWaiting('/work')).toBe(true);
    expect(await new LeftChangesFinder(cm, recordsOf([ownRecord(2, 'br:/main')])).hasOwnWaiting('/work')).toBe(false);
    expect(lines().every((command) => command.startsWith('status') || command.startsWith('getworkspacefrompath'))).toBe(true);
  });
});

describe('shelves the user shelved away', () => {
  it('are never left changes: "Welcome back" and arriving from a switch leave them alone, and they are kept', async () => {
    const { cm } = fakeCm(shelvesFound());
    const records = recordsOf([shelvedAway(5)]);
    const finder = new LeftChangesFinder(cm, records);

    expect(await finder.find('/work')).toEqual([]);
    expect(await finder.hasOwnWaiting('/work')).toBe(false);
    // Their comment is the user's, so the automatic shelves never list them: they aren't forgotten as deleted elsewhere.
    expect(records.find({ shelveId: 5, repository: 'eco@local' })).toBeDefined();
  });
});

describe('LeftChangesFinder.apply', () => {
  beforeEach(() => {
    vi.mocked(applyShelveCleanly).mockReset().mockResolvedValue({ kind: 'applied', count: 1 });
    vi.mocked(deleteShelves).mockClear();
    vi.mocked(detachReplacedFiles).mockClear();
  });

  it('keeps the shelve unless asked, forgetting what shelving it away recorded', async () => {
    const records = recordsOf([shelvedAway(5)]);

    expect(await new LeftChangesFinder(fakeCm(shelvesFound()).cm, records).apply('/work', 5, false, context)).toEqual({ kind: 'applied', count: 1 });
    expect(deleteShelves).not.toHaveBeenCalled();
    expect(records.find({ shelveId: 5, repository: 'eco@local' })).toBeUndefined();
  });

  it("leaves no file on a kept shelve's revision: its diff would show no change at all", async () => {
    await new LeftChangesFinder(fakeCm(shelvesFound()).cm, recordsOf([])).apply('/work', 9, false, context);

    expect(detachReplacedFiles).toHaveBeenCalled();
    expect(deleteShelves).not.toHaveBeenCalled();
  });

  it('deletes any shelve when asked, once the files no longer read their revisions from it', async () => {
    await new LeftChangesFinder(fakeCm(shelvesFound()).cm, recordsOf([])).apply('/work', 9, true, context);

    expect(detachReplacedFiles).toHaveBeenCalled();
    expect(deleteShelves).toHaveBeenCalledWith(expect.anything(), '/work', [{ id: 9, repository: 'eco@local' }]);
  });

  it('always deletes changes left by a switch once back, as restoring them does', async () => {
    await new LeftChangesFinder(fakeCm(shelvesFound()).cm, recordsOf([ownRecord(2, 'br:/main/task1')])).apply('/work', 2, false, context);

    expect(deleteShelves).toHaveBeenCalledWith(expect.anything(), '/work', [{ id: 2, repository: 'eco@local' }]);
  });

  it("leaves another workspace's record alone: its moved-aside files and changelists aren't this workspace's", async () => {
    const elsewhere: SwitchShelveRecord = { ...shelvedAway(5), workspaceGuid: 'another-workspace' };
    const records = recordsOf([elsewhere]);

    await new LeftChangesFinder(fakeCm(shelvesFound()).cm, records).apply('/work', 5, false, context);
    expect(records.find({ shelveId: 5, repository: 'eco@local' })).toEqual(elsewhere);
  });

  it('keeps the record while conflicts wait for the merge view, for when it completes', async () => {
    vi.mocked(applyShelveCleanly).mockResolvedValue({ kind: 'conflicts', count: 2 });
    const records = recordsOf([shelvedAway(5)]);

    expect(await new LeftChangesFinder(fakeCm(shelvesFound()).cm, records).apply('/work', 5, true, context)).toEqual({ kind: 'conflicts' });
    expect(deleteShelves).not.toHaveBeenCalled();
    expect(records.find({ shelveId: 5, repository: 'eco@local' })).toBeDefined();
  });
});
