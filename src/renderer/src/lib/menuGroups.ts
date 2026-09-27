import { SEPARATOR, tidyMenu, type MenuEntry } from './actions';

/**
 * The groups of every object's menu, in the order they show (docs/ARCHITECTURE.md, Menus):
 * - `primary`: what Enter or a double-click does (the details panel's button), and its close variants.
 * - `act`: the object's main operations: switch to it, merge it, apply it, include it, check it out, release it.
 * - `create`: new things from it: a branch, a label, a code review, a file, a workspace.
 * - `navigate`: other views of it: its history, annotations, repository tree, place in the Branch Explorer.
 * - `external`: the OS: reveal it, open a terminal or another app on it, save a copy.
 * - `copy`: its names, specs and paths to the clipboard.
 * - `edit`: what it is called, says or is filed under: rename, comments, changelists, ignore rules, hiding.
 * - `danger`: what undoes or deletes it, last.
 */
export const MENU_GROUPS = ['primary', 'act', 'create', 'navigate', 'external', 'copy', 'edit', 'danger'] as const;

export type MenuGroup = (typeof MENU_GROUPS)[number];

type GroupEntries = (MenuEntry | false | null | undefined)[];

/** A menu from its groups, in the order above with a separator between them; a long group may hold separators of its own. */
export function groupedMenu(groups: Partial<Record<MenuGroup, GroupEntries>>): MenuEntry[] {
  return tidyMenu(MENU_GROUPS.flatMap((group) => [SEPARATOR, ...(groups[group] ?? [])]));
}
