import type { Keymap } from '@shared/shortcuts/keymap';
import { matchesFilter, type KeyboardFilter } from '../settings/keyboard/keyboardRows';
import { SHORTCUT_AREAS, SHORTCUTS, type ShortcutArea, type ShortcutId } from '@shared/shortcuts/shortcutRegistry';

export interface SheetRow {
  label: string;
  keys: readonly string[];
}

/**
 * The shortcuts sheet's rows, area by area in the registry's order: the views first under "Go to", in sidebar order,
 * then every shortcut with keys in the keymap (contextual ones included), a person's own keys among them, those the
 * filter keeps (`matchesFilter`). Shortcuts without keys on this OS, or that a person removed, are left out, and so
 * are areas left with nothing to show.
 */
export function shortcutSheet(
  views: readonly { label: string; shortcut: string }[],
  keymap: Keymap,
  filter: KeyboardFilter,
  mac: boolean,
): [ShortcutArea, SheetRow[]][] {
  const rows = new Map<ShortcutArea, SheetRow[]>(SHORTCUT_AREAS.map((area) => [area, []]));
  rows.set(
    'Go to',
    views.map((view) => ({ label: view.label, keys: [view.shortcut] })),
  );
  for (const id of Object.keys(SHORTCUTS) as ShortcutId[]) {
    const keys = keymap[id];
    if (keys.length > 0) rows.get(SHORTCUTS[id].area)!.push({ label: SHORTCUTS[id].label, keys });
  }
  return [...rows]
    .map(([area, areaRows]): [ShortcutArea, SheetRow[]] => [area, areaRows.filter((row) => matchesFilter(row.label, area, row.keys, filter, mac))])
    .filter(([, areaRows]) => areaRows.length > 0);
}
