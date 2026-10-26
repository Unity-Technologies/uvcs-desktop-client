import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { DirectoryConflict, DirectoryConflictResolution, DirectoryDecision, MergeRequest } from '@shared/domain/merge';
import { mergePlanOf } from '../cm/mergeOutput';
import { changedStatus, mergePreviewOutput, treeListing } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, optionValue, type CmFailure, type FakeCmCommand } from '../cm/testing/fakeCmClient';
import { DirectoryDecisions } from './directoryDecisions';
import { previewMerge } from './previewMerge';

const FROM_FEATURE: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/feature' };
const WORKSPACE = '/work';

const CONTRIBUTORS = [
  ['CONTRIBUTOR', 'SRC', '3', 'cs:3@game@local', '/main/feature'],
  ['CONTRIBUTOR', 'DST', '5', 'cs:5@game@local', '/main'],
  ['CONTRIBUTOR', 'BASE', '1', 'cs:1@game@local', '/main'],
];
// As `cm merge` printed them for a folder moved apart on both sides holding a file changed on both, and a folder
// added on both sides.
const MOVED_APART = ['DIR_CONFLICT', 'DIV_MV', 'Divergent move conflict', 'Moved apart.', 'Moved from /game to /play', 'Moved from /game to /core', '16', 'True', 'MV', '/game', '/play', 'MV', '/game', '/core'];
const ADDED_TWICE = ['DIR_CONFLICT', 'EVIL', 'Evil twin conflict', 'Two items, one name.', 'Added /shared', 'Added /shared', '30', 'True', 'ADD', '/shared', 'ADD', '/shared'];
const playerConflictAt = (folder: string): string[] => ['FILE_CONFLICT', `/${folder}/Player.cs`, '1', '2', '4', '19'];

const [movedApart, addedTwice] = mergePlanOf([MOVED_APART, ADDED_TWICE]).directoryConflicts as [DirectoryConflict, DirectoryConflict];
const decision = (conflict: DirectoryConflict, resolution: DirectoryConflictResolution): DirectoryDecision => ({ conflict, resolution });

/**
 * A `cm` merging /main/feature that keeps its decisions in the state files it's given, as `cm` does: each
 * `--resolveconflict` adds one to them and prints the merge calculated again. Keeping the incoming move takes the
 * player to /play; keeping both shared folders adds the incoming one's file; keeping yours of the folder added on both
 * sides drops the move's conflict (`cm` would, were the moved folder inside it). A name `taken` it refuses. The
 * destination's tree has the player in /core: listing it anywhere else fails, as `cm ls` of a path it doesn't hold.
 */
function decidingCm() {
  const solvedIn = async (args: readonly string[]): Promise<string[]> => {
    const solved = optionValue(args, '--solvedconflictsfile=');
    return solved && existsSync(solved) ? (await readFile(solved, 'utf8')).split('\n').filter(Boolean) : [];
  };
  const planAfter = (solved: readonly string[]): string[][] => {
    const moved = solved.find((one) => one.startsWith('DIV_MV'));
    const records = [...CONTRIBUTORS];
    if (!moved && !solved.includes('EVIL dst')) records.push(MOVED_APART);
    if (!solved.some((one) => one.startsWith('EVIL'))) records.push(ADDED_TWICE);
    if (solved.some((one) => one.startsWith('EVIL rename'))) records.push(['APPLY', 'ADD', '/shared/Config.cs']);
    records.push(playerConflictAt(moved === 'DIV_MV src' ? 'play' : 'core'));
    return records;
  };
  const merge = async ({ args }: FakeCmCommand): Promise<string | CmFailure> => {
    if (args.includes('--resolutioninfo=taken')) return cmFails('The name is taken.');
    const solved = await solvedIn(args);
    if (args.includes('--resolveconflict')) {
      const conflicts = planAfter(solved).filter((record) => record[0] === 'DIR_CONFLICT');
      const conflict = conflicts[Number(optionValue(args, '--conflict=')) - 1]!;
      solved.push([conflict[1], optionValue(args, '--resolutionoption='), optionValue(args, '--resolutioninfo=')].filter(Boolean).join(' '));
      await writeFile(optionValue(args, '--mergeresultfile=')!, 'merge result');
      await writeFile(optionValue(args, '--solvedconflictsfile=')!, solved.join('\n') + '\n');
    }
    return mergePreviewOutput(...planAfter(solved));
  };
  return fakeCmClient({
    status: changedStatus(),
    'merge br:/main/feature': merge,
    ls: ({ args }) => (args.includes('/core/Player.cs') && args.length === 4 ? treeListing('game@local', 'core/Player.cs') : cmFails(`Can't resolve the selector for the item ${args[1]}`)),
  });
}

