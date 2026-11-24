import { extensionOf, fileNameOf } from '../../lib/text';

/** A rule for each selected item, leaving out the items inside a selected folder: its rule already covers them. */
export function itemRulePatterns(paths: string[]): string[] {
  const selected = new Set(paths);
  return [...selected].filter((path) => !isUnderAny(path, selected)).map((path) => `/${path}`);
}

/** The extension every selected item has (`.asset`), or null when they don't all share one. */
export function sharedExtension(paths: string[]): string | null {
  if (paths.length === 0) return null;
  const shared = extensionOf(paths[0]!);
  if (shared === null) return null;
  for (let index = 1; index < paths.length; index++) if (extensionOf(paths[index]!) !== shared) return null;
  return shared;
}

/** The name every selected item has (`manifest.json`), or null when they don't all share one. */
export function sharedName(paths: string[]): string | null {
  if (paths.length === 0) return null;
  const shared = fileNameOf(paths[0]!);
  for (let index = 1; index < paths.length; index++) if (fileNameOf(paths[index]!) !== shared) return null;
  return shared;
}

/** The rules the user wrote, one per line: each once, without the blank lines or the spaces around them. */
export function rulesFromText(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== ''))];
}

/** Whether a folder above `path` is in `selected`: workspace paths use forward slashes on every OS (`PendingChange.path`). */
function isUnderAny(path: string, selected: ReadonlySet<string>): boolean {
  for (let slash = path.indexOf('/'); slash !== -1; slash = path.indexOf('/', slash + 1)) if (selected.has(path.slice(0, slash))) return true;
  return false;
}
