import type { CommentReference } from '../../lib/comments/commentReferences';

/** The most issues one comment shown in full reads as it shows: one request's worth; the rest read as their cards open. */
export const MAX_ISSUES_PER_COMMENT = 100;

/** The issues a comment names, each once, in order, up to `MAX_ISSUES_PER_COMMENT`. */
export function issueKeysOf(references: readonly CommentReference[]): string[] {
  const keys = new Set<string>();
  for (const reference of references) {
    if (reference.kind === 'issue') keys.add(reference.key);
    if (keys.size === MAX_ISSUES_PER_COMMENT) break;
  }
  return [...keys];
}
