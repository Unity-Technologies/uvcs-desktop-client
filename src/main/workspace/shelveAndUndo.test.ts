import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { memorySettings, recordingContext } from '../testing/scriptedCm';
import { LeftChangesFinder } from './leftChanges';
import { shelveAndUndo, shelvedAwayChanges } from './shelveAndUndo';
import { SwitchShelveRecords } from './switchShelveRecords';
import { playAlongWorkspace, type WorkspaceScenario } from './testing/playAlongWorkspace';

const PENDING = { 'src/a.txt': 'CH', 'src/new.txt': 'AD', 'src/other.txt': 'CH' };

let workspacePath: string;

beforeEach(async () => {
  workspacePath = join(await mkdtemp(join(tmpdir(), 'uvcs-shelve-')), 'wk');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(workspacePath, 'src', 'new.txt'), 'added\n');
});

/** A workspace on /main/task1 with a changed file, an added one and another changed file. */
function workspaceWith(scenario: WorkspaceScenario = {}) {
  const workspace = playAlongWorkspace(workspacePath, { pending: PENDING, ...scenario });
  const records = new SwitchShelveRecords(memorySettings());
  const deps = { cm: workspace.cm, records, leftChanges: new LeftChangesFinder(workspace.cm, records), backupsRoot: join(workspacePath, '..', 'backups') };
  const recordOf = (shelveId: number) => records.find({ shelveId, repository: 'eco@local' });
  return { ...workspace, deps, recordOf };
}

const shelve = (deps: ReturnType<typeof workspaceWith>['deps'], paths: string[] | null, comment = 'Half done') =>
  shelveAndUndo(deps, workspacePath, paths, comment, recordingContext().context);

describe('shelveAndUndo', () => {
  it('shelves the chosen changes with the user’s comment and undoes only them, moving the added files aside', async () => {
    const { deps, pending, shelveComment, lines } = workspaceWith();

    expect(await shelve(deps, ['src/a.txt', 'src/new.txt'])).toEqual({ shelveId: 7, count: 2 });

    expect(shelveComment(7)).toBe('Half done');
    expect(pending()).toEqual({ 'src/other.txt': 'CH' });
    expect(existsSync(join(workspacePath, 'src', 'new.txt'))).toBe(false);
    expect(lines()).toContain(`undo ${join(workspacePath, 'src', 'a.txt')} ${join(workspacePath, 'src', 'new.txt')} --symlink`);
  });

  it('records the shelve as shelved away, never as changes left behind for "Welcome back"', async () => {
    const { deps, recordOf } = workspaceWith({ changelists: [{ name: 'UI work', description: 'polish', paths: ['src/a.txt', 'src/other.txt'] }] });

    await shelve(deps, ['src/a.txt', 'src/new.txt']);

    expect([...recordOf(7)!.paths].sort()).toEqual(['src/a.txt', 'src/new.txt']);
    expect(recordOf(7)).toMatchObject({
      reason: 'shelve',
      mode: 'leave',
      backup: { paths: ['src/new.txt'] },
      // Only the shelved paths go back into the changelist when applied.
      changelists: [{ name: 'UI work', description: 'polish', paths: ['src/a.txt'] }],
    });
    expect(await deps.leftChanges.find(workspacePath)).toEqual([]);
  });

  it('shelves and undoes the whole workspace when no paths are given', async () => {
    const { deps, pending, lines } = workspaceWith();

    expect(await shelve(deps, null)).toEqual({ shelveId: 7, count: 3 });
    expect(pending()).toEqual({});
    expect(lines()).toContain(`undo -r ${workspacePath} --symlink`);
  });

  it('comes back whole when the shelve is applied: the added files and the changes', async () => {
    const { deps, pending } = workspaceWith();
    await shelve(deps, null);

    expect(await deps.leftChanges.apply(workspacePath, 7, true, recordingContext().context)).toEqual({ kind: 'applied', count: 3 });
    expect(pending()).toEqual(PENDING);
    expect(existsSync(join(workspacePath, 'src', 'new.txt'))).toBe(true);
  });

  it("refuses a merge in progress before shelving anything: a shelve can't hold it", async () => {
    const { deps, ran } = workspaceWith({ mergingFrom: 3 });

    await expect(shelve(deps, ['src/a.txt'])).rejects.toThrow(/merge in progress/);
    expect(ran('shelveset')).toBe(false);
  });

  it('undoes nothing when the shelve misses a change', async () => {
    const { deps, ran, pending } = workspaceWith({ fail: { shelveMisses: 'src/a.txt' } });

    await expect(shelve(deps, ['src/a.txt'])).rejects.toThrow(/couldn't be shelved/);
    expect(ran('undo')).toBe(false);
    expect(pending()).toEqual(PENDING);
  });

  it('keeps the changes when undoing them fails, and deletes the shelve', async () => {
    const { deps, pending, deletedShelves, recordOf } = workspaceWith({ fail: { undo: 'The file is in use.' } });

    await expect(shelve(deps, ['src/a.txt'])).rejects.toThrow("Couldn't undo the shelved changes: The file is in use. Your changes were put back.");
    expect(pending()).toEqual(PENDING);
    expect(deletedShelves).toEqual([7]);
    expect(recordOf(7)).toBeUndefined();
  });
});

describe('shelvedAwayChanges', () => {
  it('takes the given paths only, or every pending change', () => {
    const changes = [{ path: 'a' }, { path: 'b' }] as Parameters<typeof shelvedAwayChanges>[0];
    expect(shelvedAwayChanges(changes, ['b'])).toEqual([{ path: 'b' }]);
    expect(shelvedAwayChanges(changes, null)).toBe(changes);
  });
});
