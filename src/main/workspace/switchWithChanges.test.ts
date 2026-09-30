import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PendingChangesAction } from '@shared/domain/switchWithChanges';
import { memorySettings, recordingContext } from '../testing/scriptedCm';
import { LeftChangesFinder } from './leftChanges';
import { SwitchShelveRecords } from './switchShelveRecords';
import { switchWithChanges, type SwitchDependencies } from './switchWithChanges';
import { playAlongWorkspace, type WorkspaceScenario } from './testing/playAlongWorkspace';

const EDITED_AND_ADDED = { 'src/a.txt': 'CH', 'src/new.txt': 'AD' };
const LEFT_ON_TASK1 = 'Automatic shelve created during switch operation (from br:37)';

let workspacePath: string;

beforeEach(async () => {
  workspacePath = join(await mkdtemp(join(tmpdir(), 'uvcs-switch-')), 'wk');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(workspacePath, 'src', 'new.txt'), 'added\n');
});

/** A workspace on /main/task1, with a `cm` that plays along, and the app's real records and left changes. */
function workspaceWith(scenario: WorkspaceScenario, { restoreLeftChangesAutomatically = false } = {}) {
  const workspace = playAlongWorkspace(workspacePath, scenario);
  const settings = memorySettings({ restoreLeftChangesAutomatically });
  const records = new SwitchShelveRecords(settings);
  const deps: SwitchDependencies = {
    cm: workspace.cm,
    settings,
    records,
    leftChanges: new LeftChangesFinder(workspace.cm, records),
    backupsRoot: join(workspacePath, '..', 'backups'),
  };
  const recordOf = (shelveId: number) => records.find({ shelveId, repository: 'eco@local' });
  return { ...workspace, deps, records, recordOf };
}

function switchTo(deps: SwitchDependencies, target: string, action?: PendingChangesAction, context = recordingContext().context) {
  return switchWithChanges(deps, workspacePath, target, action, context);
}

const addedFileIsHere = (): boolean => existsSync(join(workspacePath, 'src', 'new.txt'));
/** The commands that change the workspace, in order. */
const writes = (lines: string[]): string[] => lines.filter((line) => /^(shelveset|undo|switch|merge sh:\d+ --merge)/.test(line)).map((line) => line.split(' ').slice(0, 2).join(' '));

describe('switching a workspace without changes', () => {
  it('just switches, as a process that can be stopped', async () => {
    const { deps, commands, branch } = workspaceWith({});
    const { context } = recordingContext();

    expect(await switchTo(deps, 'br:/main/task2', undefined, context)).toEqual({ kind: 'switched' });
    expect(branch()).toBe('/main/task2');
    const switched = commands.find((command) => command.args[0] === 'switch')!;
    expect(switched).toMatchObject({ route: 'execute', options: { signal: context.signal } });
    expect(switched.args).toEqual(['switch', 'br:/main/task2', '--forcedetailedprogress', '--noinput']);
  });

  it('undoes checkouts without edits and switches, asking nothing: they hold no change to lose', async () => {
    const { deps, lines, pending } = workspaceWith({ pending: { 'src/a.txt': 'CO', 'src/b.txt': 'CO' } });

    expect(await switchTo(deps, 'br:/main/task2')).toEqual({ kind: 'undidUnchangedCheckouts', count: 2 });
    expect(pending()).toEqual({});
    expect(writes(lines())).toEqual(['undo --unchanged', 'switch br:/main/task2']);
  });

  it('never counts private files as changes to take care of', async () => {
    const { deps, ran } = workspaceWith({ pending: { 'notes.txt': 'PR' } });

    expect(await switchTo(deps, 'br:/main/task2')).toEqual({ kind: 'switched' });
    expect(ran('shelveset')).toBe(false);
  });
});

