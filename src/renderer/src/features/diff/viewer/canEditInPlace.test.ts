import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import { canEditInPlace } from './canEditInPlace';

const onDisk: ContentSource = { kind: 'workspaceFile', path: 'src/a.cs' };

describe('canEditInPlace', () => {
  it('edits a workspace file against its loaded revision, its reviewed copy, or nothing (added)', () => {
    expect(canEditInPlace({ kind: 'workspaceBase', path: 'src/a.cs' }, onDisk)).toBe(true);
    expect(canEditInPlace({ kind: 'reviewSnapshot', path: 'src/a.cs' }, onDisk)).toBe(true);
    expect(canEditInPlace({ kind: 'empty' }, onDisk)).toBe(true);
  });

  it('keeps read-only a workspace file shown against another version, as merges and conflicts do', () => {
    expect(canEditInPlace({ kind: 'revision', revisionId: 7, fileName: 'a.cs' }, onDisk)).toBe(false);
    expect(canEditInPlace({ kind: 'spec', spec: 'serverpath:/src/a.cs#cs:3' }, onDisk)).toBe(false);
    expect(canEditInPlace({ kind: 'workspaceBase', path: 'src/b.cs' }, onDisk)).toBe(false);
  });

  it('keeps read-only diffs whose modified side is not in the workspace', () => {
    expect(canEditInPlace({ kind: 'workspaceBase', path: 'src/a.cs' }, { kind: 'empty' })).toBe(false);
    expect(canEditInPlace({ kind: 'revision', revisionId: 1, fileName: 'a.cs' }, { kind: 'revision', revisionId: 2, fileName: 'a.cs' })).toBe(false);
  });
});
