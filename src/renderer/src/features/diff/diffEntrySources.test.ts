import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { diffEntrySources } from './diffEntrySources';

describe('diffEntrySources', () => {
  it('reads both sides of a file under an xlink in the xlinked repository, where its ids are', () => {
    const entry: DiffEntry = {
      status: 'changed',
      path: 'plugins/unity-plugin/Tests/UnityDiffWindowMockExtensions.cs',
      itemType: 'file',
      baseRevisionId: 425946,
      revisionId: 432251,
      repository: 'unityGUI@codice@cloud',
    };
    expect(diffEntrySources(entry)).toEqual({
      original: { kind: 'revision', revision: { revisionId: 425946, repository: 'unityGUI@codice@cloud' }, fileName: entry.path },
      modified: { kind: 'revision', revision: { revisionId: 432251, repository: 'unityGUI@codice@cloud' }, fileName: entry.path },
    });
  });

  it('shows nothing on the side an added or deleted item is not on, and a moved one under its old name', () => {
    const base = { path: 'b.ts', itemType: 'file', repository: 'game@local' } as const;
    expect(diffEntrySources({ ...base, status: 'added', baseRevisionId: -1, revisionId: 5 }).original).toEqual({ kind: 'empty' });
    expect(diffEntrySources({ ...base, status: 'deleted', baseRevisionId: 4, revisionId: -1 }).modified).toEqual({ kind: 'empty' });
    expect(diffEntrySources({ ...base, status: 'moved', oldPath: 'a.ts', baseRevisionId: 4, revisionId: 5 }).original).toMatchObject({ fileName: 'a.ts' });
  });
});
