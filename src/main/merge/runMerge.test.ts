import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MergeRequest, MergeResolutions } from '@shared/domain/merge';
import { changedStatus, mergeOutput, mergePreviewOutput, statusHeader, treeListing } from '../cm/testing/cmOutput';
import { statusRecordsArgs } from '../cm/pendingChangesRecords';
import { fakeCat, PURGED } from '../cm/testing/fakeCat';
import { cmFails, fakeCmClient, optionValue, type CmAnswer } from '../cm/testing/fakeCmClient';
import { recordingContext } from '../operations/testing/recordingContext';
import { mergeStateFilesIn, type MergeStateFiles } from './mergeStateFiles';
import { runMerge } from './runMerge';

const FROM_TASK: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task' };
const TO_MAIN: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' };

const CONTRIBUTORS = [
  ['CONTRIBUTOR', 'SRC', '3', 'cs:3@eco@local', '/main/task'],
  ['CONTRIBUTOR', 'DST', '4', 'cs:4@eco@local', '/main'],
  ['CONTRIBUTOR', 'BASE', '1', 'cs:1@eco@local', '/main'],
];
const fileConflict = (path: string, itemId: number): string[] => ['FILE_CONFLICT', `/${path}`, '1', '3', '4', String(itemId)];
const EVIL_TWIN = ['DIR_CONFLICT', 'EVIL', 'Evil twin conflict', 'Two items, one name.', 'Added /src/twin.txt', 'Added /src/twin.txt', '45', 'False', 'ADD', '/src/twin.txt', 'ADD', '/src/twin.txt'];

const noDecisions: MergeResolutions = { files: {} };

/**
 * A `cm` merging /main/task: the preview prints `plan` (the merge after the decisions in the state files it's given,
 * if any), and the final `--merge` prints `finalOutput`, writing its state files as `cm` does.
 */
function mergingCm(plan: string[][], { finalOutput = '', pending = changedStatus() } = {}) {
  const merge: CmAnswer = async ({ args }) => {
    if (!args.includes('--merge')) return mergePreviewOutput(...CONTRIBUTORS, ...plan);
    await writeFile(optionValue(args, '--solvedconflictsfile=')!, 'merged');
    return finalOutput;
  };
  return fakeCmClient({
    status: pending,
    'merge br:/main/task': merge,
    ls: treeListing('eco@local', 'src/a.txt', 'src/b.txt', 'src/c.txt'),
    cat: fakeCat(() => 'incoming version\n'),
    'status --header --xml': statusHeader('/main', { changeset: 4 }),
  });
}

let workspacePath: string;

/** The state files the merge page's directory decisions left (`DirectoryDecisions`), holding `solved`. */
async function decidedState(solved: string): Promise<MergeStateFiles> {
  const state = mergeStateFilesIn(await mkdtemp(join(tmpdir(), 'uvcs-decided-')));
  await writeFile(state.result, 'merge result');
  await writeFile(state.solved, solved);
  return state;
}

beforeEach(async () => {
  workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-merge-'));
  await mkdir(join(workspacePath, 'src'));
  for (const name of ['a.txt', 'b.txt', 'c.txt']) await writeFile(join(workspacePath, 'src', name), `mine ${name}\n`);
});

/** The `cm merge --merge` that applies everything. */
const finalMerge = (lines: string[]): string | undefined => lines.find((line) => line.includes(' --merge'));

