/** The summary line of a multi-line comment. */
export function firstLine(text: string): string {
  return text.trimStart().split('\n')[0]?.trim() ?? '';
}

/**
 * The last name of a `/` path: `main.ts` for `src/app/main.ts`. For workspace-relative and server paths and branch
 * names, where a `\` is part of a name (macOS and Linux allow it); a local path takes `lastSegment`.
 */
export function fileNameOf(path: string): string {
  // Cut, not split: a menu reads the names of 50,000 selected paths.
  let end = path.length;
  while (end > 0 && path[end - 1] === '/') end--;
  if (end === 0) return path;
  return path.slice(path.lastIndexOf('/', end - 1) + 1, end);
}

/** The extension of a file name or workspace path, dot included (`.asset`); null when it has none or is a dotfile. */
export function extensionOf(path: string): string | null {
  const name = fileNameOf(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : null;
}

/** How many rows a list shows: "340", or "12 of 340" while its filters hide some of what it read. */
export function shownCount(shown: number, total: number = shown): string {
  return shown === total ? formatCount(total) : `${formatCount(shown)} of ${formatCount(total)}`;
}

/** A count as the app shows it: 20,412. */
export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

/** A count and the noun it counts: "1 file", "1,204 files". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

/** A count that may have stopped short (`more`: there are more than `count`, e.g. a capped `cm find`): "100+". */
export function formatCountAtLeast(count: number, more: boolean): string {
  return more ? `${formatCount(count)}+` : formatCount(count);
}

/** `pluralize` for a count that may have stopped short: "100+ new changesets", plural however few it counted. */
export function pluralizeAtLeast(count: number, more: boolean, singular: string, plural = `${singular}s`): string {
  return more ? `${formatCountAtLeast(count, true)} ${plural}` : pluralize(count, singular, plural);
}
