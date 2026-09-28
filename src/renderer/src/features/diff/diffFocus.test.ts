import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { entryToFocus } from './diffFocus';

const entry = (path: string, status: DiffEntry['status'] = 'changed', oldPath?: string): DiffEntry => ({
  status,
  path,
  oldPath,
  itemType: 'file',
  baseRevisionId: 1,
  revisionId: 2,
  repository: 'game@local',
});

const entries = [entry('a.ts'), entry('src/new.ts', 'moved', 'src/old.ts'), entry('b.ts', 'deleted')];

describe('entryToFocus', () => {
  it('finds the file asked for', () => {
    expect(entryToFocus(entries, 'b.ts')).toBe(entries[2]);
  });

  it('finds a moved file by its new or its old path', () => {
    expect(entryToFocus(entries, 'src/new.ts')).toBe(entries[1]);
    expect(entryToFocus(entries, 'src/old.ts')).toBe(entries[1]);
  });

  it('prefers the file now at a path over the one moved away from it', () => {
    const replaced = [entry('x.ts', 'moved', 'y.ts'), entry('y.ts', 'added')];
    expect(entryToFocus(replaced, 'y.ts')).toBe(replaced[1]);
  });

  it('falls back to the first file when the path is not in the list or none is asked for', () => {
    expect(entryToFocus(entries, 'missing.ts')).toBe(entries[0]);
    expect(entryToFocus(entries)).toBe(entries[0]);
  });

  it('has nothing to focus in an empty diff', () => {
    expect(entryToFocus([], 'a.ts')).toBeUndefined();
  });
});