describe('runMerge into the workspace', () => {
  it("never lets cm decide a conflicting file: it keeps the destination, without cm's interactive resolution", async () => {
    const { cm, commands } = mergingCm([fileConflict('src/a.txt', 30)]);

    await runMerge(cm, workspacePath, FROM_TASK, { files: { '/src/a.txt': { choice: 'destination' } } }, recordingContext().context);

    const merge = commands.find((command) => command.line === finalMerge([command.line]))!;
    expect(merge.via).toBe('execute');
    expect(merge.args).toEqual(expect.arrayContaining(['--keepdestination', '--nointeractiveresolution', '--machinereadable']));
  });

  it("writes each file's decision once cm merged: the user's text, the incoming version, or the workspace's left as it is", async () => {
    const { cm, lines } = mergingCm([fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31), fileConflict('src/c.txt', 32)]);
    const resolutions: MergeResolutions = {
      files: { '/src/a.txt': { choice: 'text', text: 'combined\n' }, '/src/b.txt': { choice: 'source' }, '/src/c.txt': { choice: 'destination' } },
    };

    expect(await runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext().context)).toEqual({});

    expect(await readFile(join(workspacePath, 'src', 'a.txt'), 'utf8')).toBe('combined\n');
    expect(await readFile(join(workspacePath, 'src', 'b.txt'), 'utf8')).toBe('incoming version\n');
    expect(await readFile(join(workspacePath, 'src', 'c.txt'), 'utf8')).toBe('mine c.txt\n');
    // The incoming version is the source's revision of that item, in the repository `cm ls` named.
    expect(lines()).toContain(`cat itemid:31#cs:3@eco@local --file=${join(workspacePath, 'src', 'b.txt')}`);
  });

  it("writes the incoming text the page already read instead of asking cm for it; the others' still come from cm cat", async () => {
    const { cm, lines } = mergingCm([fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31)]);
    const resolutions: MergeResolutions = {
      files: { '/src/a.txt': { choice: 'source', text: 'incoming as read\n' }, '/src/b.txt': { choice: 'source' } },
    };

    await runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext().context);

    expect(await readFile(join(workspacePath, 'src', 'a.txt'), 'utf8')).toBe('incoming as read\n');
    expect(lines().filter((line) => line.startsWith('cat'))).toEqual([`cat itemid:31#cs:3@eco@local --file=${join(workspacePath, 'src', 'b.txt')}`]);
  });

  it('writes every incoming version it has no text of (binaries) with one cm cat in a process of its own, however many', async () => {
    const { cm, commands } = mergingCm([fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31), fileConflict('src/c.txt', 32)]);
    const resolutions: MergeResolutions = {
      files: { '/src/a.txt': { choice: 'source' }, '/src/b.txt': { choice: 'source' }, '/src/c.txt': { choice: 'destination' } },
    };

    await runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext().context);

    const cats = commands.filter((command) => command.args[0] === 'cat');
    expect(cats.map(({ args, via }) => ({ args, via }))).toEqual([
      { args: ['cat', `itemid:30#cs:3@eco@local;${join(workspacePath, 'src', 'a.txt')}`, `itemid:31#cs:3@eco@local;${join(workspacePath, 'src', 'b.txt')}`], via: 'execute' },
    ]);
    expect(await readFile(join(workspacePath, 'src', 'a.txt'), 'utf8')).toBe('incoming version\n');
    expect(await readFile(join(workspacePath, 'src', 'b.txt'), 'utf8')).toBe('incoming version\n');
    expect(await readFile(join(workspacePath, 'src', 'c.txt'), 'utf8')).toBe('mine c.txt\n');
  });

  it("writes the base kept: its text as the page read it, else the base's revision, in the incoming versions' cm cat", async () => {
    const { cm, commands } = fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': ({ args }) =>
        args.includes('--merge') ? '' : mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31), fileConflict('src/c.txt', 32)),
      ls: treeListing('eco@local', 'src/a.txt', 'src/b.txt', 'src/c.txt'),
      cat: fakeCat((spec) => (spec.includes('#cs:1@') ? 'base version\n' : 'incoming version\n')),
    });
    const resolutions: MergeResolutions = {
      files: { '/src/a.txt': { choice: 'base', text: 'base as read\n' }, '/src/b.txt': { choice: 'base' }, '/src/c.txt': { choice: 'source' } },
    };

    expect(await runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext().context)).toEqual({});

    expect(await readFile(join(workspacePath, 'src', 'a.txt'), 'utf8')).toBe('base as read\n');
    expect(await readFile(join(workspacePath, 'src', 'b.txt'), 'utf8')).toBe('base version\n');
    expect(await readFile(join(workspacePath, 'src', 'c.txt'), 'utf8')).toBe('incoming version\n');
    // The base is that item at the base's changeset, the plan's contributor: one cm cat with the incoming version.
    expect(commands.filter((command) => command.args[0] === 'cat').map(({ args }) => args)).toEqual([
      ['cat', `itemid:31#cs:1@eco@local;${join(workspacePath, 'src', 'b.txt')}`, `itemid:32#cs:3@eco@local;${join(workspacePath, 'src', 'c.txt')}`],
    ]);
  });

  it("names a base kept that couldn't be saved among the files that still hold yours", async () => {
    const { cm } = fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': ({ args }) => (args.includes('--merge') ? '' : mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/a.txt', 30))),
      ls: treeListing('eco@local', 'src/a.txt'),
      cat: fakeCat(() => undefined),
    });

    expect(await runMerge(cm, workspacePath, FROM_TASK, { files: { '/src/a.txt': { choice: 'base' } } }, recordingContext().context)).toEqual({
      keptVersionNotSaved: ['/src/a.txt'],
    });
  });

  it('writes every incoming version kept even when cancelled once cm merged: the merge is in the workspace by then', async () => {
    const cancel = new AbortController();
    const { cm } = fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': ({ args }) => {
        if (!args.includes('--merge')) return mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31));
        cancel.abort();
        return '';
      },
      ls: treeListing('eco@local', 'src/a.txt', 'src/b.txt'),
      cat: (command) => (command.options.signal?.aborted ? cmFails('Cancelled') : fakeCat(() => 'incoming version\n')(command)),
    });
    const resolutions: MergeResolutions = { files: { '/src/a.txt': { choice: 'source' }, '/src/b.txt': { choice: 'source' } } };

    await runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext(cancel.signal).context);

    expect(await readFile(join(workspacePath, 'src', 'a.txt'), 'utf8')).toBe('incoming version\n');
    expect(await readFile(join(workspacePath, 'src', 'b.txt'), 'utf8')).toBe('incoming version\n');
  });

  it("completes, naming the files that still hold yours, when cm couldn't save their incoming version: the merge is in the workspace", async () => {
    const { cm } = fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': ({ args }) => (args.includes('--merge') ? '' : mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31))),
      ls: treeListing('eco@local', 'src/a.txt', 'src/b.txt'),
      cat: fakeCat((spec) => (spec.startsWith('itemid:30#') ? 'incoming version\n' : undefined)),
    });
    const resolutions: MergeResolutions = { files: { '/src/a.txt': { choice: 'source' }, '/src/b.txt': { choice: 'source' } } };

    expect(await runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext().context)).toEqual({ keptVersionNotSaved: ['/src/b.txt'] });
    expect(await readFile(join(workspacePath, 'src', 'a.txt'), 'utf8')).toBe('incoming version\n');
  });

  /** A `cm` merging two kept incoming files, a.txt and b.txt, whose `cm cat` answers `cat`. */
  const keepingTwoIncoming = (cat: CmAnswer) =>
    fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': ({ args }) => (args.includes('--merge') ? '' : mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31))),
      ls: treeListing('eco@local', 'src/a.txt', 'src/b.txt'),
      cat,
    });
  const bothIncoming: MergeResolutions = { files: { '/src/a.txt': { choice: 'source' }, '/src/b.txt': { choice: 'source' } } };

  it('tries a cm cat that failed naming none once more, and says its files may not hold the incoming version when it fails again', async () => {
    const { cm, lines } = keepingTwoIncoming(cmFails('The connection was closed.'));

    expect(await runMerge(cm, workspacePath, FROM_TASK, bothIncoming, recordingContext().context)).toEqual({ keptVersionMaybeNotSaved: ['/src/a.txt', '/src/b.txt'] });
    expect(lines().filter((line) => line.startsWith('cat'))).toHaveLength(2);
  });

  it('saves every incoming version when a cm cat that failed naming none works the second time', async () => {
    let attempts = 0;
    const { cm } = keepingTwoIncoming((command) => (attempts++ === 0 ? cmFails('The connection was closed.') : fakeCat(() => 'incoming version\n')(command)));

    expect(await runMerge(cm, workspacePath, FROM_TASK, bothIncoming, recordingContext().context)).toEqual({});
    expect(await readFile(join(workspacePath, 'src', 'b.txt'), 'utf8')).toBe('incoming version\n');
  });

  it('says a file whose incoming version was purged does not hold it, with one cm cat: the line names its file', async () => {
    const { cm, lines } = keepingTwoIncoming(fakeCat((spec) => (spec.startsWith('itemid:30#') ? PURGED : 'incoming version\n')));

    expect(await runMerge(cm, workspacePath, FROM_TASK, bothIncoming, recordingContext().context)).toEqual({ keptVersionNotSaved: ['/src/a.txt'] });
    expect(lines().filter((line) => line.startsWith('cat'))).toHaveLength(1);
    expect(await readFile(join(workspacePath, 'src', 'b.txt'), 'utf8')).toBe('incoming version\n');
  });

  it("doesn't take a revision cm couldn't find for the only failure when another line names none", async () => {
    const { cm } = keepingTwoIncoming(cmFails('The specified revision was not found itemid:30#cs:3@eco@local\nError downloading a revision.'));

    expect(await runMerge(cm, workspacePath, FROM_TASK, bothIncoming, recordingContext().context)).toEqual({
      keptVersionNotSaved: ['/src/a.txt'],
      keptVersionMaybeNotSaved: ['/src/b.txt'],
    });
  });

  it('reads the incoming version of a shelve from the shelve, whose revisions no changeset holds', async () => {
    const { cm, lines } = fakeCmClient({
      status: changedStatus(),
      'merge sh:7': ({ args }) => (args.includes('--merge') ? '' : mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/b.txt', 31))),
      ls: treeListing('eco@local', 'src/b.txt'),
      cat: '',
    });

    await runMerge(cm, workspacePath, { kind: 'merge', sourceSpec: 'sh:7' }, { files: { '/src/b.txt': { choice: 'source' } } }, recordingContext().context);
    expect(lines()).toContain(`cat itemid:31#sh:7@eco@local --file=${join(workspacePath, 'src', 'b.txt')}`);
  });

  it('goes on from the directory decisions the page applied: it previews and merges on a copy of their state, solving none again', async () => {
    const { cm, commands } = mergingCm([fileConflict('src/a.txt', 30)]);
    const decided = await decidedState('DIV_MV src');

    await runMerge(cm, workspacePath, FROM_TASK, { directoryDecisionsId: 'page-1', files: { '/src/a.txt': { choice: 'destination' } } }, recordingContext().context, {
      state: decided,
      known: [],
    });

    const merges = commands.filter((command) => command.args[0] === 'merge');
    const stateOf = ({ args }: { args: string[] }) => ({ result: optionValue(args, '--mergeresultfile='), solved: optionValue(args, '--solvedconflictsfile=') });
    expect(merges.map(stateOf)).toEqual([stateOf(merges[0]!), stateOf(merges[0]!)]);
    expect(stateOf(merges[0]!).solved).not.toBe(decided.solved);
    expect(merges.some((command) => command.args.includes('--resolveconflict'))).toBe(false);
    // The page's own state stays as its decisions left it, for another merge should this one fail.
    expect(await readFile(decided.solved, 'utf8')).toBe('DIV_MV src');
  });

  it("merges a file conflict a directory decision moved where the destination's tree has no such path, as the item listed before", async () => {
    // Kept where the source moved its folder: /moved isn't in the destination's tree, so `cm ls` of it would fail.
    const { cm, commands } = mergingCm([fileConflict('moved/a.txt', 30)]);
    const before = { path: '/src/a.txt', destinationPath: '/src/a.txt', itemId: 30, baseChangeset: 1, sourceChangeset: 3, destinationChangeset: 4, repository: 'eco@local', destinationRevisionId: 40, destinationIsBinary: false };

    await runMerge(cm, workspacePath, FROM_TASK, { directoryDecisionsId: 'page-1', files: { '/moved/a.txt': { choice: 'destination' } } }, recordingContext().context, {
      state: await decidedState('DIV_MV src'),
      known: [before],
    });

    expect(commands.filter((command) => command.args[0] === 'ls')).toEqual([]);
    expect(finalMerge(commands.map((command) => command.line))).toBeDefined();
  });

  it("saves the incoming version of a file conflict a decision revealed where the destination's tree has no such path", async () => {
    await mkdir(join(workspacePath, 'src', 'game'));
    const { cm, lines } = fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': async ({ args }) => {
        if (!args.includes('--merge')) return mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/game/Enemy.cs', 41));
        await writeFile(optionValue(args, '--solvedconflictsfile=')!, 'merged');
        return '';
      },
      ls: ({ args }) => (optionValue(args, '--tree=') === 'cs:4' ? cmFails("Can't resolve the selector for the item /src/game/Enemy.cs") : treeListing('eco@local', 'src/game/Enemy.cs')),
      cat: fakeCat(() => 'incoming version\n'),
    });

    await runMerge(cm, workspacePath, FROM_TASK, { directoryDecisionsId: 'page-1', files: { '/src/game/Enemy.cs': { choice: 'source' } } }, recordingContext().context, {
      state: await decidedState('EVIL src'),
      known: [],
    });

    expect(lines()).toContain(`cat itemid:41#cs:3@eco@local --file=${join(workspacePath, 'src', 'game', 'Enemy.cs')}`);
    expect(await readFile(join(workspacePath, 'src', 'game', 'Enemy.cs'), 'utf8')).toBe('incoming version\n');
  });

  it('stops before merging while a directory conflict has no decision', async () => {
    const { cm, lines } = mergingCm([EVIL_TWIN, fileConflict('src/a.txt', 30)]);

    await expect(runMerge(cm, workspacePath, FROM_TASK, { files: { '/src/a.txt': { choice: 'source' } } }, recordingContext().context)).rejects.toThrow(
      'Every directory conflict needs a decision before merging.',
    );
    expect(finalMerge(lines())).toBeUndefined();
  });

  it('runs nothing when a conflict has no decision, so no file is left half-merged', async () => {
    const { cm, lines } = mergingCm([fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31)]);

    await expect(runMerge(cm, workspacePath, FROM_TASK, { files: { '/src/a.txt': { choice: 'source' } } }, recordingContext().context)).rejects.toThrow(
      'Resolve /src/b.txt before merging.',
    );
    expect(finalMerge(lines())).toBeUndefined();
  });

  it('refuses to merge into a workspace with pending changes, without asking cm for the merge', async () => {
    const { cm, lines } = mergingCm([], { pending: changedStatus('src/a.txt') });

    await expect(runMerge(cm, workspacePath, FROM_TASK, noDecisions, recordingContext().context)).rejects.toThrow(/pending changes/);
    expect(lines()).toEqual([statusRecordsArgs('--controlledchanged', '--changed', '--localdeleted').join(' ')]);
  });

  it('refuses when there is nothing to merge', async () => {
    const { cm, lines } = mergingCm([['STATUS', 'ALREADY_CONNECTED', 'No merges detected']]);

    await expect(runMerge(cm, workspacePath, FROM_TASK, noDecisions, recordingContext().context)).rejects.toThrow(/nothing to merge/);
    expect(finalMerge(lines())).toBeUndefined();
  });

  it('can be stopped while cm merges: the merge process gets the operation signal', async () => {
    const { cm, commands } = mergingCm([]);
    const { context } = recordingContext(new AbortController().signal);

    await runMerge(cm, workspacePath, FROM_TASK, noDecisions, context);
    expect(commands.find((command) => command.args.includes('--merge'))!.options.signal).toBe(context.signal);
  });
});

