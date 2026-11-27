import type { Keymap } from '@shared/shortcuts/keymap';
import { SHORTCUT_AREAS, SHORTCUTS, type ShortcutArea, type ShortcutId } from '@shared/shortcuts/shortcutRegistry';

export interface SheetRow {
  label: string;
  keys: readonly string[];
}

/**
 * The shortcuts sheet's rows, area by area in the registry's order: the views first under "Go to", in sidebar order,
 * then every shortcut with keys in the keymap (contextual ones included), a person's own keys among them. Shortcuts
 * without keys on this OS, or that a person removed, are left out, and so are areas left with nothing to show.
 */
export function shortcutSheet(views: readonly { label: string; shortcut: string }[], keymap: Keymap): [ShortcutArea, SheetRow[]][] {
  const rows = new Map<ShortcutArea, SheetRow[]>(SHORTCUT_AREAS.map((area) => [area, []]));
  rows.set(
    'Go to',
    views.map((view) => ({ label: view.label, keys: [view.shortcut] })),
  );
  for (const id of Object.keys(SHORTCUTS) as ShortcutId[]) {
    const keys = keymap[id];
    if (keys.length > 0) rows.get(SHORTCUTS[id].area)!.push({ label: SHORTCUTS[id].label, keys });
  }
  return [...rows].filter(([, areaRows]) => areaRows.length > 0);
}
