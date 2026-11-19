import { commentLineText } from '../../lib/comments/commentText';

/**
 * The branch pill's second line: none while a switch shows its progress or when the comment couldn't be read, a
 * placeholder while it loads (the pill keeps its two lines, so it doesn't grow when it arrives), "No comment", or the
 * comment's first line.
 */
export type WorkingObjectCommentLine = { kind: 'none' } | { kind: 'loading' } | { kind: 'noComment' } | { kind: 'text'; text: string };

export function workingObjectCommentLine(comment: string | undefined, failed: boolean, switching: boolean): WorkingObjectCommentLine {
  if (switching || failed) return { kind: 'none' };
  if (comment === undefined) return { kind: 'loading' };
  const text = commentLineText(comment);
  return text ? { kind: 'text', text } : { kind: 'noComment' };
}
