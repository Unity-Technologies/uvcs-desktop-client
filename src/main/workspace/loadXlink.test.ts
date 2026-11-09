import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AUTOMATIC_SHELVE_COMMENT } from '@shared/domain/shelve';
import { beforeEach, describe, expect, it } from 'vitest';
import { recordingContext } from '../operations/testing/recordingContext';
import { CmError } from '../cm/CmError';
import type { CommandProgress } from '@shared/domain/operation';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import type { ProgressReader } from '../cm/progress/progressReader';
import { loadXlink } from './loadXlink';
import { playAlongDependencies } from './testing/playAlongDependencies';
import { playAlongWorkspace, type WorkspaceScenario } from './testing/playAlongWorkspace';

const EDITED_AND_ADDED = { 'src/a.txt': 'CH', 'src/new.txt': 'AD' };
const FAILED = { args: [], exitCode: 1, logEntryId: 0 } as unknown as ConstructorParameters<typeof CmError>[1];

let workspacePath: string;

beforeEach(async () => {
  workspacePath = join(await mkdtemp(join(tmpdir(), 'uvcs-load-xlink-')), 'wk');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(workspacePath, 'src', 'new.txt'), 'added\n');
});

/**
 * A workspace whose `cm update` refuses while changes are pending: the app must never update with changes in the way,
 * as `cm` set to shelve them would shelve them itself.
 */
function workspaceWith(scenario: WorkspaceScenario) {
  const workspace = playAlongWorkspace(workspacePath, { updateRefusesPendingChanges: true, ...scenario });
  return { ...workspace, ...playAlongDependencies(workspace.cm, workspacePath) };
}

const load = (deps: ReturnType<typeof workspaceWith>['deps']) => loadXlink(deps, workspacePath, 'code/lib', recordingContext().context);

