import { describe, expect, it } from 'vitest';
import type { DirectoryConflict, DirectoryConflictResolution, MergePlan } from '@shared/domain/merge';
import { layoutGroupedTree } from '../../lib/groupedPathTree';
import { buildMergeItems, fileStateOf, firstWaiting, mergeItemAt, mergeItemGroups, mergeItemsActedOn, mergeItemTones, mergeProgress, needsDecision, type MergeItem } from './mergeItems';
import { resolutionsByConflict } from './directoryConflicts/directoryDecisions';
import type { ConflictedFile, FileConflictState } from './resolve/useFileConflicts';

const side = { operation: 'added' as const, path: '/twin.txt', description: 'Added /twin.txt' };
const twin: DirectoryConflict = { type: 'evilTwin', title: 'Evil twin', explanation: '', itemId: 1, isDirectory: false, source: side, destination: side };
const plan: MergePlan = {
  status: 'ready',
  changes: [{ kind: 'added', path: '/new.txt' }],
  fileConflicts: [],
  directoryConflicts: [twin],
  warnings: [],
};
/** The plan once the twin is decided: `cm` applied it, so the plan no longer lists it. */
const twinDecided = { ...plan, directoryConflicts: [] };
/** Where the twin stands: decided as `resolution`, or waiting. */
const twinResolutions = (resolution?: DirectoryConflictResolution) => resolutionsByConflict(resolution ? [{ conflict: twin, resolution }] : []);

const file: ConflictedFile = { key: '/a.txt', path: 'a.txt', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } };

function fileState(resolved: boolean): FileConflictState {
  return {
    file,
    status: 'ready',
    isBinary: false,
    decidedByUser: resolved,
    resolution: resolved ? { choice: 'source' } : null,
    mergedAutomatically: false,
    remainingConflicts: resolved ? 0 : 1,
  };
}

describe('merge items', () => {
  it('groups the directory conflicts, then the file conflicts, then the changes that apply cleanly, each by path', () => {
    const groups = mergeItemGroups(buildMergeItems({ ...plan, changes: [{ kind: 'added', path: '/src/b.txt' }, { kind: 'changed', path: '/new.txt' }] }, [], [file]));
    expect(groups.map((group) => [group.key, group.label, group.sorted.map((item) => item.path)])).toEqual([
      ['group:directoryConflicts', 'Directory conflicts', ['twin.txt']],
      ['group:fileConflicts', 'File conflicts', ['a.txt']],
      ['group:changes', 'Changes to apply', ['new.txt', 'src/b.txt']],
    ]);
  });

  it("leaves out a folder added or deleted along with the items under it, which say it already, but keeps a moved one", () => {
    const changes: MergePlan['changes'] = [
      { kind: 'added', path: '/src/ui/widgets' },
      { kind: 'added', path: '/src/ui/widgets/Lap_2.cs' },
      { kind: 'deleted', path: '/old' },
      { kind: 'deleted', path: '/old/a.cs' },
      { kind: 'moved', path: '/assets', oldPath: '/art' },
      { kind: 'moved', path: '/assets/ship.mat', oldPath: '/art/ship.mat' },
      { kind: 'added', path: '/empty' },
    ];
    const listed = buildMergeItems({ ...plan, directoryConflicts: [], changes }, [], []).map((item) => item.path);
    expect(listed).toEqual(['src/ui/widgets/Lap_2.cs', 'old/a.cs', 'assets', 'assets/ship.mat', 'empty']);
  });

  it('names every item by its path without the root, for the tree and the filter', () => {
    expect(buildMergeItems(plan, [], [file]).map((item) => item.path)).toEqual(['twin.txt', 'a.txt', 'new.txt']);
  });

  it('offers the conflicts under the Conflicts chip too, keeping what each side did', () => {
    const [directory, conflicted, change] = buildMergeItems(plan, [], [file]);
    expect([mergeItemTones(directory!), mergeItemTones(conflicted!), mergeItemTones(change!)]).toEqual([['added', 'conflict'], ['changed', 'conflict'], ['added']]);
  });

  it('knows which items still need the user, from where the conflicts stand', () => {
    const waiting = buildMergeItems(plan, [], [file]);
    const decided = buildMergeItems(twinDecided, [{ conflict: twin, resolution: { choice: 'source' } }], [file]);
    expect(waiting.map((item) => needsDecision(item, mergeProgress([fileState(true)], twinResolutions())))).toEqual([true, false, false]);
    expect(decided.map((item) => needsDecision(item, mergeProgress([fileState(false)], twinResolutions({ choice: 'source' }))))).toEqual([false, true, false]);
  });

  it("keeps listing a directory conflict once decided, which the plan no longer holds, under the same key: it stays selected", () => {
    const [waiting] = buildMergeItems(plan, [], [file]);
    const [decided] = buildMergeItems(twinDecided, [{ conflict: twin, resolution: { choice: 'rename', newName: 'twin (task).txt' } }], [file]);
    expect(decided).toEqual(waiting);
  });

  it('starts on the first item waiting for the user in the order the list shows: directory conflicts first', () => {
    // The directory conflict is /twin.txt, after /a.txt in path order, but its group comes first.
    const items = buildMergeItems(plan, [], [file]);
    expect(firstWaiting(items, mergeProgress([fileState(false)], twinResolutions()))?.path).toBe('twin.txt');
    expect(firstWaiting(items, mergeProgress([fileState(false)], twinResolutions({ choice: 'source' })))?.path).toBe('a.txt');
    expect(firstWaiting(items, mergeProgress([fileState(true)], twinResolutions({ choice: 'source' })))).toBeUndefined();
  });

  it("reads a conflicting file's state by its key, never a stale copy in the item", () => {
    const [, conflicted] = buildMergeItems(plan, [], [file]);
    const state = fileState(true);
    expect(conflicted?.kind === 'fileConflict' && fileStateOf(conflicted, mergeProgress([state], twinResolutions()))).toBe(state);
  });

  it('omits empty groups', () => {
    expect(mergeItemGroups(buildMergeItems({ ...plan, directoryConflicts: [] }, [], [])).map((group) => group.label)).toEqual(['Changes to apply']);
  });
});

