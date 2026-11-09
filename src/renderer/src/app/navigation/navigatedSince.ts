import type { Page } from './pages';
import type { ViewId } from './views';

/** Where the window is: its view, and the page on top of it, if any. */
export interface WindowWhere {
  view: ViewId;
  top: Page | undefined;
}

/**
 * Whether the window went somewhere else since `opened`: another view, or another page on top (a page opened, moved
 * or gone back from). What a dialog over a page closes on: whatever it opened from inside (a file's history from its
 * list, Annotate from its lines) shows behind it otherwise, under the modal.
 */
export function navigatedSince(opened: WindowWhere, now: WindowWhere): boolean {
  return opened.view !== now.view || opened.top !== now.top;
}
