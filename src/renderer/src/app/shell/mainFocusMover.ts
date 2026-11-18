import type { FocusMover } from '../../lib/focusRing';
import { isAimedAtMainList } from './mainFocusKeys';

/** Why the main list takes focus: a workspace or repository just opened, or the user navigated (⌘1…, the sidebar, a page). */
export type MainFocusReason = 'placeOpened' | 'navigated';

/**
 * What moves focus to the main list (`focusMain`'s `mover`). A place opening is the app on its own: before any input
 * Chromium rings a focus a script moves, which drew the keyboard ring around the selected row of the first view.
 * After navigating, the keyboard's lets Chromium ring it as the user navigated: after a key, not after a click.
 */
export function mainFocusMover(reason: MainFocusReason): FocusMover {
  return reason === 'placeOpened' ? 'app' : 'keyboard';
}

/**
 * Whether a key gives the keyboard ring to the main list the app focused ringless (`focusAs`'s `focusVisible: false`
 * keeps it off through every key until focus moves): the first key aimed at it, as a list reached by a click rings at
 * its first key.
 */
export function ringsAtKey(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>, list: { ringless: boolean; onMainList: boolean }): boolean {
  return list.ringless && list.onMainList && isAimedAtMainList(event);
}
