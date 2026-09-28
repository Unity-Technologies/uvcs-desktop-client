import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { diffEntryAnnotation, diffEntryHistory } from './diffEntryHistory';

const entry = (status: DiffEntry['status'], path = 'src/app.ts', repository = 'game@local'): DiffEntry => ({
  status,
  path,
  itemType: 'file',
  baseRevisionId: 1,
  revisionId: status === 'deleted' ? -1 : 2,
  repository,
});

describe('diffEntryHistory', () => {
  it('reads the history of the revision the diff shows, wherever the file is now', () => {
    const revision = { revisionId: 2, repository: 'game@local' };
    expect(diffEntryHistory({ kind: 'changeset', changesetId: 42 }, entry('moved', 'lib/app.ts'))).toEqual({ kind: 'history', path: 'lib/app.ts', revision });
    expect(diffEntryHistory({ kind: 'range', fromSpec: 'cs:3', toSpec: 'cs:9' }, entry('added'))).toEqual({ kind: 'history', path: 'src/app.ts', revision });
    expect(diffEntryHistory({ kind: 'range', fromSpec: 'lb:v1', toSpec: 'lb:v2' }, entry('changed'))).toEqual({ kind: 'history', path: 'src/app.ts', revision });
    expect(diffEntryHistory({ kind: 'branch', branch: '/main/task' }, entry('changed'))).toEqual({ kind: 'history', path: 'src/app.ts', revision });
  });

  it('reads a file under an xlink in the xlinked repository', () => {
    const xlinked = entry('changed', 'plugins/unity-plugin/Tests/Mock.cs', 'unityGUI@codice@cloud');
    expect(diffEntryHistory({ kind: 'branch', branch: '/main/scm1008583' }, xlinked)).toEqual({
      kind: 'history',
      path: 'plugins/unity-plugin/Tests/Mock.cs',
      revision: { revisionId: 2, repository: 'unityGUI@codice@cloud' },
    });
  });

  it("reads the workspace's history for a deleted file or a shelve", () => {
    expect(diffEntryHistory({ kind: 'changeset', changesetId: 42 }, entry('deleted'))).toEqual({ kind: 'history', path: 'src/app.ts' });
    expect(diffEntryHistory({ kind: 'shelve', shelveId: 3 }, entry('changed'))).toEqual({ kind: 'history', path: 'src/app.ts' });
  });
});

describe('diffEntryAnnotation', () => {
  it("annotates the diff's newer revision, in the history the diff's file has", () => {
    expect(diffEntryAnnotation({ kind: 'changeset', changesetId: 42 }, entry('moved', 'lib/app.ts'))).toEqual({
      kind: 'history',
      path: 'lib/app.ts',
      revision: { revisionId: 2, repository: 'game@local' },
      select: { revisionId: 2 },
      view: 'annotate',
    });
  });

  it('has nothing to annotate for a deleted file, a directory, a binary or a shelve', () => {
    expect(diffEntryAnnotation({ kind: 'changeset', changesetId: 42 }, entry('deleted'))).toBeNull();
    expect(diffEntryAnnotation({ kind: 'changeset', changesetId: 42 }, { ...entry('changed'), itemType: 'directory' })).toBeNull();
    expect(diffEntryAnnotation({ kind: 'changeset', changesetId: 42 }, { ...entry('changed'), itemType: 'binaryFile' })).toBeNull();
    expect(diffEntryAnnotation({ kind: 'shelve', shelveId: 3 }, entry('changed'))).toBeNull();
  });
});
