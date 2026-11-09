import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** How every list of changed files shows them: one row each, or in their folders. */
export type FileListLayout = 'list' | 'tree';

/**
 * The order of the files of every list of changed files (`fileListOrder`): by path, folder by folder (the default);
 * by file name; by status, as the filter's chips are ordered; or by extension. Ties keep the path order.
 */
export type FileListSort = 'path' | 'name' | 'status' | 'extension';

/** How every list of changed files shows them, chosen in any of them (`FileListViewMenu`). */
export interface FileListView {
  layout: FileListLayout;
  sort: FileListSort;
  /** Files in a group per status (Changed, Added…), inside the list's own groups when it has some (changelists). */
  groupByStatus: boolean;
}

interface FileListViewStore extends FileListView {
  setLayout: (layout: FileListLayout) => void;
  setSort: (sort: FileListSort) => void;
  setGroupByStatus: (groupByStatus: boolean) => void;
}

/** Where the Changes view kept its own layout before every list shared one (`usePendingChangesViewStore`). */
const PENDING_CHANGES_VIEW_KEY = 'pending-changes-view';

/**
 * The one view of every list of changed files (Changes, the diffs, the details panels, Incoming, the merge page):
 * changed in any of them, it changes in all, and stays across sessions. Kept under the name it had when it held the
 * layout alone, so nobody loses their choice.
 */
export const useFileListViewStore = create<FileListViewStore>()(
  persist(
    (set) => ({
      layout: layoutFromPendingChangesView(storedPendingChangesView()),
      sort: 'path',
      groupByStatus: false,
      setLayout: (layout) => set({ layout }),
      setSort: (sort) => set({ sort }),
      setGroupByStatus: (groupByStatus) => set({ groupByStatus }),
    }),
    { name: 'file-list-layout', partialize: ({ layout, sort, groupByStatus }) => ({ layout, sort, groupByStatus }) },
  ),
);

/**
 * What the Changes view kept, in the window's storage. Outside a window (the tests) there is none: reaching for Node's
 * own `globalThis.localStorage` there prints a warning on every run.
 */
function storedPendingChangesView(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(PENDING_CHANGES_VIEW_KEY);
}

/** The layout to start from: the one chosen in the Changes view when it had its own, so nobody loses their choice. */
export function layoutFromPendingChangesView(stored: string | null): FileListLayout {
  try {
    const layout: unknown = stored && (JSON.parse(stored) as { state?: { layout?: unknown } }).state?.layout;
    return layout === 'tree' ? 'tree' : 'list';
  } catch {
    return 'list';
  }
}
