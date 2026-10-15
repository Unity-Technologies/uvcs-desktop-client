import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { memorySettings } from '../settings/testing/memorySettings';
import { readSwitchPreflight } from './switchPreflight';
import { SwitchShelveRecords } from './switchShelveRecords';
import { leftRecord } from './testing/leftRecord';
import { playAlongWorkspace, type WorkspaceScenario } from './testing/playAlongWorkspace';

const WORKSPACE = '/work';

function preflight(scenario: WorkspaceScenario, target = 'br:/main/task2', records: SwitchShelveRecord[] = []) {
  const workspace = playAlongWorkspace(WORKSPACE, scenario);
  const store = new SwitchShelveRecords(memorySettings({ switchShelves: records }));
  return { ...workspace, result: readSwitchPreflight(workspace.cm, store, WORKSPACE, target) };
}

describe('readSwitchPreflight', () => {
  it('counts the changes a switch would shelve, and the private files it leaves alone', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-preflight-'));
    await writeFile(join(workspacePath, 'notes.txt'), 'mine\n');
    const workspace = playAlongWorkspace(workspacePath, { pending: { 'src/a.txt': 'CH', 'src/b.txt': 'AD', 'notes.txt': 'PR' } });

    expect(await readSwitchPreflight(workspace.cm, new SwitchShelveRecords(memorySettings()), workspacePath, 'br:/main/task2')).toMatchObject({
      sourceName: '/main/task1',
      pendingCount: 2,
      privateCount: 1,
      unchangedCheckoutsOnly: false,
      inMerge: false,
    });
  });

  it('names the pending files the user has locked here, whose locks undoing them would release', async () => {
    const { result, lines } = preflight({
      pending: { 'src/a.txt': 'CH', 'src/b.txt': 'CH' },
      locks: [
        { repository: 'eco', path: '/src/a.txt' },
        { repository: 'eco', path: '/src/elsewhere.txt' },
        // The same path in another repository (an xlink's) is another file.
        { repository: 'lib', path: '/src/b.txt' },
      ],
    });

    expect((await result).lockedPaths).toEqual(['src/a.txt']);
    expect(lines().filter((line) => line.startsWith('lock'))).toEqual([expect.stringMatching(/^lock list --onlycurrentuser --onlycurrentworkspace /)]);
  });

  it('asks the server about locks only when the user has a choice to make', async () => {
    for (const scenario of [{}, { pending: { 'src/a.txt': 'CO' } }, { pending: { 'src/a.txt': 'CH' }, mergingFrom: 3 }]) {
      const { result, ran } = preflight(scenario);
      expect((await result).lockedPaths).toEqual([]);
      expect(ran('lock')).toBe(false);
    }
  });

  it('tells a workspace with only unchanged checkouts, and one in the middle of a merge', async () => {
    expect(await preflight({ pending: { 'src/a.txt': 'CO' } }).result).toMatchObject({ unchangedCheckoutsOnly: true });
    expect(await preflight({ pending: { 'src/a.txt': 'CH' }, mergingFrom: 3 }).result).toMatchObject({ inMerge: true });
  });

  it("says why changes can't come along to a label, or be left on a shelve", async () => {
    expect(await preflight({ pending: { 'src/a.txt': 'CH' } }, 'lb:v1').result).toMatchObject({ bringDisabledReason: 'label', leaveDisabledReason: undefined });
    expect(await preflight({ pending: { 'src/a.txt': 'CH' }, onShelve: 4 }).result).toMatchObject({ sourceName: 'shelve 4', leaveDisabledReason: 'shelveSource' });
  });

  it('counts the changes already left on the source, not those left elsewhere, shelved away or brought along', async () => {
    const records = [
      leftRecord(2, 'br:/main/task1'),
      leftRecord(3, 'br:/main/task1'),
      leftRecord(4, 'br:/main/task2'),
      leftRecord(5, 'br:/main/task1', { mode: 'bring' }),
      leftRecord(6, 'br:/main/task1', { workspaceGuid: 'another-workspace' }),
      leftRecord(8, 'br:/main/task1', { repository: 'other@local' }),
      leftRecord(9, 'br:/main/task1', { reason: 'shelve' }),
      // Files that blocked an update are left changes too: "Welcome back" offers them.
      leftRecord(10, 'br:/main/task1', { reason: 'update' }),
    ];

    expect((await preflight({ pending: { 'src/a.txt': 'CH' } }, 'br:/main/task2', records).result).leftShelveCount).toBe(3);
  });
});
