import type { Page } from '../navigation/pages';
import { isMovablePage } from './movablePages';

/** A way the page on screen asks to go somewhere: another view, another page, or back. */
export type NavigationRequest = { kind: 'goToView' } | { kind: 'openPage'; page: Page } | { kind: 'goBack' };

/**
 * Where a page window takes a navigation its page asks for, as pages ask the same anywhere ("Show in Branch Explorer",
 * a merge from a menu, back after deleting a review): `here` within the window; `workspaceWindow` for what only that
 * window shows (its views, a merge, which stays with the workspace); `close` for back past the page it opened on,
 * which leaves nothing to show.
 */
export function routeInPageWindow(request: NavigationRequest, pages: readonly Page[]): 'here' | 'workspaceWindow' | 'close' {
  switch (request.kind) {
    case 'goToView':
      return 'workspaceWindow';
    case 'openPage':
      return isMovablePage(request.page) ? 'here' : 'workspaceWindow';
    case 'goBack':
      return pages.length > 1 ? 'here' : 'close';
  }
}
