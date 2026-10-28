import { describe, expect, it } from 'vitest';
import { EMPTY_SELECTION, singleSelection } from '../../lib/selection';
import { rowKeyAfterLayout } from './selectionFollowsItem';

// In a list a folder conflict is a row of its own; in a tree it is its folder's row.
const treeRows = (itemKey: string): string => (itemKey === 'directory:0' ? 'folder:group:directoryConflicts:src/shared' : itemKey);
const listRows = (itemKey: string): string => itemKey;
const listed = (): boolean => true;

describe('rowKeyAfterLayout', () => {
  it('moves a folder conflict selected in a list to its folder row in a tree', () => {
    expect(rowKeyAfterLayout('directory:0', singleSelection('directory:0'), listed, treeRows)).toBe('folder:group:directoryConflicts:src/shared');
  });

  it('moves it back to its own row in a list', () => {
    expect(rowKeyAfterLayout('directory:0', singleSelection('folder:group:directoryConflicts:src/shared'), listed, listRows)).toBe('directory:0');
  });

  it('leaves a selection already on the row showing the item', () => {
    expect(rowKeyAfterLayout('file:/a.cs', singleSelection('file:/a.cs'), listed, treeRows)).toBeNull();
  });

  it('leaves a selection of several rows as it is', () => {
    const several = { selected: new Set(['directory:0', 'file:/a.cs']), anchor: 'directory:0' };
    expect(rowKeyAfterLayout('directory:0', several, listed, treeRows)).toBeNull();
  });

  it('leaves the selection when its item is filtered out, instead of selecting a row that is not there', () => {
    expect(rowKeyAfterLayout('directory:0', singleSelection('directory:0'), () => false, treeRows)).toBeNull();
  });

  it('does nothing without an item selected', () => {
    expect(rowKeyAfterLayout(undefined, EMPTY_SELECTION, listed, treeRows)).toBeNull();
  });
});
