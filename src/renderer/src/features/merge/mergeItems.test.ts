import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { buildMergeItems, needsDecision, toListRows } from './mergeItems';
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
  it('lists conflicts before the changes that apply cleanly', () => {
    const rows = toListRows(buildMergeItems(plan, [fileState(false)], []));
    expect(rows.map((row) => row.key)).toEqual(['section:conflicts', 'directory:0', 'file:/a.txt', 'section:changes', 'change:0']);
  });

  it('knows which items still need the user', () => {
    const items = buildMergeItems(plan, [fileState(true)], [undefined]);
    expect(items.map(needsDecision)).toEqual([true, false, false]);
  });

  it('omits empty sections', () => {
    expect(toListRows(buildMergeItems({ ...plan, directoryConflicts: [] }, [], []))[0]).toMatchObject({ label: 'Changes to apply' });
  });
});
