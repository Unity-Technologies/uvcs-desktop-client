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
  it('waits until every conflict is decided', () => {
    expect(collectResolutions({ plan, fileStates: [automatic], directoryResolutions: [undefined] })).toBeNull();
    expect(collectResolutions({ plan, fileStates: [automatic, manual], directoryResolutions: [{ choice: 'source' }] })).toBeNull();
  });

  it("collects each file's own decision, in a workspace merge or into a server branch alike", () => {
    const decided = state('/manual.txt', { decidedByUser: true, resolution: { choice: 'destination' } });
    expect(collectResolutions({ plan, fileStates: [automatic, decided], directoryResolutions: [{ choice: 'source' }], comment: 'Merge' })).toEqual({
      directoryConflicts: [{ choice: 'source' }],
      files: { '/auto.txt': { choice: 'text', text: 'merged' }, '/manual.txt': { choice: 'destination' } },
      comment: 'Merge',
    });
  });
});
