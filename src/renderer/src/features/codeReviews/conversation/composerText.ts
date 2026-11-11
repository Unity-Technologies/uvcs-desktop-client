import type { CommentParts } from '../../../lib/comment';

/** What a composer shows: its draft, else the text it opened with (the comment being edited). */
export function composerText(draft: CommentParts | undefined, initialText: string): string {
  return draft?.description ?? initialText;
}

/**
 * Whether there's something to send: a change to what it opened with, and words unless it may be emptied. What goes
 * with something else (a status's comment) is `optional`: sent as it is, words or none.
 */
export function isSendable(text: string, initialText: string, allowEmpty: boolean, optional = false): boolean {
  if (optional) return true;
  if (text === initialText) return false;
  return allowEmpty || text.trim() !== '';
}

/** Whether Cancel asks first: a comment that took words to write, where closing it would lose them (`asksBeforeDiscarding`). */
export function cancelAsks(text: string, asksBeforeDiscarding: boolean): boolean {
  return asksBeforeDiscarding && text.trim() !== '';
}
