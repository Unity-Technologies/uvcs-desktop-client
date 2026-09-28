import { describe, expect, it } from 'vitest';
import { isImmutableContent } from './immutableContent';

describe('isImmutableContent', () => {
  it('holds for revisions by id, nothing, and specs pinned to a changeset or a shelve', () => {
    expect(isImmutableContent({ kind: 'revision', revision: { revisionId: 31312248, repository: 'game@local' }, fileName: 'a.ts' })).toBe(true);
    expect(isImmutableContent({ kind: 'empty' })).toBe(true);
    expect(isImmutableContent({ kind: 'spec', spec: 'serverpath:/src/file2.txt#cs:4', fileName: '/src/file2.txt' })).toBe(true);
    expect(isImmutableContent({ kind: 'spec', spec: 'itemid:27#sh:5', fileName: 'src/file2.txt' })).toBe(true);
  });

  it("doesn't hold for workspace files, the loaded revision, or specs that follow a branch", () => {
    expect(isImmutableContent({ kind: 'workspaceFile', path: 'src/a.ts' })).toBe(false);
    expect(isImmutableContent({ kind: 'workspaceBase', path: 'src/a.ts' })).toBe(false);
    expect(isImmutableContent({ kind: 'spec', spec: 'serverpath:/src/a.ts#br:/main', fileName: '/src/a.ts' })).toBe(false);
  });
});