describe('a folder conflict that holds another conflict', () => {
  // Added on both sides as a folder, with a file in it changed on both sides.
  const folder = { operation: 'added' as const, path: '/src/shared', description: 'Added /src/shared' };
  const folderConflict: DirectoryConflict = { ...twin, itemId: 2, isDirectory: true, source: folder, destination: folder };

  it('has a row of its own among the directory conflicts, the file under its folder among the file conflicts', () => {
    const inside: ConflictedFile = { ...file, key: '/src/shared/a.txt', path: 'src/shared/a.txt' };
    const items = buildMergeItems({ ...plan, directoryConflicts: [folderConflict] }, [], [inside]);
    const rows = layoutGroupedTree(mergeItemGroups(items), (item: MergeItem) => item.key, true);

    const groupOf = (key: string): string | undefined => rows.slice(0, rows.findIndex((row) => row.key === key)).filter((row) => row.type === 'group').at(-1)?.key;
    expect(groupOf(items[0]!.key)).toBe('group:directoryConflicts');
    expect(groupOf('file:/src/shared/a.txt')).toBe('group:fileConflicts');
    expect(mergeItemAt(items, rows, items[0]!.key)?.kind).toBe('directoryConflict');
  });

  // A folder moved on one side and deleted on the other, holding a file added on both: in a tree the folder conflict
  // is the folder's row, not a row of its own.
  const twinInside: DirectoryConflict = { ...twin, itemId: 3, source: { ...side, path: '/src/shared/twin.txt' }, destination: { ...side, path: '/src/shared/twin.txt' } };
  const items = buildMergeItems({ ...plan, directoryConflicts: [folderConflict, twinInside] }, [], []);
  const rows = layoutGroupedTree(mergeItemGroups(items), (item: MergeItem) => item.key, true);
  const folderRow = rows.find((row) => row.type === 'folder' && row.item?.kind === 'directoryConflict')!;

  it('is the item its folder row shows when it holds another directory conflict, so selecting the row selects it', () => {
    expect(mergeItemAt(items, rows, folderRow.key)?.conflict).toEqual(folderConflict);
    expect(mergeItemAt(items, rows, 'group:directoryConflicts')).toBeUndefined();
  });

  it("is what the folder row's menu acts on, alone, instead of everything the folder holds", () => {
    expect(mergeItemsActedOn(rows, new Set([folderRow.key]), items).map((item) => item.path)).toEqual(['src/shared']);
    expect(mergeItemsActedOn(rows, new Set([folderRow.key, items[1]!.key]), items)).toEqual(items);
  });
});
