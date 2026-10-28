import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AUTOMATIC_SHELVE_COMMENT } from '@shared/domain/shelve';
import { beforeEach, describe, expect, it } from 'vitest';
import { recordingContext } from '../operations/testing/recordingContext';
import { loadXlink } from './loadXlink';
import { playAlongDependencies } from './testing/playAlongDependencies';
import { playAlongWorkspace, type WorkspaceScenario } from './testing/playAlongWorkspace';

const EDITED_AND_ADDED = { 'src/a.txt': 'CH', 'src/new.txt': 'AD' };

let workspacePath: string;

beforeEach(async () => {
  workspacePath = join(await mkdtemp(join(tmpdir(), 'uvcs-load-xlink-')), 'wk');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(workspacePath, 'src', 'new.txt'), 'added\n');
});

function workspaceWith(scenario: WorkspaceScenario) {
  const workspace = playAlongWorkspace(workspacePath, scenario);
  return { ...workspace, ...playAlongDependencies(workspace.cm, workspacePath) };
}

const load = (deps: ReturnType<typeof workspaceWith>['deps']) => loadXlink(deps, workspacePath, 'code/lib', recordingContext().context);

describe('Loading a checked-in xlink’s files', () => {
  it('updates its folder alone, leaving the other pending changes as they are', async () => {
    const { deps, commands, pending, updatedFolders, shelves } = workspaceWith({ pending: EDITED_AND_ADDED });

    expect(await load(deps)).toEqual({ kind: 'loaded' });

    expect(updatedFolders).toEqual(['code/lib']);
    expect(commands).toMatchObject([
      // `--machinereadable`: a cm set to shelve the changes on update refuses instead, and never shelves them itself.
      { via: 'execute', args: ['update', join(workspacePath, 'code', 'lib'), '--machinereadable', '--noinput', '--dontmerge'], options: { cwd: workspacePath } },
    ]);
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(shelves()).toEqual([]);
  });

  it('puts the changes aside when cm refuses because of them, loads the files, and merges them back', async () => {
    const { deps, pending, updatedFolders, shelves, deletedShelves, recordOf, lines, commands } = workspaceWith({ pending: EDITED_AND_ADDED, updateRefusesPendingChanges: true });

    expect(await load(deps)).toEqual({ kind: 'loaded' });
    const readsBeforeShelving = commands.slice(0, commands.findIndex((command) => command.args[0] === 'shelveset'));
    // The changes in the way are read once: the shelve takes the same snapshot.
    expect(readsBeforeShelving.filter((command) => command.args.includes('--changelists'))).toHaveLength(1);

    expect(updatedFolders).toEqual(['code/lib']);
    expect(lines()).toContain(`undo -r ${workspacePath} --symlink`);
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(existsSync(join(workspacePath, 'src', 'new.txt'))).toBe(true);
    expect(shelves()).toEqual([]);
    expect(deletedShelves).toEqual([7]);
    expect(recordOf(7)).toBeUndefined();
  });

  it('shelves the changes put aside as the official client leaves them, so they are found should they not come back', async () => {
    const { deps, shelveComment, leftChanges, recordOf } = workspaceWith({ pending: EDITED_AND_ADDED, updateRefusesPendingChanges: true, fail: { shelveConflicts: 1 } });

    expect(await load(deps)).toEqual({ kind: 'changesWaiting', shelveId: 7 });

    expect(shelveComment(7)).toMatch(new RegExp(`^${AUTOMATIC_SHELVE_COMMENT}`));
    expect(recordOf(7)).toMatchObject({ mode: 'leave', reason: 'xlink' });
    expect(await leftChanges.find(workspacePath)).toMatchObject([{ shelveId: 7, reason: 'xlink' }]);
  });

  it('undoes checkouts holding no change instead of shelving them', async () => {
    const { deps, pending, updatedFolders, shelves, lines } = workspaceWith({ pending: { 'src/a.txt': 'CO' }, updateRefusesPendingChanges: true });

    expect(await load(deps)).toEqual({ kind: 'loaded' });

    expect(lines()).toContain(`undo --unchanged -r ${workspacePath} --symlink`);
    expect(pending()).toEqual({});
    expect(shelves()).toEqual([]);
    expect(updatedFolders).toEqual(['code/lib']);
  });

  it('leaves a merge in progress alone, as no shelve can hold it', async () => {
    const { deps, pending, shelves } = workspaceWith({ pending: { 'src/a.txt': 'CH' }, mergingFrom: 3, updateRefusesPendingChanges: true });

    await expect(load(deps)).rejects.toThrow('A merge in progress keeps its files from loading');
    expect(pending()).toEqual({ 'src/a.txt': 'CH' });
    expect(shelves()).toEqual([]);
  });

  it('fails with cm’s words when nothing is pending: no change could be in the way', async () => {
    const { deps, shelves } = workspaceWith({ fail: { update: 'The server is unreachable.' } });

    await expect(load(deps)).rejects.toThrow('The server is unreachable.');
    expect(shelves()).toEqual([]);
  });

  it('tells what cm update said when the changes in the way can’t even be shelved', async () => {
    const { deps, pending, lines } = workspaceWith({ pending: EDITED_AND_ADDED, updateRefusesPendingChanges: true });
    const execute = deps.cm.execute;
    deps.cm.execute = async (args, options) => (args[0] === 'shelveset' ? Promise.reject(new Error('The server is unreachable.')) : execute(args, options));

    await expect(load(deps)).rejects.toThrow('The workspace cannot be updated since there are pending changes.');
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(lines().some((line) => line.startsWith('undo'))).toBe(false);
  });

  it('puts the changes back when the files don’t load once they are aside', async () => {
    const { deps, pending, shelves } = workspaceWith({ pending: EDITED_AND_ADDED, updateRefusesPendingChanges: true });
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
