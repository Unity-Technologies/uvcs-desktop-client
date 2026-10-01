import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MergeRequest, MergeResolutions } from '@shared/domain/merge';
import { mergeOutput, statusHeader, treeListing } from '../cm/testing/cmOutput';
import { fakeCmClient, optionValue, type CmAnswer } from '../cm/testing/fakeCmClient';
import { recordingContext } from '../operations/testing/recordingContext';
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
const CHANGE_DELETE = ['DIR_CONFLICT', 'CHG_RM', 'Change/Delete conflict', 'Changed and deleted.', 'Modified /src/cd.txt', 'Deleted /src/cd.txt', '29', 'False', 'CHG', '/src/cd.txt', 'RM', '/src/cd.txt'];

const noDecisions: MergeResolutions = { directoryConflicts: [], files: {} };

/**
 * A `cm` merging /main/task: the preview prints `plan`, and each `--resolveconflict` run prints the directory
 * conflicts still left (`remainingAfterSolving`, one list per run). The final `--merge` prints `finalOutput`.
 */
function mergingCm(plan: string[][], { remainingAfterSolving = [] as string[][][], finalOutput = '', pending = '' } = {}) {
  let solved = 0;
  const merge: CmAnswer = ({ args }) => {
    if (args.includes('--resolveconflict')) return mergeOutput(...CONTRIBUTORS, ...(remainingAfterSolving[solved++] ?? []));
    if (args.includes('--merge')) return finalOutput;
    return mergeOutput(...CONTRIBUTORS, ...plan);
  };
  return fakeCmClient({
    'status --short': pending,
    'merge br:/main/task': merge,
    ls: treeListing('eco@local', 'src/a.txt', 'src/b.txt', 'src/c.txt'),
    cat: async ({ args }) => {
      await writeFile(optionValue(args, '--file=')!, 'incoming version\n');
      return '';
    },
    'status --header --xml': statusHeader('/main', { changeset: 4 }),
  });
}

let workspacePath: string;

beforeEach(async () => {
  workspacePath = await mkdtemp(join(tmpdir(), 'uvcs-merge-'));
  await mkdir(join(workspacePath, 'src'));
  for (const name of ['a.txt', 'b.txt', 'c.txt']) await writeFile(join(workspacePath, 'src', name), `mine ${name}\n`);
});

/** The `cm merge --merge` that applies everything; the runs solving directory conflicts carry `--merge` too. */
const finalMerge = (lines: string[]): string | undefined => lines.find((line) => line.includes(' --merge') && !line.includes('--resolveconflict'));

