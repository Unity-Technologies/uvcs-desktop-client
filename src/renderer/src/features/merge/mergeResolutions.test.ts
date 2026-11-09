import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { fileConflictKey } from './conflictedFiles';
import { collectResolutions } from './mergeResolutions';
import type { FileConflictState } from './resolve/useFileConflicts';

const fileConflict = (path: string, itemId: number) => ({ path, destinationPath: path, itemId, repository: 'game@local', baseChangeset: 1, sourceChangeset: 3, destinationChangeset: 4, destinationRevisionId: 40, destinationIsBinary: false });
const autoConflict = fileConflict('/auto.txt', 20);
const manualConflict = fileConflict('/manual.txt', 21);
const side = { operation: 'added' as const, path: '/t.txt', description: '' };
const plan: MergePlan = {
  status: 'ready',
  changes: [],
  fileConflicts: [autoConflict, manualConflict],
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

const automatic = state(fileConflictKey(autoConflict), { mergedAutomatically: true, resolution: { choice: 'text', text: 'merged' } });
const manual = state(fileConflictKey(manualConflict), { remainingConflicts: 1 });

describe('collectResolutions', () => {
  const decided: MergePlan = { ...plan, directoryConflicts: [] };

  it('waits until every conflict is decided: a directory conflict still listed has no decision applied', () => {
    const decidedManual = state(fileConflictKey(manualConflict), { resolution: { choice: 'source' } });
    expect(collectResolutions({ plan, fileStates: [automatic, decidedManual] })).toBeNull();
    expect(collectResolutions({ plan: decided, fileStates: [automatic, manual] })).toBeNull();
    expect(collectResolutions({ plan: decided, fileStates: [automatic, decidedManual] })).not.toBeNull();
  });

  it("collects each file's own decision, and the directory decisions the merge goes on from", () => {
    const manualDecided = state(fileConflictKey(manualConflict), { decidedByUser: true, resolution: { choice: 'destination' } });
    expect(collectResolutions({ plan: decided, fileStates: [automatic, manualDecided], directoryDecisionsId: 'page-1', comment: 'Merge' })).toEqual({
      directoryDecisionsId: 'page-1',
      files: { '/auto.txt': { choice: 'text', text: 'merged' }, '/manual.txt': { choice: 'destination' } },
      comment: 'Merge',
    });
  });

  it('sends each decision by the path the plan names the file at now, which a directory decision may have moved it to', () => {
    const moved: MergePlan = { ...plan, directoryConflicts: [], fileConflicts: [{ ...autoConflict, path: '/moved/auto.txt' }] };
    expect(collectResolutions({ plan: moved, fileStates: [automatic] })?.files).toEqual({ '/moved/auto.txt': { choice: 'text', text: 'merged' } });
  });

  it('stores the comment without the space a picked suggestion leaves after it', () => {
    const undecided: MergePlan = { ...plan, directoryConflicts: [], fileConflicts: [autoConflict] };
    expect(collectResolutions({ plan: undecided, fileStates: [automatic], comment: 'Merge br:/main/task ' })?.comment).toBe('Merge br:/main/task');
  });
});