/** What `cm` keeps solved for the page's decisions, as the merge would run on them; none before any decision. */
async function solvedOf(decisions: DirectoryDecisions, id: string): Promise<string | undefined> {
  return decisions.runOn(id, WORKSPACE, FROM_FEATURE, async (decided) => decided && readFile(decided.state.solved, 'utf8'));
}

const resolving = (commands: FakeCmCommand[]): string[] =>
  commands.filter((command) => command.args.includes('--resolveconflict')).map(({ args }) => args.slice(args.indexOf('--resolveconflict')).join(' '));

describe('DirectoryDecisions', () => {
  it("applies a decision as it's made, with quick reads that never merge: the merge comes back as cm calculates it on that decision", async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);

    const decided = await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);

    expect(decided.plan.fileConflicts.map((conflict) => conflict.path)).toEqual(['/play/Player.cs']);
    expect(decided.plan.directoryConflicts).toEqual([addedTwice]);
    expect(decided.decisions).toEqual([decision(movedApart, { choice: 'source' })]);
    // The merge before any decision, its conflicting files listed in the destination's tree; then the decision, whose
    // conflicting file, moved to where no such path is in that tree, is still the item listed before.
    expect(commands.map((command) => command.args[0])).toEqual(['merge', 'ls', 'merge']);
    expect(decided.plan.fileConflicts[0]).toMatchObject({ path: '/play/Player.cs', repository: 'game@local', destinationRevisionId: 40 });
    expect(resolving(commands)).toEqual(['--resolveconflict --conflict=1 --resolutionoption=src']);
    expect(commands.every((command) => command.via === 'query' && !command.args.includes('--merge'))).toBe(true);
  });

  it("names the conflict decided by its number in cm's list, whatever order the user decides in", async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);

    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(addedTwice, { choice: 'source' }), decision(movedApart, { choice: 'destination' })]);

    expect(resolving(commands)).toEqual(['--resolveconflict --conflict=2 --resolutionoption=src', '--resolveconflict --conflict=1 --resolutionoption=dst']);
  });

  it('applies each next decision on the state the last one left, numbering its conflict as cm listed it last', async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);
    const first = decisions.stateOf('page-1')!;
    commands.length = 0;

    const decided = await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' }), decision(addedTwice, { choice: 'rename', newName: 'shared main' })]);

    expect(resolving(commands)).toEqual(['--resolveconflict --conflict=1 --resolutionoption=rename --resolutioninfo=shared main']);
    expect(decided.plan.changes).toEqual([{ kind: 'added', path: '/shared/Config.cs' }]);
    // In a state of its own, a copy of the first's with this decision: the first's stays as it was.
    const second = decisions.stateOf('page-1')!;
    expect(dirname(second.solved)).not.toBe(dirname(first.solved));
    expect(await readFile(second.solved, 'utf8')).toBe('DIV_MV src\nEVIL rename shared main\n');
    expect(await readFile(first.solved, 'utf8')).toBe('DIV_MV src\n');
  });

  it('changing a decision goes on from the state before it and applies the later ones again, cm keeping no way back', async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' }), decision(addedTwice, { choice: 'source' })]);
    commands.length = 0;

    const decided = await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'destination' }), decision(addedTwice, { choice: 'source' })]);

    expect(resolving(commands)).toEqual(['--resolveconflict --conflict=1 --resolutionoption=dst', '--resolveconflict --conflict=1 --resolutionoption=src']);
    expect(decided.plan.fileConflicts.map((conflict) => conflict.path)).toEqual(['/core/Player.cs']);
    expect(await readFile(decisions.stateOf('page-1')!.solved, 'utf8')).toBe('DIV_MV dst\nEVIL src\n');
  });

  it('drops a decision whose conflict an earlier one took out of the merge', async () => {
    const { cm } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(addedTwice, { choice: 'source' }), decision(movedApart, { choice: 'source' })]);

    const decided = await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(addedTwice, { choice: 'destination' }), decision(movedApart, { choice: 'source' })]);

    expect(decided.decisions).toEqual([decision(addedTwice, { choice: 'destination' })]);
    expect(decided.plan.directoryConflicts).toEqual([]);
  });

  it('gives back the merge as it was once no decision is left, asking cm nothing', async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);
    commands.length = 0;

    const decided = await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', []);

    expect(decided).toEqual({ plan: expect.objectContaining({ directoryConflicts: [movedApart, addedTwice] }), decisions: [] });
    expect(commands).toEqual([]);
    expect(decisions.stateOf('page-1')).toBeUndefined();
  });

  it('starts from the merge the page previewed: the first decision calculates the merge only once', async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    const previewed = await previewMerge(cm, WORKSPACE, FROM_FEATURE);
    decisions.previewed(WORKSPACE, FROM_FEATURE, previewed);
    commands.length = 0;

    const decided = await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);

    expect(commands.map((command) => command.args[0])).toEqual(['merge']);
    expect(decided.plan.fileConflicts[0]).toMatchObject({ path: '/play/Player.cs', destinationPath: '/core/Player.cs' });
  });

  it("fails a decision cm applied to another conflict, as when the preview it was numbered by is out of date", async () => {
    const { cm } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    // Previewed before someone checked in: the folder moved apart was second in the list then, and is first now.
    const previewed = await previewMerge(cm, WORKSPACE, FROM_FEATURE);
    decisions.previewed(WORKSPACE, FROM_FEATURE, { ...previewed, directoryConflicts: [addedTwice, movedApart] });

    await expect(decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })])).rejects.toThrow('The merge changed');
    expect(await solvedOf(decisions, 'page-1')).toBeUndefined();
  });

  it("starts from a merge's own preview only", async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    decisions.previewed(WORKSPACE, { ...FROM_FEATURE, destinationBranch: '/main' }, await previewMerge(cm, WORKSPACE, { ...FROM_FEATURE, destinationBranch: '/main' }));
    commands.length = 0;

    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);

    expect(commands.map((command) => command.args[0])).toEqual(['merge', 'ls', 'merge']);
  });

  it('applies decisions sent together one batch after the other, each from the state the one before left', async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);

    const [first, second] = await Promise.all([
      decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]),
      decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' }), decision(addedTwice, { choice: 'source' })]),
    ]);

    expect(first.decisions).toHaveLength(1);
    expect(second.decisions).toHaveLength(2);
    expect(resolving(commands)).toEqual(['--resolveconflict --conflict=1 --resolutionoption=src', '--resolveconflict --conflict=1 --resolutionoption=src']);
  });

  it('refuses keeping both under a name that is no name, or where one item conflicts, without asking cm', async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);

    await expect(decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(addedTwice, { choice: 'rename', newName: '../shared' })])).rejects.toThrow('is not a valid name');
    await expect(decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'rename', newName: 'core2' })])).rejects.toThrow('keeping both items is not possible');
    expect(commands).toEqual([]);
  });

  it("keeps each page's decisions apart, and starts over when a page's merge is another", async () => {
    const { cm } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-2', [decision(movedApart, { choice: 'destination' })]);

    expect(await readFile(decisions.stateOf('page-1')!.solved, 'utf8')).toBe('DIV_MV src\n');
    expect(await readFile(decisions.stateOf('page-2')!.solved, 'utf8')).toBe('DIV_MV dst\n');

    await decisions.decide(WORKSPACE, { ...FROM_FEATURE, destinationBranch: '/main' }, 'page-1', [decision(addedTwice, { choice: 'source' })]);
    expect(await readFile(decisions.stateOf('page-1')!.solved, 'utf8')).toBe('EVIL src\n');
  });

  it('leaves the decisions applied as they were when changing one fails, as the page still shows them', async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(addedTwice, { choice: 'destination' })]);

    await expect(decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(addedTwice, { choice: 'rename', newName: 'taken' })])).rejects.toThrow('The name is taken.');
    commands.length = 0;
    const decided = await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(addedTwice, { choice: 'destination' })]);

    expect(await readFile(decisions.stateOf('page-1')!.solved, 'utf8')).toBe('EVIL dst\n');
    expect(resolving(commands)).toEqual([]);
    expect(decided.decisions).toEqual([decision(addedTwice, { choice: 'destination' })]);
  });

  it("runs the merge on the page's decisions: the state cm kept and the file conflicts as listed before any decision", async () => {
    const { cm } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);

    const decided = await decisions.runOn('page-1', WORKSPACE, FROM_FEATURE, async (applied) => applied);

    expect(await readFile(decided!.state.solved, 'utf8')).toBe('DIV_MV src\n');
    expect(decided!.known).toEqual([expect.objectContaining({ path: '/core/Player.cs', destinationRevisionId: 40 })]);
    expect(await decisions.runOn(undefined, WORKSPACE, FROM_FEATURE, async (applied) => applied)).toBeUndefined();
    expect(await decisions.runOn('page-2', WORKSPACE, FROM_FEATURE, async (applied) => applied)).toBeUndefined();
  });

  it("refuses to run a merge on another merge's decisions", async () => {
    const { cm } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);
    const work = vi.fn(async () => undefined);

    await expect(decisions.runOn('page-1', WORKSPACE, { ...FROM_FEATURE, destinationBranch: '/main' }, work)).rejects.toThrow('another merge');
    expect(work).not.toHaveBeenCalled();
  });

  it("keeps a page's decisions while a merge runs on them, though the page closes meanwhile", async () => {
    const { cm } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);
    let finish = (): void => undefined;
    let started = (): void => undefined;
    const merging = new Promise<void>((resolve) => (started = resolve));
    const running = decisions.runOn('page-1', WORKSPACE, FROM_FEATURE, (applied) => {
      started();
      return new Promise<string>((resolve) => (finish = () => resolve(applied!.state.solved)));
    });
    await merging;

    const discarded = decisions.discard('page-1');
    finish();
    const solved = await running;

    expect(existsSync(solved)).toBe(true);
    await discarded;
    expect(existsSync(solved)).toBe(false);
  });

  it("deletes a page's decisions once it closes", async () => {
    const { cm } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);
    const folder = dirname(dirname(decisions.stateOf('page-1')!.solved));

    await decisions.discard('page-1');

    expect(existsSync(folder)).toBe(false);
    expect(decisions.stateOf('page-1')).toBeUndefined();
  });

  it('fails as cm does, and the next decision goes on from the ones applied', async () => {
    const { cm, commands } = decidingCm();
    const decisions = new DirectoryDecisions(cm);
    await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' })]);

    await expect(
      decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' }), decision(addedTwice, { choice: 'rename', newName: 'taken' })]),
    ).rejects.toThrow('The name is taken.');
    commands.length = 0;
    const decided = await decisions.decide(WORKSPACE, FROM_FEATURE, 'page-1', [decision(movedApart, { choice: 'source' }), decision(addedTwice, { choice: 'source' })]);

    expect(resolving(commands)).toEqual(['--resolveconflict --conflict=1 --resolutionoption=src']);
    expect(decided.decisions).toHaveLength(2);
  });
});