describe('switching with changes refuses, touching nothing,', () => {
  const refuses = async (scenario: WorkspaceScenario, target: string, action: PendingChangesAction | undefined, message: string | RegExp) => {
    const { deps, lines, pending } = workspaceWith(scenario);
    const before = { ...pending() };

    await expect(switchTo(deps, target, action)).rejects.toThrow(message);
    expect(writes(lines())).toEqual([]);
    expect(pending()).toEqual(before);
  };

  it('until the user chooses to leave or bring the changes', () =>
    refuses({ pending: EDITED_AND_ADDED }, 'br:/main/task2', undefined, 'The workspace has pending changes. Choose whether to leave them or bring them along.'));

  it('in the middle of a merge, which no shelve can hold', () =>
    refuses({ pending: { 'src/a.txt': 'CH' }, mergingFrom: 3 }, 'br:/main/task2', 'leave', "You're in the middle of a merge. Check it in or undo it before switching."));

  it('leaving changes on a shelve, which takes none', () =>
    refuses({ pending: EDITED_AND_ADDED, onShelve: 4 }, 'br:/main/task2', 'leave', "Changes can't be left on a shelve. Bring them along, or check them in first."));

  it('bringing changes to a label, a fixed snapshot', () => refuses({ pending: EDITED_AND_ADDED }, 'lb:v1', 'bring', "Your changes can't be brought to this target."));

  it('bringing changes to another repository', () => refuses({ pending: EDITED_AND_ADDED }, 'br:/main@other@local', 'bring', "Your changes can't be brought to this target."));

  it('once stopped before anything was shelved', async () => {
    const { deps, lines } = workspaceWith({ pending: EDITED_AND_ADDED });
    const stop = new AbortController();
    stop.abort();

    await expect(switchTo(deps, 'br:/main/task2', 'leave', recordingContext(stop.signal).context)).rejects.toThrow('The switch was cancelled.');
    expect(writes(lines())).toEqual([]);
  });

  it("when the branch can't be found to name where the changes were made", () =>
    refuses({ pending: EDITED_AND_ADDED, knownBranches: ['/main/task2'] }, 'br:/main/task2', 'leave', "Couldn't find /main/task1 in the repository, so nothing was switched."));
});

describe('the shelve must hold every change before anything is undone', () => {
  it('deletes a shelve that misses a change, and leaves the workspace as it was', async () => {
    const { deps, lines, shelves, pending } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { shelveMisses: 'src/a.txt' } });

    await expect(switchTo(deps, 'br:/main/task2', 'leave')).rejects.toThrow("Some changes couldn't be shelved (src/a.txt), so the workspace was left as it was. Check them in first.");
    expect(shelves()).toEqual([]);
    expect(writes(lines())).toEqual(['shelveset create', 'shelveset delete']);
    expect(pending()).toEqual(EDITED_AND_ADDED);
  });

  it('deletes every shelve when changes under an xlink were shelved apart', async () => {
    const { deps, lines } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { shelveSplits: true } });

    await expect(switchTo(deps, 'br:/main/task2', 'leave')).rejects.toThrow("Changes inside Xlinks can't be shelved yet. Check them in first.");
    expect(lines().filter((line) => line.startsWith('shelveset delete'))).toEqual(['shelveset delete sh:7@eco@local', 'shelveset delete sh:3@lib@local']);
    expect(lines().some((line) => line.startsWith('undo') || line.startsWith('switch'))).toBe(false);
  });
});

