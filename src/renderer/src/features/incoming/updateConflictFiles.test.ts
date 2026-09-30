import { describe, expect, it } from 'vitest';
import type { FileConflictResolution } from '@shared/domain/merge';
import type { FileConflictState } from '../merge/resolve/useFileConflicts';
import { updateConflictFiles, updateResolutionsOf } from './updateConflictFiles';

function stateOf(path: string, resolution: FileConflictState['resolution']): FileConflictState {
  const [file] = updateConflictFiles([{ path, isBinary: false, baseRevisionId: 1, incomingRevisionId: 2, repository: 'game@local' }]);
  return { file: file!, status: 'ready', isBinary: false, decidedByUser: false, resolution, mergedAutomatically: false, remainingConflicts: 0 };
}

describe('updateResolutionsOf', () => {
  it("names each file's resolution by its path once every file is decided", () => {
    const keepMine: FileConflictResolution = { choice: 'destination' };
    expect(updateResolutionsOf([stateOf('a.ts', keepMine), stateOf('b.ts', { choice: 'text', text: 'merged' })])).toEqual({
      'a.ts': keepMine,
      'b.ts': { choice: 'text', text: 'merged' },
    });
  });

  it('is nothing while a file still waits for the user', () => {
    expect(updateResolutionsOf([stateOf('a.ts', { choice: 'source' }), stateOf('b.ts', null)])).toBeNull();
  });
});