describe('runMerge into the workspace', () => {
  it("never lets cm decide a conflicting file: it keeps the destination, without cm's interactive resolution", async () => {
    const { cm, commands } = mergingCm([fileConflict('src/a.txt', 30)]);

    await runMerge(cm, workspacePath, FROM_TASK, { directoryConflicts: [], files: { '/src/a.txt': { choice: 'destination' } } }, recordingContext().context);

    const merge = commands.find((command) => command.line === finalMerge([command.line]))!;
    expect(merge.via).toBe('execute');
    expect(merge.args).toEqual(expect.arrayContaining(['--keepdestination', '--nointeractiveresolution', '--machinereadable']));
  });

  it("writes each file's decision once cm merged: the user's text, the incoming version, or the workspace's left as it is", async () => {
    const { cm, lines } = mergingCm([fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31), fileConflict('src/c.txt', 32)]);
    const resolutions: MergeResolutions = {
      directoryConflicts: [],
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
      directoryConflicts: [],
      files: { '/src/a.txt': { choice: 'source', text: 'incoming as read\n' }, '/src/b.txt': { choice: 'source' } },
    };

    await runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext().context);

    expect(await readFile(join(workspacePath, 'src', 'a.txt'), 'utf8')).toBe('incoming as read\n');
    expect(lines().filter((line) => line.startsWith('cat'))).toEqual([`cat itemid:31#cs:3@eco@local --file=${join(workspacePath, 'src', 'b.txt')}`]);
  });

  it('reads the incoming version of a shelve from the shelve, whose revisions no changeset holds', async () => {
    const { cm, lines } = fakeCmClient({
      'status --short': '',
      'merge sh:7': ({ args }) => (args.includes('--merge') ? '' : mergeOutput(...CONTRIBUTORS, fileConflict('src/b.txt', 31))),
      ls: treeListing('eco@local', 'src/b.txt'),
      cat: '',
    });

    await runMerge(cm, workspacePath, { kind: 'merge', sourceSpec: 'sh:7' }, { directoryConflicts: [], files: { '/src/b.txt': { choice: 'source' } } }, recordingContext().context);
    expect(lines()).toContain(`cat itemid:31#sh:7@eco@local --file=${join(workspacePath, 'src', 'b.txt')}`);
  });

  it('solves directory conflicts one at a time, each as number 1, before the merge that applies everything', async () => {
    const { cm, lines } = mergingCm([EVIL_TWIN, CHANGE_DELETE], { remainingAfterSolving: [[CHANGE_DELETE], []] });
    const resolutions: MergeResolutions = { directoryConflicts: [{ choice: 'rename', newName: 'twin-2.txt' }, { choice: 'source' }], files: {} };

    await runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext().context);

    const solving = lines().filter((line) => line.includes('--resolveconflict'));
    expect(solving.map((line) => line.slice(line.indexOf('--resolveconflict')))).toEqual([
      '--resolveconflict --conflict=1 --resolutionoption=rename --resolutioninfo=twin-2.txt',
      '--resolveconflict --conflict=1 --resolutionoption=src',
    ]);
    expect(lines().at(-1)).toBe(finalMerge(lines()));
  });

  it('stops before merging when the conflicts left differ from the plan the user reviewed', async () => {
    const { cm, lines } = mergingCm([EVIL_TWIN, CHANGE_DELETE], { remainingAfterSolving: [[EVIL_TWIN]] });
    const resolutions: MergeResolutions = { directoryConflicts: [{ choice: 'destination' }, { choice: 'source' }], files: {} };

    await expect(runMerge(cm, workspacePath, FROM_TASK, resolutions, recordingContext().context)).rejects.toThrow(/merge changed/);
    expect(lines().filter((line) => line.includes('--resolveconflict'))).toHaveLength(1);
    expect(finalMerge(lines())).toBeUndefined();
  });

  it('runs nothing when a conflict has no decision, so no file is left half-merged', async () => {
    const { cm, lines } = mergingCm([fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31)]);

    await expect(runMerge(cm, workspacePath, FROM_TASK, { directoryConflicts: [], files: { '/src/a.txt': { choice: 'source' } } }, recordingContext().context)).rejects.toThrow(
      'Resolve /src/b.txt before merging.',
    );
    expect(finalMerge(lines())).toBeUndefined();
  });

  it('refuses to merge into a workspace with pending changes, without asking cm for the merge', async () => {
    const { cm, lines } = mergingCm([], { pending: 'CH /src/a.txt\n' });

    await expect(runMerge(cm, workspacePath, FROM_TASK, noDecisions, recordingContext().context)).rejects.toThrow(/pending changes/);
    expect(lines()).toEqual(['status --short --controlledchanged --changed --localdeleted']);
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
        if (!args.includes('--merge')) return mergeOutput(...CONTRIBUTORS, fileConflict('src/a.txt', 30), fileConflict('src/b.txt', 31));
        await onMerge(args);
        return finalOutput;
      },
      ls: treeListing('eco@local', 'src/a.txt', 'src/b.txt'),
    });
  const keepSource: MergeResolutions = { directoryConflicts: [], files: { '/src/a.txt': { choice: 'source' }, '/src/b.txt': { choice: 'source' } }, comment: 'Merge task\ninto main' };

  it('merges on the server with the comment from a file and each file\'s decision, and names the changeset made', async () => {
    let comment = '';
    let fileResolutions: unknown;
    const { cm, lines } = serverCm(mergeOutput(['CHANGESET', 'cs:12@/main@eco@local']), async (args) => {
      comment = await readFile(optionValue(args, '--commentsfile=')!, 'utf8');
      fileResolutions = JSON.parse(await readFile(optionValue(args, '--fileconflictsresolutionsfile=')!, 'utf8'));
    });

    expect(await runMerge(cm, workspacePath, TO_MAIN, keepSource, recordingContext().context)).toEqual({ changesetId: 12 });
    expect(comment).toBe('Merge task\ninto main');
    expect(fileResolutions).toEqual({ resolutions: [{ path: '/src/a.txt', keep: 'source' }, { path: '/src/b.txt', keep: 'source' }] });
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
    let fileResolutions: { resolutions: { path: string; keep?: string; resultFile?: string }[] } = { resolutions: [] };
    const { cm } = serverCm(mergeOutput(['CHANGESET', 'cs:12@/main@eco@local']), async (args) => {
      fileResolutions = JSON.parse(await readFile(optionValue(args, '--fileconflictsresolutionsfile=')!, 'utf8'));
      resultText = await readFile(fileResolutions.resolutions[0]!.resultFile!, 'utf8');
    });
    const mixed: MergeResolutions = {
      directoryConflicts: [],
      files: { '/src/a.txt': { choice: 'text', text: 'mine and theirs\n' }, '/src/b.txt': { choice: 'destination' } },
    };

    expect(await runMerge(cm, workspacePath, TO_MAIN, mixed, recordingContext().context)).toEqual({ changesetId: 12 });
    expect(fileResolutions.resolutions.map(({ path, keep }) => ({ path, keep }))).toEqual([
      { path: '/src/a.txt', keep: undefined },
      { path: '/src/b.txt', keep: 'destination' },
    ]);
    expect(resultText).toBe('mine and theirs\n');
  });
});
