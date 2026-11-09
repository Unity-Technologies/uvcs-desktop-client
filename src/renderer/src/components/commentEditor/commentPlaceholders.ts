export const DESCRIPTION_PLACEHOLDER = 'Description (optional)';

/**
 * An empty comment's placeholder in focus mode, which has the room to say what a comment is written in; its hints name the
 * triggers (`focusModeHints`). A small field says only what it's for.
 */
export const FOCUS_MODE_PLACEHOLDER = 'Write in Markdown';

/** The placeholder a field shows: its own, or in focus mode, for a comment of many lines, what a comment takes. */
export function placeholderShown(placeholder: string, field: { focusMode: boolean; singleLine: boolean }): string {
  return field.focusMode && !field.singleLine ? FOCUS_MODE_PLACEHOLDER : placeholder;
}
