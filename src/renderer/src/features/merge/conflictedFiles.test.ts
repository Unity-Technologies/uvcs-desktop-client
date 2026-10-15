import { describe, expect, it } from 'vitest';
import type { FileConflict, MergePlan } from '@shared/domain/merge';
import { conflictedFilesOf } from './conflictedFiles';

const conflict: FileConflict = { path: '/src/a.cs', itemId: 27, baseChangeset: 3, sourceChangeset: 5, destinationChangeset: 4, repository: 'lib@local', destinationRevisionId: 432, destinationIsBinary: false };
const plan = (fileConflicts: FileConflict[]): MergePlan => ({ status: 'ready', changes: [], fileConflicts, directoryConflicts: [], warnings: [] });

describe('conflictedFilesOf', () => {
  it("reads the base and the source as the item at their changesets, and the destination by its revision, all in the file's repository", () => {
    expect(conflictedFilesOf(plan([conflict]), { kind: 'merge', sourceSpec: 'br:/main/task' })).toEqual([
      {
        key: '/src/a.cs',
        path: 'src/a.cs',
        base: { kind: 'spec', spec: 'itemid:27#cs:3@lib@local', fileName: '/src/a.cs' },
        source: { kind: 'spec', spec: 'itemid:27#cs:5@lib@local', fileName: '/src/a.cs' },
        destination: { kind: 'revision', revision: { revisionId: 432, repository: 'lib@local' }, fileName: '/src/a.cs' },
      },
    ]);
  });

  it("reads a shelve's version at the shelve, and nothing for a file with no common ancestor", () => {
    const [file] = conflictedFilesOf(plan([{ ...conflict, baseChangeset: -1 }]), { kind: 'merge', sourceSpec: 'sh:9' });
    expect(file).toMatchObject({ base: { kind: 'empty' }, source: { spec: 'itemid:27#sh:9@lib@local' } });
  });
});