describe('Loading a checked-in xlink’s files', () => {
  it('updates the folder holding it with the progress an update shows, when nothing is pending', async () => {
    const { deps, commands, updatedFolders, shelves } = workspaceWith({ pending: { 'notes.txt': 'PR' } });

    expect(await load(deps)).toEqual({ kind: 'loaded' });

    expect(updatedFolders).toEqual(['code']);
    // A private file is no change in the way: nothing is shelved for it.
    expect(shelves()).toEqual([]);
    expect(commands.filter((command) => command.args[0] === 'update')).toMatchObject([
      { via: 'execute', args: ['update', join(workspacePath, 'code'), '--forcedetailedprogress', '--noinput', '--dontmerge'], options: { cwd: workspacePath, onOutputLine: expect.any(Function) } },
    ]);
  });

  it('reports the update’s progress as an update or a switch does', async () => {
    const { deps } = workspaceWith({});
    const execute = deps.cm.execute;
    deps.cm.execute = async (args, options) => {
      if (args[0] === 'update') options?.onOutputLine?.('- Updating       [###.................]  17%   55.68/319.56 MB -   1/506 files');
      return execute(args, options);
    };
    let reported: CommandProgress | null = null;
    const context = { ...recordingContext().context, progressOf: (reader: ProgressReader) => (line: string) => void (reported = reader(reported, line)) };

    await loadXlink(deps, workspacePath, 'code/lib', context);

    expect(reported).toEqual(readUpdateProgress(null, '- Updating       [###.................]  17%   55.68/319.56 MB -   1/506 files'));
    expect(reported).toMatchObject({ stage: 'downloading' });
  });

  it('puts the pending changes aside before updating, so cm never shelves them itself, and merges them back', async () => {
    const { deps, pending, updatedFolders, shelves, deletedShelves, recordOf, lines, commands } = workspaceWith({ pending: EDITED_AND_ADDED });

    expect(await load(deps)).toEqual({ kind: 'loaded' });
    const readsBeforeShelving = commands.slice(0, commands.findIndex((command) => command.args[0] === 'shelveset'));
    // The changes in the way are read once: the shelve takes the same snapshot.
    expect(readsBeforeShelving.filter((command) => command.args.includes('--changelists'))).toHaveLength(1);

    expect(updatedFolders).toEqual(['code']);
    expect(lines()).toContain(`undo -r ${workspacePath} --symlink`);
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(existsSync(join(workspacePath, 'src', 'new.txt'))).toBe(true);
    expect(shelves()).toEqual([]);
    expect(deletedShelves).toEqual([7]);
    expect(recordOf(7)).toBeUndefined();
  });

  it('shelves the changes put aside as the official client leaves them, so they are found should they not come back', async () => {
    const { deps, shelveComment, leftChanges, recordOf } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { shelveConflicts: 1 } });

    expect(await load(deps)).toEqual({ kind: 'changesWaiting', shelveId: 7 });

    expect(shelveComment(7)).toMatch(new RegExp(`^${AUTOMATIC_SHELVE_COMMENT}`));
    expect(recordOf(7)).toMatchObject({ mode: 'leave', reason: 'xlink' });
    expect(await leftChanges.find(workspacePath)).toMatchObject([{ shelveId: 7, reason: 'xlink' }]);
  });

  it('undoes checkouts holding no change instead of shelving them', async () => {
    const { deps, pending, updatedFolders, shelves, lines } = workspaceWith({ pending: { 'src/a.txt': 'CO' } });

    expect(await load(deps)).toEqual({ kind: 'loaded' });

    expect(lines()).toContain(`undo --unchanged -r ${workspacePath} --symlink`);
    expect(pending()).toEqual({});
    expect(shelves()).toEqual([]);
    expect(updatedFolders).toEqual(['code']);
  });

  it('leaves a merge in progress alone, as no shelve can hold it', async () => {
    const { deps, pending, shelves } = workspaceWith({ pending: { 'src/a.txt': 'CH' }, mergingFrom: 3 });

    await expect(load(deps)).rejects.toThrow('A merge in progress keeps its files from loading');
    expect(pending()).toEqual({ 'src/a.txt': 'CH' });
    expect(shelves()).toEqual([]);
  });

  it('fails with cm’s words when nothing is pending: no change could be in the way', async () => {
    const { deps, shelves } = workspaceWith({ fail: { update: 'The server is unreachable.' } });

    await expect(load(deps)).rejects.toThrow('The server is unreachable.');
    expect(shelves()).toEqual([]);
  });

  it('tells why the changes in the way couldn’t be shelved, loading nothing and leaving them as they were', async () => {
    const { deps, pending, lines, updatedFolders } = workspaceWith({ pending: EDITED_AND_ADDED });
    const execute = deps.cm.execute;
    deps.cm.execute = async (args, options) => (args[0] === 'shelveset' ? Promise.reject(new CmError('The server is unreachable.', FAILED)) : execute(args, options));

    await expect(load(deps)).rejects.toThrow('The server is unreachable.');
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(lines().some((line) => line.startsWith('undo'))).toBe(false);
    expect(updatedFolders).toEqual([]);
  });

  it('says what to do when the changes in the way can’t be shelved, leaving them as they were', async () => {
    const { deps, pending, lines } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { shelveMisses: 'src/a.txt' } });

    await expect(load(deps)).rejects.toThrow('Check them in first.');
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(lines().some((line) => line.startsWith('undo'))).toBe(false);
  });

  it('puts the changes back when the files don’t load once they are aside', async () => {
    const { deps, pending, shelves } = workspaceWith({ pending: EDITED_AND_ADDED });
    const execute = deps.cm.execute;
    deps.cm.execute = async (args, options) => {
      if (args[0] === 'update' && Object.keys(pending()).length === 0) throw new Error('The server is unreachable.');
      return execute(args, options);
    };

    await expect(load(deps)).rejects.toThrow('The server is unreachable. Your changes were put back.');
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(shelves()).toEqual([]);
  });
});
