/**
 * How much text (both versions together) a diff highlights. Highlighting reads whole files at once, on the main thread,
 * at about 1.4 s a megabyte, and an editable diff highlights both versions twice: past this (about 2.5 s), a diff opens
 * as plain text instead of freezing the app.
 */
export const MAX_HIGHLIGHTED_CHARS = 400_000;

/** Whether a diff of these texts (or a file edited on its own, with its loaded version) is syntax highlighted. */
export function highlightsSyntax(original: string, modified: string): boolean {
  return original.length + modified.length <= MAX_HIGHLIGHTED_CHARS;
}
