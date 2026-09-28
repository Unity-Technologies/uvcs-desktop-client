/** The summary line of a multi-line comment. */
export function firstLine(text: string): string {
  return text.trimStart().split('\n')[0]?.trim() ?? '';
}

export function fileNameOf(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

/** A count as the app shows it: 20,412. */
/** How many rows a list shows: "340", or "12 of 340" while its filters hide some of what it read. */
export function shownCount(shown: number, total: number = shown): string {
  return shown === total ? formatCount(total) : `${formatCount(shown)} of ${formatCount(total)}`;
}

export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
