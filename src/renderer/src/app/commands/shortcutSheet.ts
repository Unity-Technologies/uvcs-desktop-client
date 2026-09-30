import { SHORTCUT_AREAS, shortcutKeys, type ShortcutArea, type ShortcutDefinition } from '../../lib/shortcutRegistry';

export interface SheetRow {
  label: string;
  keys: readonly string[];
}

/**
 * The shortcuts sheet's rows, area by area in the registry's order: the views first under "Go to", in sidebar order,
 * then every shortcut this OS has (contextual ones included). Areas with nothing to show are left out.
 */
export function shortcutSheet(
  views: readonly { label: string; shortcut: string }[],
  shortcuts: readonly ShortcutDefinition[],
  mac: boolean,
): [ShortcutArea, SheetRow[]][] {
  const rows = new Map<ShortcutArea, SheetRow[]>(SHORTCUT_AREAS.map((area) => [area, []]));
  rows.set(
    'Go to',
    views.map((view) => ({ label: view.label, keys: [view.shortcut] })),
  );
  for (const shortcut of shortcuts) {
    const keys = shortcutKeys(shortcut, mac);
    if (keys.length > 0) rows.get(shortcut.area)!.push({ label: shortcut.label, keys });
  }
  return [...rows].filter(([, areaRows]) => areaRows.length > 0);
}
