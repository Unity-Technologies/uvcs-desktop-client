import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { collectResolutions, needsServerFilePolicy } from './mergeResolutions';
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

describe('collectResolutions for workspace merges', () => {
  it('waits until every conflict is decided', () => {
    expect(collectResolutions({ plan, fileStates: [automatic], directoryResolutions: [undefined], intoServerBranch: false })).toBeNull();
    expect(collectResolutions({ plan, fileStates: [automatic, manual], directoryResolutions: [{ choice: 'source' }], intoServerBranch: false })).toBeNull();
  });

  it('collects the decisions', () => {
    expect(collectResolutions({ plan, fileStates: [automatic], directoryResolutions: [{ choice: 'source' }], intoServerBranch: false })).toEqual({
      directoryConflicts: [{ choice: 'source' }],
      files: { '/auto.txt': { choice: 'text', text: 'merged' } },
      comment: undefined,
    });
  });
});

describe('collectResolutions for server merges', () => {
  it('needs a side for files that merge automatically too, since only an external tool could combine them on the server', () => {
    expect(needsServerFilePolicy([automatic])).toBe(true);
    expect(collectResolutions({ plan, fileStates: [automatic], directoryResolutions: [{ choice: 'destination' }], intoServerBranch: true })).toBeNull();
    const resolutions = collectResolutions({
      plan,
      fileStates: [automatic],
      directoryResolutions: [{ choice: 'destination' }],
      intoServerBranch: true,
      serverFilePolicy: 'destination',
      comment: 'Merge',
    });
    expect(resolutions?.files['/auto.txt']).toEqual({ choice: 'destination' });
    expect(resolutions?.comment).toBe('Merge');
  });

  it('applies one side to every file when some need a decision', () => {
    expect(needsServerFilePolicy([automatic, manual])).toBe(true);
    expect(collectResolutions({ plan, fileStates: [automatic, manual], directoryResolutions: [{ choice: 'source' }], intoServerBranch: true })).toBeNull();
    const resolutions = collectResolutions({
      plan,
      fileStates: [automatic, manual],
      directoryResolutions: [{ choice: 'source' }],
      intoServerBranch: true,
      serverFilePolicy: 'source',
    });
    expect(resolutions?.files).toEqual({ '/auto.txt': { choice: 'source' }, '/manual.txt': { choice: 'source' } });
  });
});
