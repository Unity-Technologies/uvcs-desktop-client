import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** How every list of changed files shows them: one row each, or in their folders. */
export type FileListLayout = 'list' | 'tree';

interface FileListLayoutStore {
  layout: FileListLayout;
  setLayout: (layout: FileListLayout) => void;
}

/** Where the Changes view kept its own layout before every list shared one (`usePendingChangesViewStore`). */
const PENDING_CHANGES_VIEW_KEY = 'pending-changes-view';

/**
 * The one layout of every list of changed files (Changes, the diffs, the details panels, Incoming, the merge page):
 * switched in any of them, it changes in all, and stays across sessions.
 */
export const useFileListLayoutStore = create<FileListLayoutStore>()(
  persist(
    (set) => ({
      layout: layoutFromPendingChangesView(storedPendingChangesView()),
      setLayout: (layout) => set({ layout }),
    }),
    { name: 'file-list-layout', partialize: ({ layout }) => ({ layout }) },
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
