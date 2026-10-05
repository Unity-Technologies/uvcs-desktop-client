import { isMac } from '../../../../lib/platform';
import { hotkeys, type ShortcutId } from '../../../../lib/shortcutRegistry';
import { matchesShortcut, type PressedKey } from '../../../../lib/shortcuts';

/** What a key pressed on the focused model stage does to the view. */
export type ModelViewCommand = 'frame' | 'frameAll';

const MODEL_SHORTCUTS: [ShortcutId, ModelViewCommand][] = [
  ['modelFrame', 'frame'],
  ['modelFrameAll', 'frameAll'],
];

/**
 * The model stage's keys, from the registry: F frames the part picked, or the whole model, as Unity's Scene view
 * does; 0 frames the whole model, as 0 fits an image. Held with ⌘, Ctrl or Alt they're the window's.
 */
export function modelCommandOf(event: PressedKey, mac = isMac): ModelViewCommand | null {
  return MODEL_SHORTCUTS.find(([id]) => hotkeys(id).some((key) => matchesShortcut(event, key, mac)))?.[1] ?? null;
}
