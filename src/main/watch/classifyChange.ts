import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import { isIgnored, type IgnoreRules } from './ignoreRules';

/**
 * What a file system event in a workspace means:
 * - `content`: a file or directory of the workspace changed; only the pending changes can differ.
 * - `metadata`: `cm` rewrote the workspace state in `.plastic` (checkin, update, switch, undo, add, checkout,
 *   changelists), whoever ran it: this app, a terminal, the official GUI or the Unity plugin.
 * - `anything`: the platform didn't say which item. Windows drops the names when a burst of changes (an update, a
 *   build) overflows what it keeps for the watcher, so `.plastic` may have changed too.
 * - null: noise, e.g. the lock files every `cm` read takes, temp files, or ignored folders.
 */
export type ChangeKind = 'content' | 'metadata' | 'anything' | null;

/** Written by `cm` whenever the loaded tree, the selector or the list of changed items changes. */
const WORKSPACE_STATE_FILES = new Set(['plastic.selector', 'plastic.wktree', 'plastic.changes']);

/** `relativePath` as reported by `fs.watch`; either separator. Undefined when the platform can't tell. */
export function classifyChange(relativePath: string | undefined, ignoreRules: IgnoreRules): ChangeKind {
  if (!relativePath) return 'anything';
  const path = relativePath.replaceAll('\\', '/');
  if (path === '.plastic') return null;
  if (path.startsWith('.plastic/')) {
    const inPlastic = path.slice('.plastic/'.length);
    return WORKSPACE_STATE_FILES.has(inPlastic) || isChangelistFile(path) ? 'metadata' : null;
  }
  return isIgnored(path, ignoreRules) ? null : 'content';
}

/** One of the files `cm` keeps the persistent changelists in. */
export function isChangelistFile(relativePath: string | undefined): boolean {
  return relativePath !== undefined && relativePath.replaceAll('\\', '/').startsWith('.plastic/changelists/');
}

/**
 * What an event of `kind` tells the windows. `event` is `fs.watch`'s: `rename` for additions, deletions and moves,
 * `change` for edits. `folder` holds the item (`changedFolder`); a `.plastic` rewrite changes no folder's listing.
 */
export function workspaceChangeOf(kind: Exclude<ChangeKind, null>, event: string, folder: string | null): WorkspaceChange {
  if (kind === 'anything') return { content: true, pathsChanged: true, metadata: true, folders: null };
  if (kind === 'metadata') return { content: false, pathsChanged: false, metadata: true, folders: [] };
  return { content: true, pathsChanged: event === 'rename', metadata: false, folders: folder === null ? null : [folder] };
}
