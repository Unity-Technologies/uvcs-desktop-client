import type { Keymap } from './keymap';
import { SHORTCUTS, type ShortcutDefinition, type ShortcutId } from './shortcutRegistry';

/**
 * The accelerator a native menu item shows for the command it runs: its shortcut's binding (`commandId`), as the
 * keymap has it, a person's choice included; none when it has no shortcut. Written as Electron's menus take keys.
 */
export function menuAccelerator(keymap: Keymap, commandId: string): string | undefined {
  const id = (Object.keys(SHORTCUTS) as ShortcutId[]).find((candidate) => (SHORTCUTS[candidate] as ShortcutDefinition).commandId === commandId);
  const key = id && keymap[id][0];
  return key ? toAccelerator(key) : undefined;
}

const ACCELERATOR_NAMES: Readonly<Record<string, string>> = {
  mod: 'CmdOrCtrl',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  pageup: 'PageUp',
  pagedown: 'PageDown',
};

/** A registry key (`mod+shift+e`) as an Electron accelerator (`CmdOrCtrl+Shift+E`). */
export function toAccelerator(key: string): string {
  return key
    .split('+')
    .map((part) => ACCELERATOR_NAMES[part] ?? part.charAt(0).toUpperCase() + part.slice(1))
    .join('+');
}
