import { changeRequestsNamedIn } from '@shared/applyChange';

/** The last item of `cm`'s list, `- deadbeef` (or a whole guid), at the end of what's left of its output. */
const LAST_LISTED = /- ([0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)$/i;

/**
 * The change requests `cm checkin` or `cm changeset editcomment` found no pending one for, from its failure: null for
 * any other failure. `cm` makes the changeset, or saves the comment, then fails listing the requests the comment names
 * that no review has pending (applied already, discarded, or no request by that number), and applies none of them. Read
 * by structure, in any language: the output ends with a sentence's colon and a list (`  - deadbeef`, one a line; the
 * window may get them with the line ends dropped, `…changeset:- deadbeef`) of requests the comment names
 * (`changeRequestsNamedIn`).
 */
export function changeRequestsNotApplied(output: string, comment: string): string[] | null {
  // `cm` finds a short number written in capitals too, then lists it as not found: compared in lower case here.
  const named = new Set(changeRequestsNamedIn(comment.toLowerCase()));
  if (named.size === 0) return null;
  const listed: string[] = [];
  let rest = output.trimEnd();
  for (let last = LAST_LISTED.exec(rest); last; last = LAST_LISTED.exec(rest)) {
    listed.unshift(last[1]!.toLowerCase());
    rest = rest.slice(0, last.index).trimEnd();
  }
  if (listed.length === 0 || !rest.endsWith(':')) return null;
  return listed.every((request) => named.has(request)) ? listed : null;
}
