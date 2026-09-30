import { isMac } from '../../../../lib/platform';
import { hotkeys, type ShortcutId } from '../../../../lib/shortcutRegistry';
import { matchesShortcut, type PressedKey } from '../../../../lib/shortcuts';

/** What a key pressed on the focused image stage does to the view. */
export type ZoomCommand = 'zoomIn' | 'zoomOut' | 'zoomToFit' | 'zoomToActualSize';

const ZOOM_SHORTCUTS: [ShortcutId, ZoomCommand][] = [
  ['imageZoomIn', 'zoomIn'],
  ['imageZoomOut', 'zoomOut'],
  ['imageFit', 'zoomToFit'],
  ['imageActualSize', 'zoomToActualSize'],
];

/**
 * The image stage's keys, from the registry: + (or =) and − step the zoom, 0 fits the image, 1 shows it at 100%.
 * Held with ⌘, Ctrl or Alt they're the window's (⌘1 goes to the first view), not the image's.
 */
export function zoomCommandOf(event: PressedKey, mac = isMac): ZoomCommand | null {
  return ZOOM_SHORTCUTS.find(([id]) => hotkeys(id).some((key) => matchesShortcut(event, key, mac)))?.[1] ?? null;
}
