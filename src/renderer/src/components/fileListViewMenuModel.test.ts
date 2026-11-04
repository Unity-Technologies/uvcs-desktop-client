import { describe, expect, it } from 'vitest';
import { fileListViewMenu } from './fileListViewMenuModel';
import type { FileListView } from './fileListViewStore';

const view: FileListView = { layout: 'list', sort: 'path', groupByStatus: false };

describe('fileListViewMenuModel', () => {
  it('offers every list its layout and its sort, the chosen ones marked', () => {
    const menu = fileListViewMenu({ ...view, layout: 'tree', sort: 'name' }, { statusGroups: false });
    expect(menu.layouts.map((layout) => layout.label)).toEqual(['List', 'Tree']);
    expect(menu.layout).toBe('tree');
    expect(menu.sorts.map((sort) => sort.label)).toEqual(['Path', 'Name', 'Status', 'Extension']);
    expect(menu.sort).toBe('name');
  });

  it('offers no grouping where the list has its own groups only (the merge page)', () => {
    expect(fileListViewMenu(view, { statusGroups: false }).groupings).toEqual([]);
  });

  it('offers grouping by status in the other lists, and by changelist in Changes', () => {
    expect(fileListViewMenu({ ...view, groupByStatus: true }, { statusGroups: true }).groupings).toEqual([{ value: 'status', label: 'Status', on: true }]);
    expect(fileListViewMenu(view, { statusGroups: true, changelists: true }).groupings).toEqual([
      { value: 'changelist', label: 'Changelist', on: true },
      { value: 'status', label: 'Status', on: false },
    ]);
  });

  it('names the view on its button, saying only what is not the default', () => {
    expect(fileListViewMenu(view, { statusGroups: true }).summary).toBe('View options: List');
    expect(fileListViewMenu({ layout: 'tree', sort: 'extension', groupByStatus: true }, { statusGroups: true, changelists: true }).summary).toBe(
      'View options: Tree, grouped by changelist and status, sorted by extension',
    );
  });

  it("doesn't name a grouping the list doesn't offer", () => {
    expect(fileListViewMenu({ ...view, groupByStatus: true }, { statusGroups: false }).summary).toBe('View options: List');
  });
});
