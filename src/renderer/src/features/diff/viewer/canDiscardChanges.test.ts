import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import { canDiscardChanges } from './canDiscardChanges';

const onDisk: ContentSource = { kind: 'workspaceFile', path: 'src/a.cs' };

describe('canDiscardChanges', () => {
  it('allows a workspace file against its loaded revision or its reviewed copy', () => {
    expect(canDiscardChanges({ kind: 'workspaceBase', path: 'src/a.cs' }, onDisk)).toBe(true);
    expect(canDiscardChanges({ kind: 'reviewSnapshot', path: 'src/a.cs' }, onDisk)).toBe(true);
  });

  it('refuses an added file, and a workspace file against any other version', () => {
    expect(canDiscardChanges({ kind: 'empty' }, onDisk)).toBe(false);
    expect(canDiscardChanges({ kind: 'spec', spec: 'serverpath:/src/a.cs#cs:3' }, onDisk)).toBe(false);
    expect(canDiscardChanges({ kind: 'revision', revision: { revisionId: 7, repository: 'game@local' }, fileName: 'a.cs' }, onDisk)).toBe(false);
    expect(canDiscardChanges({ kind: 'workspaceBase', path: 'src/b.cs' }, onDisk)).toBe(false);
  });

  it('refuses diffs whose modified side is not in the workspace', () => {
    expect(canDiscardChanges({ kind: 'workspaceBase', path: 'src/a.cs' }, { kind: 'empty' })).toBe(false);
    expect(canDiscardChanges({ kind: 'revision', revision: { revisionId: 1, repository: 'game@local' }, fileName: 'a.cs' }, { kind: 'revision', revision: { revisionId: 2, repository: 'game@local' }, fileName: 'a.cs' })).toBe(false);
  });
});
