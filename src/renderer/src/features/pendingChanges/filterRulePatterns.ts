import { extensionOf } from '../../lib/text';

/** A rule for each selected item, leaving out the items inside a selected folder: its rule already covers them. */
export function itemRulePatterns(paths: string[]): string[] {
  const selected = new Set(paths);
  const isInsideSelected = (path: string) => ancestorsOf(path).some((ancestor) => selected.has(ancestor));
  return [...selected].filter((path) => !isInsideSelected(path)).map((path) => `/${path}`);
}

/** The extension every selected item has (`.asset`), or null when they don't all share one. */
export function sharedExtension(paths: string[]): string | null {
  const extensions = new Set(paths.map(extensionOf));
  const [only] = extensions;
  return extensions.size === 1 && only !== undefined ? only : null;
}

/** `a/b/c` → `a`, `a/b`: workspace paths use forward slashes on every OS (`PendingChange.path`). */
function ancestorsOf(path: string): string[] {
  const parts = path.split('/');
  return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join('/'));
}
