import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateConflict, UpdateResolutions } from '@shared/domain/incoming';
import { change, changesetsFound, diffRecord, pendingStatus, statusHeader } from '../testing/cmOutput';
import { recordingContext, scriptedCm } from '../testing/scriptedCm';
import { unresolvedConflicts, updateWithMerge } from './updateWithMerge';

// Writing in a later second than `cm` is `waitForNextSecond`'s own guarantee (nextSecond.test.ts): here it costs a real second.
vi.mock('../files/nextSecond', () => ({ waitForNextSecond: async () => {} }));

const conflict = (path: string): UpdateConflict => ({ path, isBinary: false, baseRevisionId: 1, incomingRevisionId: 2, repository: 'game@local' });

describe('unresolvedConflicts', () => {
  it('lists the files that need merging and have no resolution yet', () => {
    const conflicts = [conflict('a.ts'), conflict('b.ts')];
    expect(unresolvedConflicts(conflicts, { 'a.ts': { choice: 'source' } })).toEqual([conflict('b.ts')]);
    expect(unresolvedConflicts(conflicts, { 'a.ts': { choice: 'source' }, 'b.ts': { choice: 'text', text: 'merged\n' } })).toEqual([]);
  });

  it('takes no resolutions as none resolved, so shelving what blocks an update stops before updating', () => {
    expect(unresolvedConflicts([conflict('a.ts')], null)).toEqual([conflict('a.ts')]);
    expect(unresolvedConflicts([], null)).toEqual([]);
  });
});

const FILES = ['a.txt', 'b.txt', 'c.txt'];

interface Branch {
  /** What the branch changed since the loaded changeset, as `cm diff` records. */
  incoming: string;
  /** Updating fails with this message. */
  failUpdate?: string;
}

/**
 * A workspace on /main at changeset 1 whose files a, b and c are changed locally (a checked out), while changeset 2
 * on /main changed the files `incoming` names. Undoing a file writes the loaded revision; updating writes changeset 2's.
 */
function updatingCm(workspacePath: string, { incoming, failUpdate }: Branch) {
  const file = (name: string): string => join(workspacePath, 'src', name);
  return scriptedCm({
    'status --header --xml': statusHeader('/main'),
    'find changeset': changesetsFound('/main', { id: 2, owner: 'ana' }),
    'diff cs:1 cs:2': incoming,
    'status --xml --controlledchanged --changed': pendingStatus(change('CO+CH', 'src/a.txt'), change('CH', 'src/b.txt'), change('CH', 'src/c.txt')),
    'status --xml --checkout': pendingStatus(change('CO+CH', 'src/a.txt')),
    undo: async (args) => {
      for (const path of args.slice(1)) await writeFile(path, 'loaded\n');
      return '';
    },
    update: async () => {
      if (failUpdate) throw new Error(failUpdate);
      for (const name of FILES) await writeFile(file(name), `incoming ${name}\n`);
      return '';
    },
    checkout: '',
  });
}

const changedOnBranch = FILES.map((name) => diffRecord('C', `src/${name}`, { base: 1, revision: 2 })).join('');

let workspacePath: string;
let backupsRoot: string;
const read = (name: string): Promise<string> => readFile(join(workspacePath, 'src', name), 'utf8');

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), 'uvcs-update-'));
  workspacePath = join(root, 'wk');
  backupsRoot = join(root, 'backups');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  for (const name of FILES) await writeFile(join(workspacePath, 'src', name), `mine ${name}\n`);
});

const resolved: UpdateResolutions = {
  'src/a.txt': { choice: 'text', text: 'combined\n' },
  'src/b.txt': { choice: 'destination' },
  'src/c.txt': { choice: 'source' },
};

describe('updateWithMerge', () => {
  it("updates, then leaves each file as decided: the user's text, their own version, or the incoming one", async () => {
    const { cm } = updatingCm(workspacePath, { incoming: changedOnBranch });

    const { backupDirectory } = await updateWithMerge(cm, workspacePath, resolved, backupsRoot, recordingContext().context);

    expect([await read('a.txt'), await read('b.txt'), await read('c.txt')]).toEqual(['combined\n', 'mine b.txt\n', 'incoming c.txt\n']);
    // The local versions stay saved, just in case.
    expect(backupDirectory!.startsWith(backupsRoot)).toBe(true);
    expect(await readFile(join(backupDirectory!, 'src', 'c.txt'), 'utf8')).toBe('mine c.txt\n');
  });

  it('undoes only the conflicting files before updating, and checks out again those that were checked out', async () => {
    const { cm, lines } = updatingCm(workspacePath, { incoming: changedOnBranch });

    await updateWithMerge(cm, workspacePath, resolved, backupsRoot, recordingContext().context);

    const path = (name: string): string => join(workspacePath, 'src', name);
    expect(lines().filter((line) => /^(undo|update|checkout)/.test(line))).toEqual([
      `undo ${path('a.txt')} ${path('b.txt')} ${path('c.txt')}`,
      expect.stringMatching(/^update /),
      `checkout ${path('a.txt')}`,
    ]);
  });

  it('puts the local versions back when the update fails: nothing is lost', async () => {
    const { cm } = updatingCm(workspacePath, { incoming: changedOnBranch, failUpdate: 'The server is unreachable.' });

    await expect(updateWithMerge(cm, workspacePath, resolved, backupsRoot, recordingContext().context)).rejects.toThrow(
      'The server is unreachable. Your local changes were put back; nothing was lost.',
    );
    expect([await read('a.txt'), await read('b.txt'), await read('c.txt')]).toEqual(['mine a.txt\n', 'mine b.txt\n', 'mine c.txt\n']);
  });

  it('touches nothing while a conflicting file has no decision', async () => {
    const { cm, ran } = updatingCm(workspacePath, { incoming: changedOnBranch });

    await expect(updateWithMerge(cm, workspacePath, { 'src/a.txt': { choice: 'source' } }, backupsRoot, recordingContext().context)).rejects.toThrow(
      'Resolve src/b.txt, src/c.txt before updating.',
    );
    expect(ran('undo') || ran('update')).toBe(false);
  });

  it('refuses local changes to files the branch deleted or moved: an update cannot merge them', async () => {
    const { cm, ran } = updatingCm(workspacePath, { incoming: diffRecord('D', 'src/b.txt', { revision: 2 }) });

    await expect(updateWithMerge(cm, workspacePath, {}, backupsRoot, recordingContext().context)).rejects.toThrow(
      'Check in, shelve or undo your changes to src/b.txt first: the branch deleted or moved them.',
    );
    expect(ran('update')).toBe(false);
  });

  it('just updates, cancellably, when nothing needs merging', async () => {
    const { cm, commands } = updatingCm(workspacePath, { incoming: diffRecord('A', 'src/new.txt') });
    const { context } = recordingContext();

    expect(await updateWithMerge(cm, workspacePath, {}, backupsRoot, context)).toEqual({ backupDirectory: null });
    const update = commands.find((command) => command.args[0] === 'update')!;
    expect(update.route).toBe('execute');
    expect(update.options.signal).toBe(context.signal);
  });
});
