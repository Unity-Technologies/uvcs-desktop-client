import { create } from 'zustand';

/** The item a Browse repository page shows now: what its link names (`pageObjectTarget`, `pageLinkTarget`). */
export interface ShownBrowseItem {
  changesetId: number;
  /** A repository path, as `TreeItem.path` ('' for the root). */
  path: string;
}

/** The item the Browse repository page on screen shows; null while none is selected or no such page shows. */
export const useShownBrowseItem = create<{ shown: ShownBrowseItem | null }>(() => ({ shown: null }));

export function sameShownBrowseItem(a: ShownBrowseItem | null, b: ShownBrowseItem | null): boolean {
  if (a === null || b === null) return a === b;
  return a.changesetId === b.changesetId && a.path === b.path;
}

/** Says which item the page shows, only when it changes: what listens renders the page again. */
export function publishShownBrowseItem(shown: ShownBrowseItem | null): void {
  if (!sameShownBrowseItem(useShownBrowseItem.getState().shown, shown)) useShownBrowseItem.setState({ shown });
}
