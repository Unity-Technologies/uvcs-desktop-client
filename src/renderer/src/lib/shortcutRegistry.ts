/**
 * The renderer's side of the shortcut registry (`@shared/shortcuts/shortcutRegistry`, every shortcut of the app): the
 * keys a shortcut takes on this OS.
 */
import { SHORTCUTS, shortcutKeys, type ShortcutId } from '@shared/shortcuts/shortcutRegistry';
import { isMac } from './platform';

/** The key that runs a shortcut. */
export function hotkey(id: ShortcutId): string {
  return hotkeys(id)[0]!;
}

/** Every key of a shortcut, the binding first. */
export function hotkeys(id: ShortcutId): readonly string[] {
  return shortcutKeys(SHORTCUTS[id], isMac);
}
