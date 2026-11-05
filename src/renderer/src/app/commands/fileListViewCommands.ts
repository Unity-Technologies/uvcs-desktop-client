import { ArrowDownUp, CircleDot, List, ListTree } from 'lucide-react';
import { SORTS } from '../../components/fileListViewMenuModel';
import type { FileListLayout, FileListSort, FileListView } from '../../components/fileListViewStore';
import type { Command } from './commandStore';

interface FileListViewChanges {
  setLayout: (layout: FileListLayout) => void;
  setSort: (sort: FileListSort) => void;
  setGroupByStatus: (on: boolean) => void;
}

/**
 * The view menu of every list of files (`FileListViewMenu`) from the palette: the other layout, grouping by status on
 * or off, and each sort, the one chosen marked. They change every list at once, as the menu does.
 */
export function fileListViewCommands(view: FileListView, change: FileListViewChanges): Command[] {
  const otherLayout: FileListLayout = view.layout === 'tree' ? 'list' : 'tree';
  return [
    {
      id: 'files.layout',
      group: 'Files',
      label: otherLayout === 'tree' ? 'Show files as a tree' : 'Show files as a list',
      icon: otherLayout === 'tree' ? ListTree : List,
      keywords: ['folders', 'flat', 'layout', 'view'],
      run: () => change.setLayout(otherLayout),
    },
    {
      id: 'files.groupByStatus',
      group: 'Files',
      label: view.groupByStatus ? 'Stop grouping files by status' : 'Group files by status',
      icon: CircleDot,
      keywords: ['changed', 'added', 'deleted', 'moved', 'private', 'view'],
      run: () => change.setGroupByStatus(!view.groupByStatus),
    },
    ...SORTS.map(
      (sort): Command => ({
        id: `files.sort.${sort.value}`,
        group: 'Files',
        label: `Sort files by ${sort.label.toLowerCase()}`,
        icon: ArrowDownUp,
        keywords: ['order', 'view'],
        checked: sort.value === view.sort,
        run: () => change.setSort(sort.value),
      }),
    ),
  ];
}
