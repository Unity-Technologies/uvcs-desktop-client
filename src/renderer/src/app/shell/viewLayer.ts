import type { Page } from '../navigation/pages';

/**
 * Whether the place's view shows: not while a page is over it, where it stays mounted, hidden, so going back finds
 * its scroll and selection. Hidden, its window shortcuts listen to nothing (`ViewShownContext`, `useShortcut`): ⌘↩
 * under a merge page would check in too.
 */
export function viewLayerShown(topPage: Page | undefined): boolean {
  return topPage === undefined;
}
