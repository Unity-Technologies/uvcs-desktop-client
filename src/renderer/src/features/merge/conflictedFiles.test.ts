import { describe, expect, it } from 'vitest';
import type { FileConflict, MergePlan } from '@shared/domain/merge';
import { conflictedFilesOf } from './conflictedFiles';

const conflict: FileConflict = { path: '/src/a.cs', itemId: 27, baseChangeset: 3, sourceChangeset: 5, destinationChangeset: 4, repository: 'lib@local', destinationRevisionId: 432, destinationIsBinary: false };
const plan = (fileConflicts: FileConflict[]): MergePlan => ({ status: 'ready', changes: [], fileConflicts, directoryConflicts: [], warnings: [] });

describe('conflictedFilesOf', () => {
  it("reads the base and the source as the item at their changesets, and the destination by its revision, all in the file's repository", () => {
    expect(conflictedFilesOf(plan([conflict]), { kind: 'merge', sourceSpec: 'br:/main/task' })).toEqual([
      {
        key: '27@lib@local',
        path: 'src/a.cs',
        base: { kind: 'spec', spec: 'itemid:27#cs:3@lib@local', fileName: '/src/a.cs' },
        baseName: 'cs:3',
        source: { kind: 'spec', spec: 'itemid:27#cs:5@lib@local', fileName: '/src/a.cs' },
        destination: { kind: 'revision', revision: { revisionId: 432, repository: 'lib@local' }, fileName: '/src/a.cs' },
      },
    ]);
  });

  it('keys each file by its item in its repository, which a directory decision moving the file keeps', () => {
    const [main, xlinked] = conflictedFilesOf(plan([conflict, { ...conflict, path: '/lib/a.cs', repository: 'xlinked@local' }]), { kind: 'merge', sourceSpec: 'br:/main/task' });
    const [moved] = conflictedFilesOf(plan([{ ...conflict, path: '/moved/a.cs' }]), { kind: 'merge', sourceSpec: 'br:/main/task' });

    expect(moved?.key).toBe(main?.key);
    expect(xlinked?.key).not.toBe(main?.key);
  });

  it("knows a file is a binary, before any version is read, when cm keeps the destination's revision as one", () => {
    const [texture, code] = conflictedFilesOf(plan([{ ...conflict, path: '/a.png', destinationIsBinary: true }, conflict]), { kind: 'merge', sourceSpec: 'br:/main/task' });
    expect(texture?.isKnownBinary).toBe(true);
    expect(code?.isKnownBinary).toBeUndefined();
  });

  it('marks the base of a changeset being undone as that change, which keeping would put back', () => {
    // Undoing cs:2 prints `FILE_CONFLICT|/f.txt|2|1|3|…`: the base is the changeset undone, the source its parent.
    const [undone] = conflictedFilesOf(plan([{ ...conflict, baseChangeset: 2, sourceChangeset: 1 }]), { kind: 'subtractive', sourceSpec: 'cs:2' });
    expect(undone?.baseIsUndoneChange).toBe(true);
    expect(conflictedFilesOf(plan([conflict]), { kind: 'cherryPick', sourceSpec: 'cs:5' })[0]?.baseIsUndoneChange).toBeUndefined();
    const [undoneRange] = conflictedFilesOf(plan([{ ...conflict, baseChangeset: 4, sourceChangeset: 1 }]), { kind: 'subtractive', sourceSpec: 'cs:4', intervalOriginSpec: 'cs:1' });
    expect(undoneRange?.baseIsUndoneChange).toBe(true);
  });

  it("names each file's base by its own changeset, which under a writable xlink isn't the merge's", () => {
    const [main, xlinked] = conflictedFilesOf(plan([conflict, { ...conflict, path: '/lib/b.cs', baseChangeset: 41, repository: 'xlinked@local' }]), { kind: 'merge', sourceSpec: 'br:/main/task' });
    expect([main?.baseName, xlinked?.baseName]).toEqual(['cs:3', 'cs:41']);
    expect(conflictedFilesOf(plan([{ ...conflict, baseChangeset: -1 }]), { kind: 'merge', sourceSpec: 'br:/main/task' })[0]?.baseName).toBeUndefined();
  });

  it("reads a shelve's version at the shelve, and nothing for a file with no common ancestor", () => {
    const [file] = conflictedFilesOf(plan([{ ...conflict, baseChangeset: -1 }]), { kind: 'merge', sourceSpec: 'sh:9' });
    expect(file).toMatchObject({ base: { kind: 'empty' }, source: { spec: 'itemid:27#sh:9@lib@local' } });
  });
});
