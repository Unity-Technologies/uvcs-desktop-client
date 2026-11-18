import type { FocusMover } from '../../lib/focusRing';

/** Why the main list takes focus: the workspace screen just opened, or the user navigated (⌘1…, the sidebar, a page). */
export type MainFocusReason = 'workspaceOpened' | 'navigated';

/**
 * What moves focus to the main list (`focusMain`'s `mover`). Opening the workspace is the app on its own: before any
 * input Chromium rings a focus a script moves, which drew the keyboard ring around the selected row of the first view.
 * After navigating, the keyboard's lets Chromium ring it as the user navigated: after a key, not after a click.
 */
export function mainFocusMover(reason: MainFocusReason): FocusMover {
  return reason === 'workspaceOpened' ? 'app' : 'keyboard';
}
