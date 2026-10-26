import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { collectResolutions } from './mergeResolutions';
import type { FileConflictState } from './resolve/useFileConflicts';

const side = { operation: 'added' as const, path: '/t.txt', description: '' };
const plan: MergePlan = {
  status: 'ready',
  changes: [],
  fileConflicts: [],
  directoryConflicts: [{ type: 'evilTwin', title: '', explanation: '', itemId: 1, isDirectory: false, source: side, destination: side }],
  warnings: [],
};

function state(key: string, options: Partial<FileConflictState>): FileConflictState {
  return {
    file: { key, path: key, base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
    status: 'ready',
    isBinary: false,
    decidedByUser: false,
    resolution: null,
    mergedAutomatically: false,
    remainingConflicts: 0,
    ...options,
  };
}

const automatic = state('/auto.txt', { mergedAutomatically: true, resolution: { choice: 'text', text: 'merged' } });
const manual = state('/manual.txt', { remainingConflicts: 1 });

describe('collectResolutions', () => {
  const decided: MergePlan = { ...plan, directoryConflicts: [] };

  it('waits until every conflict is decided: a directory conflict still listed has no decision applied', () => {
    expect(collectResolutions({ plan, fileStates: [automatic] })).toBeNull();
    expect(collectResolutions({ plan: decided, fileStates: [automatic, manual] })).toBeNull();
    expect(collectResolutions({ plan: decided, fileStates: [automatic] })).not.toBeNull();
  });

  it("collects each file's own decision, and the directory decisions the merge goes on from", () => {
    const manualDecided = state('/manual.txt', { decidedByUser: true, resolution: { choice: 'destination' } });
    expect(collectResolutions({ plan: decided, fileStates: [automatic, manualDecided], directoryDecisionsId: 'page-1', comment: 'Merge' })).toEqual({
      directoryDecisionsId: 'page-1',
      files: { '/auto.txt': { choice: 'text', text: 'merged' }, '/manual.txt': { choice: 'destination' } },
      comment: 'Merge',
    });
  });
});
