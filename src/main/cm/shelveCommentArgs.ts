import type { CmPlace } from './cmPlace';

/**
 * `cm` has no shelve command that edits a comment (`cm shelveset` only creates, deletes and applies), but a shelve is
 * a changeset numbered below zero, and `cm changeset editcomment` edits it in place as `cs:-<shelve number>`: the
 * shelve keeps its number, GUID and changes. It refuses `sh:<number>` ("Incorrect object specification"). The comment
 * goes in a file, which may be empty to clear it: a `cm shell` line can't carry quotes or line breaks.
 */
export function shelveCommentArgs(shelveId: number, commentsFile: string, at: CmPlace): string[] {
  return ['changeset', 'editcomment', at.spec(`cs:-${shelveId}`), `-commentsfile=${commentsFile}`];
}
