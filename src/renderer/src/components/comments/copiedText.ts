/** What a copy from a shown comment holds, read off the page by `copyAsSource`. */
export interface CopiedSelection {
  /** The selection as it reads. */
  selected: string;
  /** The whole comment as it reads. */
  shown: string;
  /** The comment as written, when the copy comes from one shown whole. */
  source?: string;
  /** The selection as it reads with its chips, people, emoji and images as written; null when it holds none. */
  withSources: string | null;
}

/**
 * The text a copy from a shown comment gives (docs/features/rich-comments.md, "Copying"). The whole comment selected
 * gives it back exactly as written: its marks, list markers and code fences, which no reading of the page can rebuild.
 * A part gives what it reads, its references as written. Null leaves the copy to the browser.
 */
export function copiedText({ selected, shown, source, withSources }: CopiedSelection): string | null {
  if (source !== undefined && holdsAllOf(selected, shown)) return source;
  return withSources;
}

/** A selection read off the page differs from the page's text in its spaces and line breaks only. */
function holdsAllOf(selected: string, shown: string): boolean {
  const words = (text: string) => text.replace(/\s+/g, ' ').trim();
  const whole = words(shown);
  return whole.length > 0 && words(selected) === whole;
}
