/** The summary line of a multi-line comment. */
export function firstLine(text: string): string {
  return text.trimStart().split('\n')[0]?.trim() ?? '';
}

/**
 * The last name of a `/` path: `main.ts` for `src/app/main.ts`. For workspace-relative and server paths and branch
 * names, where a `\` is part of a name (macOS and Linux allow it); a local path takes `lastSegment`.
 */
export function fileNameOf(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
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
