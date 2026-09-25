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