describe('runMerge into a server branch', () => {
  const serverCm = (finalOutput: string, onMerge: (args: string[]) => Promise<void> = async () => {}) =>
    fakeCmClient({
      'merge br:/main/task': async ({ args }) => {
        if (!args.includes('--merge')) return mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31));
        await onMerge(args);
        return finalOutput;
      },
      ls: treeListing('eco@local', 'src/a.txt', 'src/b.txt'),
    });
  const keepSource: MergeResolutions = { files: { '/src/a.txt': { choice: 'source' }, '/src/b.txt': { choice: 'source' } }, comment: 'Merge task\ninto main' };

  it('merges on the server with the comment from a file and each file\'s decision, and names the changeset made', async () => {
    let comment = '';
    let fileConflictResolutions: unknown;
    const { cm, lines } = serverCm(mergeOutput(['CHANGESET', 'cs:12@/main@eco@local']), async (args) => {
      comment = await readFile(optionValue(args, '--commentsfile=')!, 'utf8');
      fileConflictResolutions = JSON.parse(await readFile(optionValue(args, '--fileconflictsresolutionsfile=')!, 'utf8'));
    });

    expect(await runMerge(cm, workspacePath, TO_MAIN, keepSource, recordingContext().context)).toEqual({ changesetId: 12 });
    expect(comment).toBe('Merge task\ninto main');
    expect(fileConflictResolutions).toEqual({ resolutions: [{ path: '/src/a.txt', keep: 'source' }, { path: '/src/b.txt', keep: 'source' }] });
    const merge = finalMerge(lines())!;
    expect(merge).toMatch(/--to=br:\/main --merge --fileconflictsresolutionsfile=\S+ --nointeractiveresolution/);
    // Nothing to check in the workspace: it isn't touched, and the preview asked nothing about its pending changes.
    expect(lines().some((line) => line.startsWith('status') || line.startsWith('cat'))).toBe(false);
  });

  it('tells when someone checked in on the destination meanwhile, so the merge has to be finished', async () => {
    const { cm } = serverCm(mergeOutput(['CHANGESET', 'cs:12@/main@eco@local'], ['MERGE_NEEDED', '13', '/main', 'eco', 'local']));

    expect(await runMerge(cm, workspacePath, TO_MAIN, keepSource, recordingContext().context)).toEqual({ changesetId: 12, destinationMoved: true });
  });

  it('applies a different decision to each file: a merged text goes to cm in a file, the other side by name', async () => {
    let resultText = '';
    let fileConflictResolutions: { resolutions: { path: string; keep?: string; resultFile?: string }[] } = { resolutions: [] };
    const { cm } = serverCm(mergeOutput(['CHANGESET', 'cs:12@/main@eco@local']), async (args) => {
      fileConflictResolutions = JSON.parse(await readFile(optionValue(args, '--fileconflictsresolutionsfile=')!, 'utf8'));
      resultText = await readFile(fileConflictResolutions.resolutions[0]!.resultFile!, 'utf8');
    });
    const mixed: MergeResolutions = {
      files: { '/src/a.txt': { choice: 'text', text: 'mine and theirs\n' }, '/src/b.txt': { choice: 'destination' } },
    };

    expect(await runMerge(cm, workspacePath, TO_MAIN, mixed, recordingContext().context)).toEqual({ changesetId: 12 });
    expect(fileConflictResolutions.resolutions.map(({ path, keep }) => ({ path, keep }))).toEqual([
      { path: '/src/a.txt', keep: undefined },
      { path: '/src/b.txt', keep: 'destination' },
    ]);
    expect(resultText).toBe('mine and theirs\n');
  });

  it("keeps the base in a result file, cm can't keep it by name: its text as read, else the base's revision saved by one cm cat first", async () => {
    let resultFiles: Record<string, string> = {};
    const { cm, commands } = fakeCmClient({
      'merge br:/main/task': async ({ args }) => {
        if (!args.includes('--merge')) return mergePreviewOutput(...CONTRIBUTORS, fileConflict('src/a.txt', 30), fileConflict('art/b.png', 31), fileConflict('art/c.png', 32));
        const { resolutions } = JSON.parse(await readFile(optionValue(args, '--fileconflictsresolutionsfile=')!, 'utf8')) as { resolutions: { path: string; resultFile: string }[] };
        for (const { path, resultFile } of resolutions) resultFiles[path] = await readFile(resultFile, 'utf8');
        return mergeOutput(['CHANGESET', 'cs:12@/main@eco@local']);
      },
      ls: treeListing('eco@local', 'src/a.txt', 'art/b.png', 'art/c.png'),
      cat: fakeCat((spec) => ({ 'itemid:31#cs:1@eco@local': 'base b', 'itemid:32#cs:1@eco@local': 'base c' })[spec]),
    });
    const keepBase: MergeResolutions = {
      files: { '/src/a.txt': { choice: 'base', text: 'base as read\n' }, '/art/b.png': { choice: 'base' }, '/art/c.png': { choice: 'base' } },
    };

    expect(await runMerge(cm, workspacePath, TO_MAIN, keepBase, recordingContext().context)).toEqual({ changesetId: 12 });
    expect(resultFiles).toEqual({ '/src/a.txt': 'base as read\n', '/art/b.png': 'base b', '/art/c.png': 'base c' });
    const cats = commands.filter((command) => command.args[0] === 'cat');
    expect(cats.map(({ args, via }) => ({ specs: args.slice(1).map((arg) => arg.split(';')[0]), via }))).toEqual([
      { specs: ['itemid:31#cs:1@eco@local', 'itemid:32#cs:1@eco@local'], via: 'execute' },
    ]);
  });

  it("merges nothing when a base kept can't be saved for cm to check in", async () => {
    const { cm, lines } = fakeCmClient({
      'merge br:/main/task': ({ args }) => (args.includes('--merge') ? '' : mergePreviewOutput(...CONTRIBUTORS, fileConflict('art/b.png', 31))),
      ls: treeListing('eco@local', 'art/b.png'),
      cat: fakeCat(() => undefined),
    });

    await expect(runMerge(cm, workspacePath, TO_MAIN, { files: { '/art/b.png': { choice: 'base' } } }, recordingContext().context)).rejects.toThrow(/b\.png/);
    expect(finalMerge(lines())).toBeUndefined();
  });
});
