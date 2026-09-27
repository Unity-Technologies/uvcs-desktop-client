import { SEPARATOR, type Action, type MenuEntry, type Submenu } from './actions';

/**
 * The groups of every object's menu, in the order they show (docs/ARCHITECTURE.md, Menus):
 * - `primary`: what Enter or a double-click does (the details panel's button).
 * - `act`: what it does to the workspace or the object: switch to it, apply it, include it, check it out, review it.
 * - `merge`: merging it somewhere: into the workspace, to its parent, to another branch, cherry picks.
 * - `create`: new things from it: a branch, a label, a code review, a file.
 * - `navigate`: other views of it: its history, annotations, repository tree, place in the Branch Explorer.
 * - `external`: the OS: open it in another app, reveal it, open a terminal on it, save a copy.
 * - `clipboard`: its one "Copy" submenu (names, specs and paths), and Cut and Paste where items move.
 * - `edit`: what it is called, says or is filed under: rename, comments, changelists, ignore rules, hiding.
 * - `danger`: what undoes or deletes it, last.
 */
export const MENU_GROUPS = ['primary', 'act', 'merge', 'create', 'navigate', 'external', 'clipboard', 'edit', 'danger'] as const;

export type MenuGroup = (typeof MENU_GROUPS)[number];

/** An entry that knows its group, as the menu vocabulary (`components/menuWords`) makes them. */
export type GroupedEntry = (Action | Submenu) & { menuGroup: MenuGroup };

/**
 * A menu from its entries, whatever order they are listed in: each group in the order above, entries keeping their
 * order within it (what a context adds after the common ones stays after them), a separator between groups.
 */
export function groupedMenu(entries: (GroupedEntry | false | null | undefined)[]): MenuEntry[] {
  const present = entries.filter((entry): entry is GroupedEntry => Boolean(entry));
  return MENU_GROUPS.flatMap((group) => {
    const inGroup = present.filter((entry) => entry.menuGroup === group);
    return inGroup.length > 0 ? [SEPARATOR, ...inGroup] : [];
  }).slice(1);
}

/** The group of a menu entry, where it was made from the vocabulary. */
export function groupOf(entry: MenuEntry): MenuGroup | undefined {
  return typeof entry === 'object' && 'menuGroup' in entry ? (entry.menuGroup as MenuGroup) : undefined;
}

/**
 * An object's menu with what a place adds (the Branch Explorer's "Go to head changeset", the palette's "Show in
 * Files"), each entry at the end of its group: the common entries keep their words, icons and order everywhere.
 * The menu must be made from grouped entries, as every object's is.
 */
export function withEntries(menu: MenuEntry[], added: (GroupedEntry | false | null | undefined)[]): MenuEntry[] {
  const grouped = menu.filter((entry): entry is GroupedEntry => groupOf(entry) !== undefined);
  return groupedMenu([...grouped, ...added]);
}
