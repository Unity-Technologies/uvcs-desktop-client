import { describe, expect, it, vi } from 'vitest';
import { fileListViewCommands } from './fileListViewCommands';

const changes = () => ({ setLayout: vi.fn(), setSort: vi.fn(), setGroupByStatus: vi.fn() });

describe('fileListViewCommands', () => {
  it('offers the other layout, and switches every list to it', () => {
    const change = changes();
    const [layout] = fileListViewCommands({ layout: 'list', sort: 'path', groupByStatus: false }, change);
    expect(layout!.label).toBe('Show files as a tree');
    layout!.run();
    expect(change.setLayout).toHaveBeenCalledWith('tree');
    expect(fileListViewCommands({ layout: 'tree', sort: 'path', groupByStatus: false }, change)[0]!.label).toBe('Show files as a list');
  });

  it('turns grouping by status on, or off once on', () => {
    const change = changes();
    const grouping = (on: boolean) => fileListViewCommands({ layout: 'list', sort: 'path', groupByStatus: on }, change)[1]!;
    expect(grouping(false).label).toBe('Group files by status');
    expect(grouping(true).label).toBe('Stop grouping files by status');
    grouping(true).run();
    expect(change.setGroupByStatus).toHaveBeenCalledWith(false);
  });

  it('offers every sort, the one chosen marked', () => {
    const sorts = fileListViewCommands({ layout: 'list', sort: 'name', groupByStatus: false }, changes()).slice(2);
    expect(sorts.map((sort) => [sort.label, sort.checked])).toEqual([
      ['Sort files by path', false],
      ['Sort files by name', true],
      ['Sort files by status', false],
      ['Sort files by extension', false],
    ]);
  });
});
