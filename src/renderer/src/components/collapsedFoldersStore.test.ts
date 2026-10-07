import { describe, expect, it } from 'vitest';
import { folderListScope, toggledKey, withoutKeys } from './collapsedFoldersStore';

describe('toggledKey', () => {
  it('closes an open folder and opens a closed one, leaving the given set as it was', () => {
    const closed = new Set(['folder:all:src']);
    expect([...toggledKey(closed, 'folder:all:lib')]).toEqual(['folder:all:src', 'folder:all:lib']);
    expect([...toggledKey(closed, 'folder:all:src')]).toEqual([]);
    expect([...closed]).toEqual(['folder:all:src']);
  });
});

describe('folderListScope', () => {
  it('tells the same list of two workspaces apart: /main/feature in one repository is not in another', () => {
    const list = 'diff:{"kind":"branch","branch":"/main/feature"}';
    expect(folderListScope('/work/a', list)).not.toBe(folderListScope('/work/b', list));
  });

  it('keeps one list of one workspace the same, so going back finds its folders as they were', () => {
    expect(folderListScope('/work/a', 'incoming:all')).toBe(folderListScope('/work/a', 'incoming:all'));
  });

  it('never lets a workspace path that ends like another list run into it', () => {
    expect(folderListScope('/work/a:diff', 'x')).not.toBe(folderListScope('/work/a', 'diff:x'));
  });
});

describe('withoutKeys', () => {
  it('opens the folders named, leaving the given set as it was', () => {
    const closed = new Set(['folder:all:src', 'folder:all:lib']);
    expect([...withoutKeys(closed, ['folder:all:src', 'folder:all:other'])]).toEqual(['folder:all:lib']);
    expect([...closed]).toEqual(['folder:all:src', 'folder:all:lib']);
  });

  it('gives back the very set when none of them is closed, so nothing renders again', () => {
    const closed = new Set(['folder:all:src']);
    expect(withoutKeys(closed, ['folder:all:lib'])).toBe(closed);
  });
});
