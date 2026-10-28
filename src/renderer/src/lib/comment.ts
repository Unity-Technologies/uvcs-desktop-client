import { commentHeading } from './comments/commentHeading';

/** A comment read as a title (its first line) and a description (the rest), like a commit message. */
export interface CommentParts {
  summary: string;
  description: string;
}

/** Splits a stored comment into its summary line and description. */
export function splitComment(comment: string): CommentParts {
  const [summary = '', ...rest] = comment.replace(/\r\n?/g, '\n').replace(/^\s*\n/, '').split('\n');
  return { summary: summary.trim(), description: rest.join('\n').replace(/^\s*\n/, '').trimEnd() };
}

/**
 * The parts a comment opens in to be edited as a title and a description (the check-in's fields): its title and the
 * rest when it has one (`commentHeading`'s `titled`, a list's first item aside); whole in the description when it opens
 * with a list, a table or code, or is empty, so nothing moves into the title. `editedComment` writes them back.
 */
export function editingParts(comment: string): CommentParts {
  const titled = commentHeading(comment).kind === 'titled' && !OPENS_WITH_LIST.test(comment);
  return titled ? splitComment(comment) : { summary: '', description: comment };
}

/**
 * A recent comment picked in the check-in: its parts as Edit comment opens a comment (`editingParts`), and the field
 * the caret goes to, where its text ends: the description when it has one, else the summary.
 */
export function recentCommentPick(comment: string): { parts: CommentParts; caretIn: 'summary' | 'description' } {
  const parts = editingParts(comment);
  return { parts, caretIn: parts.description ? 'description' : 'summary' };
}

/** A comment opening with a list item: the item is no title, though a row shows it as the comment's line. */
const OPENS_WITH_LIST = /^\s*(?:[-*+]|\d+[.)])\s/;

/** The comment to store: the summary line, then a blank line and the description when there is one. */
export function joinComment({ summary, description }: CommentParts): string {
  return [summary.trim(), description.trim()].filter(Boolean).join('\n\n');
}

/**
 * The comment to store once a heading's editor closes: the original as it was when neither part changed (so a comment
 * `cm` keeps with one line end after its title, or a single long line, is never rewritten by opening its editor), else
 * the parts joined with the line ends the original had after its title (a blank line when it had no description).
 */
export function editedComment(original: string, opened: CommentParts, draft: CommentParts): string {
  if (draft.summary === opened.summary && draft.description === opened.description) return original;
  const summary = draft.summary.trim();
  const description = draft.description.replace(/^\s*\n/, '').trimEnd();
  if (!summary || !description) return summary || description;
  // A title given to a comment that had none is set off by a blank line, as the check-in writes one.
  return summary + (opened.summary ? separatorAfterTitle(original) : '\n\n') + description;
}

/** Whether closing the editor would throw away an edit: what it would save differs from the comment (`storedComment`). */
export function hasUnsavedEdit(original: string, opened: CommentParts, draft: CommentParts): boolean {
  return storedComment(editedComment(original, opened, draft)) !== storedComment(original);
}

/** One line end when the original's description starts on the line after its title, else a blank line. */
function separatorAfterTitle(original: string): string {
  const [, next] = original.replace(/\r\n?/g, '\n').replace(/^\s*\n/, '').split('\n');
  return next?.trim() ? '\n' : '\n\n';
}

/**
 * The draft once its single-line title field reads `text`: a title takes no line ends, so what follows the first one
 * (pasted text) opens the description, ahead of what the description held.
 */
export function withSummaryText(draft: CommentParts, text: string): CommentParts {
  const lineEnd = text.search(/\r?\n|\r/);
  if (lineEnd < 0) return { ...draft, summary: text };
  const rest = text.slice(lineEnd).replace(/^(\r?\n|\r)/, '').replace(/\r\n?/g, '\n');
  return { summary: text.slice(0, lineEnd), description: [rest, draft.description].filter((part) => part.trim()).join('\n') };
}

/** A comment a heading saved, and the one it replaced: what the object said when the save started. */
export interface SavedComment {
  saved: string;
  replaced: string;
}

/**
 * The comment a heading shows: the one it just saved while the object it was given still says what it replaced, so
 * the old comment never shows again between the save and the refresh that reads the new one; the object's own once
 * it says anything else (the refresh, or someone else's edit since).
 */
export function shownComment(comment: string, lastSaved: SavedComment | null): string {
  return lastSaved && comment === lastSaved.replaced ? lastSaved.saved : comment;
}

/**
 * A comment written whole (a dialog's) as it is stored: without the blank lines at its ends or the space a picked
 * suggestion leaves after it. Its first line's indent stays (`trimEnd`, not `trim`): a comment opening with an indented
 * code block would otherwise lose it.
 */
export function storedComment(text: string): string {
  return text.replace(/^(?:[^\S\n]*\n)+/, '').trimEnd();
}