describe('leaving the changes', () => {
  it('shelves them with the official comment, undoes them, moves added files aside and switches', async () => {
    const { deps, lines, shelveComment, branch, pending } = workspaceWith({ pending: EDITED_AND_ADDED });

    expect(await switchTo(deps, 'br:/main/task2', 'leave')).toEqual({ kind: 'left', shelveId: 7, count: 2, sourceName: '/main/task1' });

    expect(writes(lines())).toEqual(['shelveset create', 'undo -r', 'switch br:/main/task2']);
    // Links themselves too: a checked-out link would stay pending otherwise.
    expect(lines()).toContain(`undo -r ${workspacePath} --symlink`);
    expect(shelveComment(7)).toBe(LEFT_ON_TASK1);
    expect(branch()).toBe('/main/task2');
    expect(pending()).toEqual({});
    // An added file stays on disk once undone: it would show up on the target as a private file.
    expect(addedFileIsHere()).toBe(false);
  });

  it('records the shelve before undoing anything, so the changes are found again whatever happens next', async () => {
    const { deps, records, recordOf } = workspaceWith({ pending: EDITED_AND_ADDED });
    const undo = deps.cm.execute;
    let recordedBeforeUndo = false;
    deps.cm.execute = async (args, options) => {
      if (args[0] === 'undo') recordedBeforeUndo = records.forWorkspace('a0411612-d36e-4eca-b9b5-97acad5969ea').length === 1;
      return undo(args, options);
    };

    await switchTo(deps, 'br:/main/task2', 'leave');
    expect(recordedBeforeUndo).toBe(true);
    expect(recordOf(7)).toMatchObject({
      mode: 'leave',
      source: { spec: 'br:/main/task1', name: '/main/task1', objectRef: 'br:37' },
      target: { spec: 'br:/main/task2', name: '/main/task2' },
      paths: ['src/a.txt', 'src/new.txt'],
      backup: { paths: ['src/new.txt'] },
    });
  });

  it('keeps each change in its changelist for when they come back', async () => {
    const { deps, recordOf } = workspaceWith({ pending: EDITED_AND_ADDED, changelists: [{ name: 'UI work', description: 'polish', paths: ['src/a.txt'] }] });

    await switchTo(deps, 'br:/main/task2', 'leave');
    expect(recordOf(7)!.changelists).toEqual([{ name: 'UI work', description: 'polish', paths: ['src/a.txt'] }]);
  });

  it('records where the switch really landed, as cm names it', async () => {
    const { deps, recordOf } = workspaceWith({ pending: EDITED_AND_ADDED });

    await switchTo(deps, '/main/task2', 'leave');
    expect(recordOf(7)!.target).toEqual({ spec: 'br:/main/task2', name: '/main/task2' });
  });

  it('tells which private files the switch renamed because the target has a file there', async () => {
    await writeFile(join(workspacePath, 'src', 'notes.txt'), 'mine\n');
    await writeFile(join(workspacePath, 'src', 'notes.txt.private.0'), 'mine\n');
    const { deps } = workspaceWith({ pending: { ...EDITED_AND_ADDED, 'src/notes.txt': 'PR' }, privateInTheWay: 'src/notes.txt' });

    expect(await switchTo(deps, 'br:/main/task2', 'leave')).toMatchObject({ renamedPrivates: [{ path: 'src/notes.txt', renamedTo: 'src/notes.txt.private.0' }] });
  });
});

describe('bringing the changes', () => {
  it('merges the shelve on the target, puts the added files back and deletes the shelve', async () => {
    const { deps, lines, pending, deletedShelves, recordOf, branch } = workspaceWith({ pending: EDITED_AND_ADDED });

    expect(await switchTo(deps, 'br:/main/task2', 'bring')).toEqual({ kind: 'brought' });

    expect(writes(lines())).toEqual(['shelveset create', 'undo -r', 'switch br:/main/task2', 'merge sh:7', 'shelveset delete']);
    expect(lines()).toContainEqual(expect.stringMatching(/^merge sh:7 --merge .*--nointeractiveresolution/));
    expect(branch()).toBe('/main/task2');
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(await readFile(join(workspacePath, 'src', 'new.txt'), 'utf8')).toBe('added\n');
    expect(deletedShelves).toEqual([7]);
    expect(recordOf(7)).toBeUndefined();
  });

  it('moves the added files aside while switching, so the target never gets them as private files', async () => {
    const { deps } = workspaceWith({ pending: EDITED_AND_ADDED });
    const execute = deps.cm.execute;
    let addedFileDuringSwitch: boolean | undefined;
    deps.cm.execute = async (args, options) => {
      if (args[0] === 'switch') addedFileDuringSwitch = addedFileIsHere();
      return execute(args, options);
    };

    await switchTo(deps, 'br:/main/task2', 'bring');
    expect(addedFileDuringSwitch).toBe(false);
  });

  it('leaves conflicts for the merge view, keeping the shelve and its record on the target', async () => {
    const { deps, recordOf, shelves, branch } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { shelveConflicts: 2 } });

    expect(await switchTo(deps, 'br:/main/task2', 'bring')).toEqual({ kind: 'bringPending', shelveId: 7, conflictCount: 2 });
    expect(branch()).toBe('/main/task2');
    expect(shelves()).toEqual([7]);
    expect(recordOf(7)).toMatchObject({ mode: 'bring', target: { spec: 'br:/main/task2' } });
  });

  it('keeps the switch when bringing fails: the changes wait safe in the shelve', async () => {
    const { deps, shelves, branch } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { shelveMerge: 'The merge failed.' } });

    expect(await switchTo(deps, 'br:/main/task2', 'bring')).toEqual({ kind: 'bringPending', shelveId: 7, conflictCount: 0 });
    expect(branch()).toBe('/main/task2');
    expect(shelves()).toEqual([7]);
  });
});

