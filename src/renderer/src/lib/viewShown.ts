import { createContext } from 'react';

/**
 * Whether the view around is shown: false inside one kept mounted but hidden (a review's tab not picked, kept as it was
 * left). Shown unless a hidden view says otherwise.
 */
export const ViewShownContext = createContext(true);

/** Whether a window shortcut listens (`useShortcut`): asked to, and in a view shown; a hidden view's keys do nothing. */
export function shortcutListens(enabled: boolean, viewShown: boolean): boolean {
  return enabled && viewShown;
}
