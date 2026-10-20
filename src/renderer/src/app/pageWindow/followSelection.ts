import type { Page } from '../navigation/pages';

/**
 * What a page shows, for telling two apart: the object and how, not the file it opened on (`focusPath`). A followed
 * selection is the same page again when it names the same object, whatever file the page window moved to since.
 */
export function pageKey(page: Page): string {
  const { focusPath: _focusPath, ...shown } = page as Page & { focusPath?: string };
  return JSON.stringify(sortedKeys(shown));
}

/** The value with every object's keys in one order, at any depth. */
function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, field]) => [key, sortedKeys(field)]),
  );
}

/**
 * The pages a page window following its workspace window's selection shows once a selection settles: that page
 * alone, its back trail gone; null when it shows that page already, so the file it is on stays.
 */
export function pagesForFollowed(shown: readonly Page[], followed: Page): Page[] | null {
  const top = shown.at(-1);
  return shown.length === 1 && top && pageKey(top) === pageKey(followed) ? null : [followed];
}
