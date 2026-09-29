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
  return summary + separatorAfterTitle(original) + description;
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

const BLOCK_SYNTAX = [/^#{1,6}\s+\S/, /^\s*(```|~~~)/, /^\s*>\s?\S/];
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+\S/;
const INLINE_SYNTAX = [/\[[^\]]+\]\(https?:\/\/[^\s)]+\)/, /\*\*[^*\n]+\*\*/, /`[^`\n]+`/];

/**
 * Whether a text was clearly written as Markdown (headings, fences, quotes, links, bold, code, or a list of several
 * items), so rendering it reads better than showing its characters. Plain prose with a stray `*` stays plain.
 */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split('\n');
  if (lines.some((line) => BLOCK_SYNTAX.some((pattern) => pattern.test(line)))) return true;
  if (lines.filter((line) => LIST_ITEM.test(line)).length >= 2) return true;
  return INLINE_SYNTAX.some((pattern) => pattern.test(text));
}
