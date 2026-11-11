import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { DIFF_ENTRY_FACTS, describeDiffEntry, diffEntrySources, diffEntryStatus, diffEntryTones, permissionsNote } from './diffEntrySources';

describe('diffEntrySources', () => {
  it('reads both sides of a file under an xlink in the xlinked repository, where its ids are', () => {
    const entry: DiffEntry = {
      status: 'changed',
      path: 'plugins/editor-plugin/Tests/DiffWindowMockExtensions.cs',
      itemType: 'file',
      baseRevisionId: 425946,
      revisionId: 432251,
      repository: 'editorGUI@acme@cloud',
    };
    expect(diffEntrySources(entry)).toEqual({
      original: { kind: 'revision', revision: { revisionId: 425946, repository: 'editorGUI@acme@cloud' }, fileName: entry.path },
      modified: { kind: 'revision', revision: { revisionId: 432251, repository: 'editorGUI@acme@cloud' }, fileName: entry.path },
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

describe('an item whose file permissions alone changed', () => {
  const onlyPermissions: DiffEntry = {
    status: 'changed',
    path: 'tools/build.sh',
    itemType: 'file',
    baseRevisionId: 41,
    revisionId: 41,
    repository: 'game@local',
    permissionsChange: { before: '-rw-r--r--', after: '-rwxr-xr-x' },
  };

  it('is lettered FS, found by its own chip and grouped apart from the files that changed', () => {
    expect(diffEntryStatus(onlyPermissions)).toEqual({ tone: 'permissions', label: 'Only file permissions changed' });
    expect(diffEntryTones(onlyPermissions)).toEqual(['permissions']);
    expect(DIFF_ENTRY_FACTS.toneOf(onlyPermissions)).toBe('permissions');
    expect(describeDiffEntry(onlyPermissions)).toBe('Only file permissions changed');
  });

  it('shows the same revision on both sides', () => {
    const { original, modified } = diffEntrySources(onlyPermissions);
    expect(original).toEqual(modified);
  });

  // The permissions are written with non-breaking hyphens, which a line never breaks at: read here as plain ones.
  const plainHyphens = (text: string | null) => text?.replaceAll('\u2011', '-');

  it('shows, in place of a diff of the same content, which permissions changed', () => {
    expect(plainHyphens(permissionsNote(onlyPermissions))).toBe('Only the file permissions changed, from -rw-r--r-- to -rwxr-xr-x.');
    const permissions = (before: string | null, after: string | null) => plainHyphens(permissionsNote({ ...onlyPermissions, permissionsChange: { before, after } }));
    expect(permissions(null, '-rwxr-xr-x')).toBe('Only the file permissions changed, from not set to -rwxr-xr-x.');
    expect(permissions('-r--r--r--', null)).toBe('Only the file permissions changed, from -r--r--r-- to not set.');
    expect(permissions(null, null)).toBe('Only the file permissions changed.');
  });

  it('keeps each permissions string on one line', () => {
    expect(permissionsNote(onlyPermissions)).toContain('\u2011rw\u2011r\u2011\u2011r\u2011\u2011');
    expect(permissionsNote(onlyPermissions)).not.toMatch(/[rwx]-/);
  });

  it('is the same for a binary or a folder, which have no text to show it beside', () => {
    for (const itemType of ['binaryFile', 'directory'] as const) {
      expect(plainHyphens(permissionsNote({ ...onlyPermissions, itemType }))).toBe('Only the file permissions changed, from -rw-r--r-- to -rwxr-xr-x.');
    }
  });

  it('is none for an item whose content changed, or that was only moved', () => {
    expect(permissionsNote({ ...onlyPermissions, permissionsChange: undefined, baseRevisionId: 40 })).toBeNull();
    expect(permissionsNote({ ...onlyPermissions, permissionsChange: undefined, status: 'moved', oldPath: 'build.sh' })).toBeNull();
  });
});
