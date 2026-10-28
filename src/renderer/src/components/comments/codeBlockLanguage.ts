/**
 * The most of a comment's code block highlighted, in characters: the highlighter runs on the page's thread, where the
 * diffs stop at the same size (`MAX_READ_ONLY_HIGHLIGHTED_CHARS`, docs/features/diff.md: 1.5 to 4.5 ms a KB). A bigger
 * block (a pasted log) shows plain.
 */
export const MAX_HIGHLIGHTED_COMMENT_CHARS = 20_000;

/**
 * The language a fence names, as the highlighter looks it up: lower case, its own names and aliases (`csharp`, `cs`,
 * `c#`), without what follows it (`ts title="a.ts"`). Null for none.
 */
export function fenceLanguage(info: string | undefined): string | null {
  const name = info?.trim().split(/\s+/)[0]?.toLowerCase();
  return name ? name : null;
}

/** The language a comment's code block is highlighted in: its fence's, for a block small enough; null shows it plain. */
export function highlightedLanguage(text: string, info: string | undefined): string | null {
  return text.length <= MAX_HIGHLIGHTED_COMMENT_CHARS ? fenceLanguage(info) : null;
}
