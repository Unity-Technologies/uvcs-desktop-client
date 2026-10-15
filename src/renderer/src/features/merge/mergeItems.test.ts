import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { layoutGroupedTree } from '../../lib/groupedPathTree';
import { buildMergeItems, fileStateOf, firstWaiting, mergeItemAt, mergeItemGroups, mergeItemsActedOn, mergeItemTones, mergeProgress, needsDecision, type MergeItem } from './mergeItems';
import type { ConflictedFile, FileConflictState } from './resolve/useFileConflicts';

const side = { operation: 'added' as const, path: '/twin.txt', description: 'Added /twin.txt' };
const plan: MergePlan = {
  status: 'ready',
  changes: [{ kind: 'added', path: '/new.txt' }],
  fileConflicts: [],
  directoryConflicts: [{ type: 'evilTwin', title: 'Evil twin', explanation: '', itemId: 1, isDirectory: false, source: side, destination: side }],
  warnings: [],
};

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
  it('groups the conflicts before the changes that apply cleanly, each group by path as every list of files', () => {
    const groups = mergeItemGroups(buildMergeItems({ ...plan, changes: [{ kind: 'added', path: '/src/b.txt' }, { kind: 'changed', path: '/new.txt' }] }, [file]));
    expect(groups.map((group) => [group.key, group.label, group.sorted.map((item) => item.path)])).toEqual([
      ['group:conflicts', 'Conflicts', ['a.txt', 'twin.txt']],
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
    const listed = buildMergeItems({ ...plan, directoryConflicts: [], changes }, []).map((item) => item.path);
    expect(listed).toEqual(['src/ui/widgets/Lap_2.cs', 'old/a.cs', 'assets', 'assets/ship.mat', 'empty']);
  });

  it('names every item by its path without the root, for the tree and the filter', () => {
    expect(buildMergeItems(plan, [file]).map((item) => item.path)).toEqual(['twin.txt', 'a.txt', 'new.txt']);
  });

  it('offers the conflicts under the Conflicts chip too, keeping what each side did', () => {
    const [directory, conflicted, change] = buildMergeItems(plan, [file]);
    expect([mergeItemTones(directory!), mergeItemTones(conflicted!), mergeItemTones(change!)]).toEqual([['added', 'conflict'], ['changed', 'conflict'], ['added']]);
  });

  it('knows which items still need the user, from where the conflicts stand', () => {
    const items = buildMergeItems(plan, [file]);
    expect(items.map((item) => needsDecision(item, mergeProgress([fileState(true)], [undefined])))).toEqual([true, false, false]);
    expect(items.map((item) => needsDecision(item, mergeProgress([fileState(false)], [{ choice: 'source' }])))).toEqual([false, true, false]);
  });

  it('starts on the first item waiting for the user in the order the list shows, not directory conflicts first', () => {
    // The directory conflict is /twin.txt, after /a.txt in path order.
    const items = buildMergeItems(plan, [file]);
    expect(firstWaiting(items, mergeProgress([fileState(false)], []))?.path).toBe('a.txt');
    expect(firstWaiting(items, mergeProgress([fileState(true)], []))?.path).toBe('twin.txt');
    expect(firstWaiting(items, mergeProgress([fileState(true)], [{ choice: 'source' }]))).toBeUndefined();
  });

  it("reads a conflicting file's state by its key, never a stale copy in the item", () => {
    const [, conflicted] = buildMergeItems(plan, [file]);
    const state = fileState(true);
    expect(conflicted?.kind === 'fileConflict' && fileStateOf(conflicted, mergeProgress([state], []))).toBe(state);
  });

  it('omits empty groups', () => {
    expect(mergeItemGroups(buildMergeItems({ ...plan, directoryConflicts: [] }, [])).map((group) => group.label)).toEqual(['Changes to apply']);
  });
});

describe('a folder conflict that holds another conflict', () => {
  // Added on both sides as a folder, with a file in it changed on both sides: in a tree the folder conflict is the
  // folder's row, not a row of its own.
  const folder = { operation: 'added' as const, path: '/src/shared', description: 'Added /src/shared' };
  const nested: MergePlan = { ...plan, directoryConflicts: [{ ...plan.directoryConflicts[0]!, isDirectory: true, source: folder, destination: folder }] };
  const inside: ConflictedFile = { ...file, key: '/src/shared/a.txt', path: 'src/shared/a.txt' };
  const items = buildMergeItems(nested, [inside]);
  const rows = layoutGroupedTree(mergeItemGroups(items), (item: MergeItem) => item.key, true);
  const folderRow = rows.find((row) => row.type === 'folder' && row.item?.kind === 'directoryConflict')!;

  it('is the item its folder row shows, so selecting the row selects the conflict', () => {
    expect(folderRow).toBeDefined();
    expect(mergeItemAt(items, rows, folderRow.key)?.key).toBe('directory:0');
    expect(mergeItemAt(items, rows, 'file:/src/shared/a.txt')?.kind).toBe('fileConflict');
    expect(mergeItemAt(items, rows, 'group:conflicts')).toBeUndefined();
  });

  it("is what the folder row's menu acts on, alone, instead of everything the folder holds", () => {
    expect(mergeItemsActedOn(rows, new Set([folderRow.key]), items).map((item) => item.key)).toEqual(['directory:0']);
    expect(mergeItemsActedOn(rows, new Set([folderRow.key, 'file:/src/shared/a.txt']), items)).toEqual(items);
  });
});
