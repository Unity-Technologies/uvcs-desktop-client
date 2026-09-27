import { isIgnored, type IgnoreRules } from './ignoreRules';

/**
 * What a file system event in a workspace means:
 * - `content`: a file or directory of the workspace changed; only the pending changes can differ.
 * - `metadata`: `cm` rewrote the workspace state in `.plastic` (checkin, update, switch, undo, add, checkout,
 *   changelists), whoever ran it: this app, a terminal, the official GUI or the Unity plugin.
 * - null: noise, e.g. the lock files every `cm` read takes, temp files, or ignored folders.
 */
export type ChangeKind = 'content' | 'metadata' | null;

/** Written by `cm` whenever the loaded tree, the selector or the list of changed items changes. */
const WORKSPACE_STATE_FILES = new Set(['plastic.selector', 'plastic.wktree', 'plastic.changes']);

/** `relativePath` as reported by `fs.watch`; either separator. Undefined when the platform can't tell. */
export function classifyChange(relativePath: string | undefined, ignoreRules: IgnoreRules): ChangeKind {
  if (!relativePath) return 'content';
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
