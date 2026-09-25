import type { ComponentType } from 'react';

export type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

/** Something the user can do. Drives context menus, dropdowns and the command palette alike. */
export interface Action {
  id: string;
  label: string;
  icon?: Icon;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

export interface Submenu {
  label: string;
  icon?: Icon;
  entries: MenuEntry[];
}

export const SEPARATOR = 'separator' as const;

export type MenuEntry = Action | Submenu | typeof SEPARATOR;

export function isSubmenu(entry: MenuEntry): entry is Submenu {
  return typeof entry === 'object' && 'entries' in entry;
}

/** Drops separators left at the edges or doubled after conditional entries are filtered out. */
export function tidyMenu(entries: (MenuEntry | false | null | undefined)[]): MenuEntry[] {
  const present = entries.filter((entry): entry is MenuEntry => Boolean(entry));
  return present.filter(
    (entry, index) => entry !== SEPARATOR || (index > 0 && index < present.length - 1 && present[index - 1] !== SEPARATOR),
  );
}

/** The menu without the action `id`, e.g. the one a details panel already offers as its primary button. */
export function withoutAction(entries: MenuEntry[], id: string): MenuEntry[] {
  return tidyMenu(entries.filter((entry) => typeof entry !== 'object' || !('id' in entry) || entry.id !== id));
}
