import { ArrowDownUp, CircleDot, List, ListTree } from 'lucide-react';
import { FILE_LIST_SORTS, type FileListLayout, type FileListSort, type FileListView } from '../../components/fileListViewStore';
import type { Command } from './commandStore';

interface FileListViewChanges {
  setLayout: (layout: FileListLayout) => void;
  setSort: (sort: FileListSort) => void;
  setGroupByStatus: (on: boolean) => void;
}

const SORT_LABELS: Record<FileListSort, string> = { path: 'path', name: 'name', status: 'status', extension: 'extension' };

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
    ...FILE_LIST_SORTS.map(
      (sort): Command => ({
        id: `files.sort.${sort}`,
        group: 'Files',
        label: `Sort files by ${SORT_LABELS[sort]}`,
        icon: ArrowDownUp,
        keywords: ['order', 'view'],
        checked: sort === view.sort,
        run: () => change.setSort(sort),
      }),
    ),
  ];
}
