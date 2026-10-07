import { useCallback } from 'react';
import { create } from 'zustand';

const NONE: ReadonlySet<string> = new Set();

interface CollapsedFoldersStore {
  /** The folder rows closed in each list of files, by the list's scope (`useCollapsedFolders`). */
  byScope: ReadonlyMap<string, ReadonlySet<string>>;
  toggle: (scope: string, key: string) => void;
  open: (scope: string, keys: readonly string[]) => void;
}

const useCollapsedFoldersStore = create<CollapsedFoldersStore>()((set) => ({
  byScope: new Map(),
  toggle: (scope, key) => set(({ byScope }) => ({ byScope: new Map(byScope).set(scope, toggledKey(byScope.get(scope) ?? NONE, key)) })),
  open: (scope, keys) =>
    set(({ byScope }) => {
      const closed = byScope.get(scope) ?? NONE;
      const opened = withoutKeys(closed, keys);
      return opened === closed ? {} : { byScope: new Map(byScope).set(scope, opened) };
    }),
}));

/**
 * The folders closed in one list of files, and a way to open or close one. A scope is one list of one thing (the
 * Changes of a workspace, the diff of a changeset, its details pane): going back to it finds its folders as they were
 * left, for the session, and closing one in a changeset's diff leaves every other diff alone.
 */
export function useCollapsedFolders(scope: string): { collapsed: ReadonlySet<string>; toggleCollapsed: (key: string) => void; openFolders: (keys: readonly string[]) => void } {
  const collapsed = useCollapsedFoldersStore((state) => state.byScope.get(scope) ?? NONE);
  const toggle = useCollapsedFoldersStore((state) => state.toggle);
  const open = useCollapsedFoldersStore((state) => state.open);
  const toggleCollapsed = useCallback((key: string) => toggle(scope, key), [toggle, scope]);
  const openFolders = useCallback((keys: readonly string[]) => open(scope, keys), [open, scope]);
  return { collapsed, toggleCollapsed, openFolders };
}

/** `keys` with `key` added, or taken out when it was there. */
export function toggledKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(keys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * The scope of one list of files in one workspace (`useCollapsedFolders`). A list alone isn't enough: a diff's target
 * names a branch or a changeset, the same in two repositories, and Incoming's changesets are numbered per repository.
 */
export function folderListScope(workspacePath: string, list: string): string {
  return JSON.stringify([workspacePath, list]);
}

/** `keys` without `opening`; the very set when none of them is in it, so nothing renders again for it. */
export function withoutKeys(keys: ReadonlySet<string>, opening: readonly string[]): ReadonlySet<string> {
  if (!opening.some((key) => keys.has(key))) return keys;
  const next = new Set(keys);
  for (const key of opening) next.delete(key);
  return next;
}
