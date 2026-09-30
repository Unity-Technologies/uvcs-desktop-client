import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateResolutions } from '@shared/domain/incoming';
import type { LeftChangesFinder } from './leftChanges';
import {
  branchFound,
  change,
  changesetsFound,
  diffRecord,
  mergeOutput,
  NOTHING_FOUND,
  pendingStatus,
  shelvesCreated,
  statusHeader,
  WORKSPACE_NAMES,
} from '../testing/cmOutput';
import { memorySettings, recordingContext, scriptedCm, type CmAnswer } from '../testing/scriptedCm';
import { shelveBlockedAndUpdate } from './shelveBlockedAndUpdate';
import { SwitchShelveRecords } from './switchShelveRecords';

vi.mock('../files/nextSecond', () => ({ waitForNextSecond: async () => {} }));

interface Scenario {
  /** What changeset 2 did besides deleting src/old.txt, which the user changed. */
  alsoIncoming?: string;
  failUpdate?: boolean;
  /** Merging the shelve back conflicts. */
  putBackConflicts?: boolean;
  branchExists?: boolean;
}

/** A workspace on /main/task1 (branch id 37) with src/old.txt and src/a.txt changed, while changeset 2 deleted src/old.txt. */
function blockedWorkspace(workspacePath: string, { alsoIncoming = '', failUpdate = false, putBackConflicts = false, branchExists = true }: Scenario = {}) {
  let shelveComment = '';
  let pending = ['src/old.txt', 'src/a.txt'];
  const pendingChanges = (): string => pendingStatus(...pending.map((path) => change('CH', path)));
  const shelveMerge: CmAnswer = (args) => {
    if (args.includes('--merge')) return '';
    return mergeOutput(['APPLY', 'ADD', '/src/old.txt'], ...(putBackConflicts ? [['DIR_CONFLICT', 'CHG_RM', 'Change/Delete conflict', 'x', 'Modified /src/old.txt', 'Deleted /src/old.txt', '29', 'False', 'CHG', '/src/old.txt', 'RM', '/src/old.txt']] : []));
  };
  const fake = scriptedCm({
    'status --header --xml': statusHeader('/main/task1'),
    getworkspacefrompath: WORKSPACE_NAMES,
    'find changeset': changesetsFound('/main/task1', { id: 2, owner: 'ana' }),
    'find branch': branchExists ? branchFound('/main/task1', 37) : NOTHING_FOUND,
    'diff cs:1 cs:2': diffRecord('D', 'src/old.txt', { revision: 11 }) + alsoIncoming,
    'status --xml --controlledchanged --changed': pendingChanges,
    'status --xml --iscochanged': pendingChanges,
    'status --xml --checkout': pendingStatus(),
    'status --short': '',
    'shelveset create': async (args) => {
      shelveComment = await readFile(args.find((arg) => arg.startsWith('-commentsfile='))!.slice('-commentsfile='.length), 'utf8');
      return shelvesCreated({ id: 12 });
    },
    'diff sh:12': diffRecord('C', 'src/old.txt', { base: 11, revision: 50 }),
    undo: (args) => {
      pending = pending.filter((path) => !args.includes(join(workspacePath, path)));
      return '';
    },
    update: () => {
      if (failUpdate) throw new Error('The server is unreachable.');
      return '';
    },
    'merge sh:12': shelveMerge,
  });
  const records = new SwitchShelveRecords(memorySettings());
  const finish = vi.fn(async () => {});
  const deps = { cm: fake.cm, records, leftChanges: { finish } as unknown as LeftChangesFinder, backupsRoot: join(workspacePath, '..', 'backups') };
  return { ...fake, deps, records, finish, shelveComment: () => shelveComment };
}

let workspacePath: string;

beforeEach(async () => {
  workspacePath = join(await mkdtemp(join(tmpdir(), 'uvcs-blocked-')), 'wk');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(workspacePath, 'src', 'a.txt'), 'mine\n');
});

const run = (deps: ReturnType<typeof blockedWorkspace>['deps'], resolutions: UpdateResolutions | null = null) =>
  shelveBlockedAndUpdate(deps, workspacePath, resolutions, recordingContext().context);

