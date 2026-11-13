import { changeRequestsNamedIn } from '@shared/applyChange';

/** A listed item of `cm`'s error, `  - deadbeef`: what it couldn't find, one per line. */
const LISTED = /^\s*- (\S+)\s*$/gm;

/**
 * The change requests `cm checkin` or `cm changeset editcomment` found no pending one for, from its failure: null for
 * any other failure. `cm` makes the changeset, or saves the comment, then fails listing the requests the comment names
 * that no review has pending (applied already, discarded, or no request by that number), and applies none of them. Read
 * by structure, in any language: an error listing only requests the comment names (`changeRequestsNamedIn`).
 */
export function changeRequestsNotApplied(output: string, comment: string): string[] | null {
  // `cm` finds a short number written in capitals too, then lists it as not found: compared in lower case here.
  const named = new Set(changeRequestsNamedIn(comment.toLowerCase()));
  if (named.size === 0) return null;
  const listed = [...output.matchAll(LISTED)].map((match) => match[1]!);
  if (listed.length === 0) return null;
  const requests = listed.map((item) => (named.has(item.toLowerCase()) ? item.toLowerCase() : null));
  return requests.every((request) => request !== null) ? (requests as string[]) : null;
}
