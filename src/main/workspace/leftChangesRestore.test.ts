import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { WORKSPACE_GUID } from '../testing/cmOutput';
import { memorySettings, recordingContext } from '../testing/scriptedCm';
import { LeftChangesFinder } from './leftChanges';
import { switchWithChanges } from './switchWithChanges';
import { SwitchShelveRecords } from './switchShelveRecords';
import { playAlongWorkspace, type WorkspaceScenario } from './testing/playAlongWorkspace';

// Restoring and discarding left changes, end to end: left by a real switch, against a `cm` that plays along.

const LEFT_ON_TASK1 = 'Automatic shelve created during switch operation (from br:37)';
const UI_WORK = { name: 'UI work', description: 'polish', paths: ['src/a.txt'] };

let workspacePath: string;

beforeEach(async () => {
  workspacePath = join(await mkdtemp(join(tmpdir(), 'uvcs-left-')), 'wk');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(workspacePath, 'src', 'new.txt'), 'added\n');
});

function workspaceWith(scenario: WorkspaceScenario, records: SwitchShelveRecord[] = []) {
  const workspace = playAlongWorkspace(workspacePath, scenario);
  const settings = memorySettings({ switchShelves: records });
  const store = new SwitchShelveRecords(settings);
  const finder = new LeftChangesFinder(workspace.cm, store);
  const deps = { cm: workspace.cm, settings, records: store, leftChanges: finder, backupsRoot: join(workspacePath, '..', 'backups') };
  return { ...workspace, finder, deps, recordOf: (shelveId: number) => store.find({ shelveId, repository: 'eco@local' }) };
}

/** Leaves the changes on /main/task1 by switching to /main/task2, then comes back. */
async function leftAndBack(scenario: WorkspaceScenario) {
  const workspace = workspaceWith({ pending: { 'src/a.txt': 'CH', 'src/new.txt': 'AD' }, changelists: [UI_WORK], ...scenario });
  await switchWithChanges(workspace.deps, workspacePath, 'br:/main/task2', 'leave', recordingContext().context);
  await switchWithChanges(workspace.deps, workspacePath, 'br:/main/task1', undefined, recordingContext().context);
  return workspace;
}

describe('restoring left changes', () => {
  it('brings every change back as it was: the added files, the changelists, and no shelve left over', async () => {
    const { finder, pending, changelists, deletedShelves, recordOf } = await leftAndBack({});

    expect(await finder.find(workspacePath)).toEqual([expect.objectContaining({ shelveId: 7, sourceName: '/main/task1', targetName: '/main/task2', count: 2, foreign: false })]);
    expect(await finder.restore(workspacePath, 7, recordingContext().context)).toEqual({ kind: 'restored', count: 2, sourceName: '/main/task1' });

    expect(pending()).toEqual({ 'src/a.txt': 'CH', 'src/new.txt': 'AD' });
    expect(existsSync(join(workspacePath, 'src', 'new.txt'))).toBe(true);
    expect(changelists()).toEqual([UI_WORK]);
    expect(deletedShelves).toEqual([7]);
    expect(recordOf(7)).toBeUndefined();
    expect(await finder.find(workspacePath)).toEqual([]);
  });

  it('leaves conflicts for the merge view, keeping the shelve and its record', async () => {
    const { finder, recordOf, shelves } = await leftAndBack({ fail: { shelveConflicts: 1 } });

    expect(await finder.restore(workspacePath, 7, recordingContext().context)).toEqual({ kind: 'conflicts', shelveId: 7 });
    expect(shelves()).toEqual([7]);
    expect(recordOf(7)).toBeDefined();
  });

  it("restores changes the official client left on the branch, adopting them so finishing in the merge view cleans up", async () => {
    const { finder, pending, deletedShelves, recordOf } = workspaceWith({
      shelvesOnServer: [{ id: 40, comment: LEFT_ON_TASK1, changes: { 'src/b.txt': 'CH', 'src/c.txt': 'CH' } }],
    });

    expect(await finder.find(workspacePath)).toEqual([expect.objectContaining({ shelveId: 40, sourceName: '/main/task1', count: 2, foreign: true })]);
    expect(await finder.restore(workspacePath, 40, recordingContext().context)).toEqual({ kind: 'restored', count: 2, sourceName: '/main/task1' });
    expect(pending()).toEqual({ 'src/b.txt': 'CH', 'src/c.txt': 'CH' });
    expect(deletedShelves).toEqual([40]);
    expect(recordOf(40)).toBeUndefined();
  });

  it('adopts a foreign shelve whose restore conflicts, so the merge view finishes it like its own', async () => {
    const { finder, recordOf } = workspaceWith({
      shelvesOnServer: [{ id: 40, comment: LEFT_ON_TASK1, changes: { 'src/b.txt': 'CH' } }],
      fail: { shelveConflicts: 1 },
    });

    await finder.restore(workspacePath, 40, recordingContext().context);
    expect(recordOf(40)).toMatchObject({ workspaceGuid: WORKSPACE_GUID, mode: 'leave', source: { spec: 'br:/main/task1', objectRef: 'br:37' }, paths: ['src/b.txt'] });
  });

  it("offers nothing another client left on another branch", async () => {
    const { finder } = workspaceWith({
      shelvesOnServer: [{ id: 41, comment: 'Automatic shelve created during switch operation (from br:38)', changes: { 'src/b.txt': 'CH' } }],
    });

    expect(await finder.find(workspacePath)).toEqual([]);
  });

  it('offers changes still waiting to be brought on the target, where their conflicts wait for the merge view', async () => {
    const workspace = workspaceWith({ pending: { 'src/a.txt': 'CH' }, fail: { shelveConflicts: 1 } });
    await switchWithChanges(workspace.deps, workspacePath, 'br:/main/task2', 'bring', recordingContext().context);

    expect(await workspace.finder.find(workspacePath)).toEqual([expect.objectContaining({ shelveId: 7, mode: 'bring', sourceName: '/main/task1', targetName: '/main/task2' })]);
  });

  it('forgets changes whose shelve was deleted elsewhere', async () => {
    const { finder, deps } = await leftAndBack({});
    const deletedElsewhere = { ...deps.records.find({ shelveId: 7, repository: 'eco@local' })!, shelveId: 99 };
    deps.records.save(deletedElsewhere);

    expect((await finder.find(workspacePath)).map((left) => left.shelveId)).toEqual([7]);
    expect(deps.records.find({ shelveId: 99, repository: 'eco@local' })).toBeUndefined();
  });
});

describe('discarding left changes', () => {
  it('deletes the shelves, the files moved aside and the records', async () => {
    const { finder, recordOf, shelves } = await leftAndBack({});
    const backup = recordOf(7)!.backup!.directory;
    expect(existsSync(backup)).toBe(true);

    await finder.discard(workspacePath, [7]);

    expect(shelves()).toEqual([]);
    expect(existsSync(backup)).toBe(false);
    expect(recordOf(7)).toBeUndefined();
  });
});