describe('shelveBlockedAndUpdate', () => {
  it('shelves only the blocking files, as changes left on the branch, then undoes them and updates', async () => {
    const { deps, lines, records, shelveComment } = blockedWorkspace(workspacePath);

    expect(await run(deps)).toEqual({ shelveId: 12, count: 1, updated: true, backupDirectory: null });

    const blocked = join(workspacePath, 'src', 'old.txt');
    expect(lines().filter((line) => /^(shelveset|undo|update)/.test(line))).toEqual([
      expect.stringMatching(new RegExp(`^shelveset create ${blocked.replace(/\\/g, '\\\\')} --all -commentsfile=`)),
      `undo ${blocked} --symlink`,
      expect.stringMatching(/^update /),
    ]);
    // The official comment, so "Welcome back" and the official client offer them back on this branch.
    expect(shelveComment()).toBe('Automatic shelve created during switch operation (from br:37)');
    expect(records.find({ shelveId: 12, repository: 'eco@local' })).toMatchObject({ reason: 'update', mode: 'leave', source: { spec: 'br:/main/task1' }, paths: ['src/old.txt'] });
  });

  it("stops after shelving when other files still need the user's merge: Incoming then shows only them", async () => {
    const { deps, ran } = blockedWorkspace(workspacePath, { alsoIncoming: diffRecord('C', 'src/a.txt', { base: 1, revision: 2 }) });

    expect(await run(deps)).toEqual({ shelveId: 12, count: 1, updated: false, backupDirectory: null });
    expect(ran('update')).toBe(false);
  });

  it("updates writing the user's merge of the files changed on both sides", async () => {
    const { deps } = blockedWorkspace(workspacePath, { alsoIncoming: diffRecord('C', 'src/a.txt', { base: 1, revision: 2 }) });

    const result = await run(deps, { 'src/a.txt': { choice: 'text', text: 'combined\n' } });

    expect(result).toMatchObject({ shelveId: 12, updated: true, backupDirectory: expect.any(String) });
    expect(await readFile(join(workspacePath, 'src', 'a.txt'), 'utf8')).toBe('combined\n');
  });

  it('puts the files back by merging the shelve when the update fails', async () => {
    const { deps, lines, finish } = blockedWorkspace(workspacePath, { failUpdate: true });

    await expect(run(deps)).rejects.toThrow("Couldn't update: The server is unreachable. Your changes were put back.");
    expect(lines()).toContainEqual(expect.stringMatching(/^merge sh:12 --merge .*--nointeractiveresolution/));
    expect(finish).toHaveBeenCalledWith(workspacePath, expect.objectContaining({ shelveId: 12 }));
  });

  it("says where the changes are when they can't go back cleanly, and keeps them offered in Changes", async () => {
    const { deps, records, finish } = blockedWorkspace(workspacePath, { failUpdate: true, putBackConflicts: true });

    await expect(run(deps)).rejects.toThrow("Couldn't update: The server is unreachable. Your changes are safe in shelve 12; restore them from Changes.");
    expect(finish).not.toHaveBeenCalled();
    expect(records.find({ shelveId: 12, repository: 'eco@local' })).toMatchObject({ reason: 'update' });
  });

  it('shelves nothing when the branch cannot be found to name where the changes were made', async () => {
    const { deps, ran } = blockedWorkspace(workspacePath, { branchExists: false });

    await expect(run(deps)).rejects.toThrow("Couldn't find /main/task1 in the repository, so nothing was shelved.");
    expect(ran('shelveset')).toBe(false);
  });

  it('shelves nothing once nothing blocks the update anymore', async () => {
    const { deps } = blockedWorkspace(workspacePath);
    const upToDate = scriptedCm({ 'status --header --xml': statusHeader('/main/task1'), 'find changeset': NOTHING_FOUND });

    await expect(run({ ...deps, cm: upToDate.cm })).rejects.toThrow('Nothing blocks the update anymore: update from Incoming.');
    expect(upToDate.lines()).toEqual(['status --header --xml', expect.stringMatching(/^find changeset /)]);
  });
});
