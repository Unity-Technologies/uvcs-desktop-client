import { isMac } from '../../lib/platform';
import { matchesShortcut, type PressedKey } from '../../lib/shortcuts';
import { SHORTCUTS, shortcutKeys } from '../../lib/shortcutRegistry';

/** The step a key takes through the palette's scope chips (`paletteScope`): the next one, the one before, or none. */
export function scopeStepOf(event: PressedKey, mac = isMac): 1 | -1 | null {
  const [previous, next] = shortcutKeys(SHORTCUTS.paletteScope, mac);
  if (next && matchesShortcut(event, next, mac)) return 1;
  if (previous && matchesShortcut(event, previous, mac)) return -1;
  return null;
}
