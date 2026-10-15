import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import { canEditInPlace, typesIntoDiff } from './canEditInPlace';
import { LONGEST_DRAWN_LINE } from './longLines';

const onDisk: ContentSource = { kind: 'workspaceFile', path: 'src/a.cs' };

describe('canEditInPlace', () => {
  it('edits a workspace file against its loaded revision, its reviewed copy, or nothing (added)', () => {
    expect(canEditInPlace({ kind: 'workspaceBase', path: 'src/a.cs' }, onDisk)).toBe(true);
    expect(canEditInPlace({ kind: 'reviewSnapshot', path: 'src/a.cs' }, onDisk)).toBe(true);
    expect(canEditInPlace({ kind: 'empty' }, onDisk)).toBe(true);
  });

  it('keeps read-only a workspace file shown against another version, as merges and conflicts do', () => {
    expect(canEditInPlace({ kind: 'revision', revision: { revisionId: 7, repository: 'game@local' }, fileName: 'a.cs' }, onDisk)).toBe(false);
    expect(canEditInPlace({ kind: 'spec', spec: 'serverpath:/src/a.cs#cs:3' }, onDisk)).toBe(false);
    expect(canEditInPlace({ kind: 'workspaceBase', path: 'src/b.cs' }, onDisk)).toBe(false);
  });

  it('keeps read-only diffs whose modified side is not in the workspace', () => {
    expect(canEditInPlace({ kind: 'workspaceBase', path: 'src/a.cs' }, { kind: 'empty' })).toBe(false);
    expect(canEditInPlace({ kind: 'revision', revision: { revisionId: 1, repository: 'game@local' }, fileName: 'a.cs' }, { kind: 'revision', revision: { revisionId: 2, repository: 'game@local' }, fileName: 'a.cs' })).toBe(false);
  });
});

describe('typesIntoDiff', () => {
  const minified = 'var a=b;'.repeat(LONGEST_DRAWN_LINE / 4);

  it('types into a file that can be edited in place', () => {
    expect(typesIntoDiff(true, ['const a = 1;\n', 'const a = 2;\n'])).toBe(true);
  });

  it('keeps read-only a file with a line too long to draw unwrapped, on either side: typing there froze the window', () => {
    expect(typesIntoDiff(true, ['', minified])).toBe(false);
    expect(typesIntoDiff(true, [minified, 'short\n'])).toBe(false);
  });

  it("keeps read-only what can't be edited in place", () => {
    expect(typesIntoDiff(false, ['a\n', 'b\n'])).toBe(false);
  });
});
