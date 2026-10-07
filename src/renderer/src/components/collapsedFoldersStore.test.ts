import { describe, expect, it } from 'vitest';
import { toggledKey } from './collapsedFoldersStore';

describe('toggledKey', () => {
  it('closes an open folder and opens a closed one, leaving the given set as it was', () => {
    const closed = new Set(['folder:all:src']);
    expect([...toggledKey(closed, 'folder:all:lib')]).toEqual(['folder:all:src', 'folder:all:lib']);
    expect([...toggledKey(closed, 'folder:all:src')]).toEqual([]);
    expect([...closed]).toEqual(['folder:all:src']);
  });
});
