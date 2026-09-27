import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { diffEntryHistory } from './diffEntryHistory';

const entry = (status: DiffEntry['status'], path = 'src/app.ts'): DiffEntry => ({ status, path, itemType: 'file', baseRevisionId: 1, revisionId: status === 'deleted' ? -1 : 2 });

describe('diffEntryHistory', () => {
  it("reads a changeset's file as the repository had it then", () => {
    expect(diffEntryHistory({ kind: 'changeset', changesetId: 42 }, entry('moved', 'lib/app.ts'))).toEqual({ kind: 'history', path: 'lib/app.ts', changesetId: 42 });
    expect(diffEntryHistory({ kind: 'changeset', changesetId: 42 }, entry('changed'))).toEqual({ kind: 'history', path: 'src/app.ts', changesetId: 42 });
  });

  it('reads a range of changesets at its newer end', () => {
    expect(diffEntryHistory({ kind: 'range', fromSpec: 'cs:3', toSpec: 'cs:9' }, entry('added'))).toEqual({ kind: 'history', path: 'src/app.ts', changesetId: 9 });
  });

  it("reads the workspace's history for a deleted file, a branch, a shelve or a range of labels", () => {
    expect(diffEntryHistory({ kind: 'changeset', changesetId: 42 }, entry('deleted'))).toEqual({ kind: 'history', path: 'src/app.ts' });
    expect(diffEntryHistory({ kind: 'branch', branch: '/main/task' }, entry('changed'))).toEqual({ kind: 'history', path: 'src/app.ts' });
    expect(diffEntryHistory({ kind: 'shelve', shelveId: 3 }, entry('changed'))).toEqual({ kind: 'history', path: 'src/app.ts' });
    expect(diffEntryHistory({ kind: 'range', fromSpec: 'lb:v1', toSpec: 'lb:v2' }, entry('changed'))).toEqual({ kind: 'history', path: 'src/app.ts' });
  });
});
