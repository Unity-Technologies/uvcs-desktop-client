/**
 * The renderer's side of the shortcut registry (`@shared/shortcuts/shortcutRegistry`, every shortcut of the app): the
 * keys a shortcut takes in this window, the ones a person chose included (`keymapStore`).
 */
import type { CustomizableShortcutId, ShortcutId } from '@shared/shortcuts/shortcutRegistry';
import { useKeymapStore } from './keymapStore';

/**
 * The key that runs a shortcut. One a person may change may have none (they removed it); the others always have one,
 * but for the few kept to one OS (`offMacOnly`), which only that OS binds.
 */
export function hotkey<Id extends ShortcutId>(id: Id): Id extends CustomizableShortcutId ? string | undefined : string;
export function hotkey(id: ShortcutId): string | undefined {
  return hotkeys(id)[0];
}

/**
 * A shortcut's keys after its binding: the ones its command doesn't run (a command runs on one key), which the view
 * binds itself.
 */
export function alternativeKeys(id: ShortcutId): readonly string[] {
  return hotkeys(id).slice(1);
}

/** Every key of a shortcut, the binding first. */
export function hotkeys(id: ShortcutId): readonly string[] {
  return useKeymapStore.getState().keymap[id];
}
