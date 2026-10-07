import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { collidesWithLocal, firstIncomingFile, incomingDiffTarget, incomingFileContent, incomingFilesSummary, incomingFileTones, scopeKey } from './incomingScope';

const file = (path: string, extra: Partial<DiffEntry> = {}): DiffEntry => ({ path, status: 'changed', itemType: 'file', ...extra }) as DiffEntry;

describe('collidesWithLocal', () => {
  const conflicts = new Set(['src/b.ts']);
  const blocked = new Set(['src/old.ts']);

  it('tells a file changed on both sides, and one changed locally that the branch moved or deleted, by its old path', () => {
    expect(collidesWithLocal(file('src/b.ts'), conflicts, blocked)).toBe(true);
    expect(collidesWithLocal(file('src/new.ts', { status: 'moved', oldPath: 'src/old.ts' }), conflicts, blocked)).toBe(true);
    expect(collidesWithLocal(file('src/old.ts', { status: 'deleted' }), conflicts, blocked)).toBe(true);
    expect(collidesWithLocal(file('src/a.ts'), conflicts, blocked)).toBe(false);
  });
});

describe('incomingFileContent', () => {
  const files = [file('src/a.ts'), file('src/b.ts'), file('z.ts')];
  const collides = (entry: DiffEntry): boolean => entry.path === 'src/b.ts';

  it("groups the files that conflict with the user's changes first, then the changes to apply, in the merge page's words", () => {
    const content = incomingFileContent(files, collides);
    expect('groups' in content && content.groups.map(({ key, label, sorted }) => [key, label, sorted.map((entry) => entry.path)])).toEqual([
      ['group:conflicts', 'Conflicts with your changes', ['src/b.ts']],
      ['group:changes', 'Changes to apply', ['src/a.ts', 'z.ts']],
    ]);
  });

  it('shows the files without groups when nothing changed on both sides', () => {
    expect(incomingFileContent(files, () => false)).toEqual({ sorted: files });
  });

  it('leaves out the group of the others when every file changed on both sides', () => {
    const content = incomingFileContent([file('src/b.ts')], collides);
    expect('groups' in content && content.groups.map((group) => group.key)).toEqual(['group:conflicts']);
  });
});

describe('incomingFileTones', () => {
  it('offers a file that collides under the Conflicts chip too, keeping what the branch did to it', () => {
    expect(incomingFileTones(file('a.ts', { status: 'added' }), true)).toEqual(['added', 'conflict']);
    expect(incomingFileTones(file('a.ts', { status: 'added' }), false)).toEqual(['added']);
  });
});

describe('incomingFilesSummary', () => {
  const all = { kind: 'all' } as const;

  it('says what the update does to the workspace: the conflicts with local changes, then what applies', () => {
    expect(incomingFilesSummary(all, 14, 1)).toBe('1 conflict with your changes · 13 to apply');
    expect(incomingFilesSummary(all, 14, 2)).toBe('2 conflicts with your changes · 12 to apply');
    expect(incomingFilesSummary(all, 2, 2)).toBe('2 conflicts with your changes');
  });

  it('says the local changes stay as they are when nothing conflicts', () => {
    expect(incomingFilesSummary(all, 14, 0)).toBe('14 changes to apply · Your local changes stay as they are');
    expect(incomingFilesSummary(all, 1, 0)).toBe('1 change to apply · Your local changes stay as they are');
  });

  it("only counts a changeset's files: they are what it did, not what updating does", () => {
    expect(incomingFilesSummary({ kind: 'changeset', id: 3 }, 5, 1)).toBe('5 changes');
  });
});

describe('firstIncomingFile', () => {
  it('opens on the first file changed on both sides, or else on the first file', () => {
    const files = [file('a.ts'), file('b.ts')];
    expect(firstIncomingFile(files, (entry) => entry.path === 'b.ts')?.path).toBe('b.ts');
    expect(firstIncomingFile(files, () => false)?.path).toBe('a.ts');
    expect(firstIncomingFile([], () => false)).toBeUndefined();
  });
});

describe('incomingDiffTarget', () => {
  it("reads a file of the whole update from the loaded changeset to the head, and a changeset's from that changeset", () => {
    expect(incomingDiffTarget({ kind: 'all' }, 4, 9)).toEqual({ kind: 'range', fromSpec: 'cs:4', toSpec: 'cs:9' });
    expect(incomingDiffTarget({ kind: 'changeset', id: 7 }, 4, 9)).toEqual({ kind: 'changeset', changesetId: 7 });
  });

  it('keys each scope apart', () => {
    expect(scopeKey({ kind: 'all' })).not.toBe(scopeKey({ kind: 'changeset', id: 7 }));
  });
});
