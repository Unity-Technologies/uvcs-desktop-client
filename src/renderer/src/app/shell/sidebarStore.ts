import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Below this window width the sidebar folds into its icon rail, so the lists keep their room. */
const NARROW_WINDOW = '(max-width: 999px)';

export const SIDEBAR_SHORTCUT = 'mod+\\';

interface SidebarStore {
  /** The choice for wide windows, remembered across sessions. */
  collapsed: boolean;
  /** Opened by hand while the window is narrow; forgotten once it's wide again or the app restarts. */
  expandedWhileNarrow: boolean;
  setCollapsed: (collapsed: boolean) => void;
  setExpandedWhileNarrow: (expanded: boolean) => void;
}

const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      expandedWhileNarrow: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      setExpandedWhileNarrow: (expandedWhileNarrow) => set({ expandedWhileNarrow }),
    }),
    { name: 'sidebar', partialize: ({ collapsed }) => ({ collapsed }) },
  ),
);

const narrowQuery = window.matchMedia(NARROW_WINDOW);

function subscribeToWidth(onChange: () => void): () => void {
  const listener = (): void => {
    useSidebarStore.getState().setExpandedWhileNarrow(false);
    onChange();
  };
  narrowQuery.addEventListener('change', listener);
  return () => narrowQuery.removeEventListener('change', listener);
}

function isNarrowWindow(): boolean {
  return narrowQuery.matches;
}

/** Whether the sidebar shows as its icon rail: always in narrow windows unless opened by hand, else as chosen. */
export function useSidebarCollapsed(): boolean {
  const narrow = useSyncExternalStore(subscribeToWidth, isNarrowWindow);
  const { collapsed, expandedWhileNarrow } = useSidebarStore();
  return narrow ? !expandedWhileNarrow : collapsed;
}

/** Folds or unfolds the sidebar: for this narrow window only, or as the lasting choice when the window is wide. */
export function toggleSidebar(): void {
  const { collapsed, expandedWhileNarrow, setCollapsed, setExpandedWhileNarrow } = useSidebarStore.getState();
  if (isNarrowWindow()) setExpandedWhileNarrow(!expandedWhileNarrow);
  else setCollapsed(!collapsed);
}