describe('a failure after shelving puts the changes back', () => {
  it('when undoing them fails: changes never undone are still here, and only the shelve goes', async () => {
    const { deps, pending, deletedShelves, recordOf, ran } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { undo: 'The file is in use.' } });

    await expect(switchTo(deps, 'br:/main/task2', 'leave')).rejects.toThrow('The file is in use. Your changes were put back.');
    expect(ran('switch')).toBe(false);
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(deletedShelves).toEqual([7]);
    expect(recordOf(7)).toBeUndefined();
  });

  it('when changes are still pending after undoing them, without switching', async () => {
    const { deps, ran } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { undoLeavesChanges: true } });

    await expect(switchTo(deps, 'br:/main/task2', 'leave')).rejects.toThrow('Some changes are still pending after undoing them. Your changes were put back.');
    expect(ran('switch')).toBe(false);
  });

  it('going back to the source first when the switch failed halfway', async () => {
    const { deps, lines, branch, pending } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { switchTo: '/main/task2' } });

    await expect(switchTo(deps, 'br:/main/task2', 'bring')).rejects.toThrow('Access to the path is denied. Your changes were put back.');
    expect(writes(lines())).toEqual(['shelveset create', 'undo -r', 'switch br:/main/task2', 'switch br:/main/task1', 'merge sh:7', 'shelveset delete']);
    expect(branch()).toBe('/main/task1');
    expect(pending()).toEqual(EDITED_AND_ADDED);
    expect(addedFileIsHere()).toBe(true);
  });

  it("or says where to go to restore them when it can't go back", async () => {
    const { deps, recordOf, shelves } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { switchTo: '/main/task2', switchBack: true } });

    await expect(switchTo(deps, 'br:/main/task2', 'bring')).rejects.toThrow(
      'Access to the path is denied. Your changes are safe in shelve 7; switch back to /main/task1 to restore them.',
    );
    expect(shelves()).toEqual([7]);
    // Offered as left changes once the workspace is back on the source.
    expect(recordOf(7)).toMatchObject({ mode: 'leave', source: { spec: 'br:/main/task1' } });
  });

  it("or offers them in Changes when they don't merge back cleanly", async () => {
    const { deps, recordOf, shelves } = workspaceWith({ pending: EDITED_AND_ADDED, fail: { switchTo: '/main/task2', shelveConflicts: 1 } });

    await expect(switchTo(deps, 'br:/main/task2', 'bring')).rejects.toThrow('Access to the path is denied. Your changes are safe in shelve 7; restore them from Changes.');
    expect(shelves()).toEqual([7]);
    expect(recordOf(7)).toMatchObject({ mode: 'leave' });
  });
});

describe('arriving where changes were left', () => {
  /** Changes left on /main/task2 earlier, by this app. */
  async function leftOnTask2(options: { restoreLeftChangesAutomatically: boolean }) {
    const workspace = workspaceWith({ branch: '/main/task2', pending: { 'src/b.txt': 'CH' } }, options);
    await switchTo(workspace.deps, 'br:/main/task1', 'leave');
    return workspace;
  }

  it('restores them right away when the setting allows it and they apply cleanly', async () => {
    const { deps, pending, recordOf } = await leftOnTask2({ restoreLeftChangesAutomatically: true });

    expect(await switchTo(deps, 'br:/main/task2')).toEqual({ kind: 'switched', restored: { count: 1 } });
    expect(pending()).toEqual({ 'src/b.txt': 'CH' });
    expect(recordOf(7)).toBeUndefined();
  });

  it('leaves them for "Welcome back" when the setting says so', async () => {
    const { deps, pending, recordOf } = await leftOnTask2({ restoreLeftChangesAutomatically: false });

    expect(await switchTo(deps, 'br:/main/task2')).toEqual({ kind: 'switched' });
    expect(pending()).toEqual({});
    expect(recordOf(7)).toBeDefined();
  });

  it("asks the server nothing about left changes when this app left none there", async () => {
    const { deps, ran } = workspaceWith({}, { restoreLeftChangesAutomatically: true });

    await switchTo(deps, 'br:/main/task2');
    expect(ran('find shelve')).toBe(false);
  });
});
