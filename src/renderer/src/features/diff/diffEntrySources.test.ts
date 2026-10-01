import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { describeDiffEntry, diffEntrySources, diffEntryStatus, diffEntryTones } from './diffEntrySources';

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

describe('describeDiffEntry', () => {
  const base = { path: 'src/b.ts', itemType: 'file', repository: 'game@local', baseRevisionId: 4, revisionId: 5 } as const;

  it('says what happened to the item, and where a moved one came from', () => {
    expect(describeDiffEntry({ ...base, status: 'changed' })).toBe('Changed');
    expect(describeDiffEntry({ ...base, status: 'moved', oldPath: 'src/a.ts', revisionId: 4 })).toBe('Moved from src/a.ts');
  });

  it('tells a moved item whose content changed too, which the diff then shows', () => {
    expect(describeDiffEntry({ ...base, status: 'moved', oldPath: 'src/a.ts' })).toBe('Moved and changed');
  });
});

describe('diffEntryStatus', () => {
  const base = { path: 'src/app/b.ts', itemType: 'file', repository: 'game@local', baseRevisionId: 4, revisionId: 5 } as const;

  it('letters the item by what happened to it, a move told by the M itself', () => {
    expect(diffEntryStatus({ ...base, status: 'changed' })).toEqual({ tone: 'changed', label: 'Changed' });
    expect(diffEntryStatus({ ...base, status: 'moved', oldPath: 'src/lib/b.ts', revisionId: 4 })).toEqual({ tone: 'moved', label: 'Moved' });
  });

  it('gives a moved file that changed a C before its M', () => {
    expect(diffEntryStatus({ ...base, status: 'moved', oldPath: 'src/lib/b.ts' })).toEqual({ tone: 'moved', label: 'Moved', changedLabel: 'Changed' });
  });
});

describe('diffEntryTones', () => {
  const base = { path: 'src/app/b.ts', itemType: 'file', repository: 'game@local', baseRevisionId: 4, revisionId: 5 } as const;

  it('finds a moved file that changed by the C and M chips, a file only moved by M', () => {
    expect(diffEntryTones({ ...base, status: 'moved', oldPath: 'src/lib/b.ts' })).toEqual(['changed', 'moved']);
    expect(diffEntryTones({ ...base, status: 'moved', oldPath: 'src/lib/b.ts', revisionId: 4 })).toEqual(['moved']);
    expect(diffEntryTones({ ...base, status: 'added' })).toEqual(['added']);
  });
});
