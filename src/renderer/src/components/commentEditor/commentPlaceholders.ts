/**
 * What a comment of many lines takes, said in its placeholder: Markdown, and the triggers that link objects and
 * people. One-line fields (a summary, a title) say nothing more than their name: their suggestions show as typed.
 */
export const COMMENT_POWERS = 'Markdown, cs:, br:, @ to link';

/** A comment field's placeholder: what it's for, then what it takes. */
export function commentPlaceholder(purpose: string): string {
  return `${purpose} · ${COMMENT_POWERS}`;
}

export const DESCRIPTION_PLACEHOLDER = commentPlaceholder('Description (optional)');
