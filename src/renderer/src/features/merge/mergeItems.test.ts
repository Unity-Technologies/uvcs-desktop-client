import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { buildMergeItems, mergeItemGroups, mergeItemTones, needsDecision } from './mergeItems';
import type { FileConflictState } from './resolve/useFileConflicts';

const side = { operation: 'added' as const, path: '/twin.txt', description: 'Added /twin.txt' };
const plan: MergePlan = {
  status: 'ready',
  changes: [{ kind: 'added', path: '/new.txt' }],
  fileConflicts: [],
  directoryConflicts: [{ type: 'evilTwin', title: 'Evil twin', explanation: '', itemId: 1, isDirectory: false, source: side, destination: side }],
  warnings: [],
};

function fileState(resolved: boolean): FileConflictState {
  return {
    file: { key: '/a.txt', path: 'a.txt', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
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
    const groups = mergeItemGroups(buildMergeItems({ ...plan, changes: [{ kind: 'added', path: '/src/b.txt' }, { kind: 'changed', path: '/new.txt' }] }, [fileState(false)], []));
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
    const listed = buildMergeItems({ ...plan, directoryConflicts: [], changes }, [], []).map((item) => item.path);
    expect(listed).toEqual(['src/ui/widgets/Lap_2.cs', 'old/a.cs', 'assets', 'assets/ship.mat', 'empty']);
  });

  it('names every item by its path without the root, for the tree and the filter', () => {
    expect(buildMergeItems(plan, [fileState(false)], []).map((item) => item.path)).toEqual(['twin.txt', 'a.txt', 'new.txt']);
  });

  it('offers the conflicts under the Conflicts chip too, keeping what each side did', () => {
    const [directory, file, change] = buildMergeItems(plan, [fileState(false)], []);
    expect([mergeItemTones(directory!), mergeItemTones(file!), mergeItemTones(change!)]).toEqual([['added', 'conflict'], ['changed', 'conflict'], ['added']]);
  });

  it('knows which items still need the user', () => {
    const items = buildMergeItems(plan, [fileState(true)], [undefined]);
    expect(items.map(needsDecision)).toEqual([true, false, false]);
  });

  it('omits empty groups', () => {
    expect(mergeItemGroups(buildMergeItems({ ...plan, directoryConflicts: [] }, [], [])).map((group) => group.label)).toEqual(['Changes to apply']);
  });
});
