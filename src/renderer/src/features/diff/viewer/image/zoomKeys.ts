import { isMac } from '../../../../lib/platform';
import { hotkeys, type ShortcutId } from '../../../../lib/shortcutRegistry';
import { matchesShortcut, type PressedKey } from '../../../../lib/shortcuts';

/** What a key pressed on the focused image stage does: to the view, or comment on the image. */
export type ZoomCommand = 'zoomIn' | 'zoomOut' | 'zoomToFit' | 'zoomToActualSize';
export type StageCommand = ZoomCommand | 'comment';

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

/** The stage's keys with C, which starts or stops marking a comment's spot where the image takes comments. */
export function stageCommandOf(event: PressedKey, mac = isMac): StageCommand | null {
  if (hotkeys('imageComment').some((key) => matchesShortcut(event, key, mac))) return 'comment';
  return zoomCommandOf(event, mac);
}
