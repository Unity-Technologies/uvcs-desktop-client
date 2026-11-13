import { changeRequestsNamedIn } from '@shared/applyChange';

/** A change request as `cm` lists it: the first eight hex digits of its guid, or the whole guid. */
const REQUEST = '[0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?';

/**
 * `cm`'s list after its message's colon (or a full-width one), `- deadbeef` an item. Nothing is required after an item:
 * some languages go on right after the list (`deadbeef에 이미 적용되었습니다`). One more item of another kind after it
 * (`- /src/a.cs`) makes it no list of requests.
 */
const LIST = new RegExp(`[:：]\\s*((?:-\\s*${REQUEST}\\s*)+)(?!\\s*-)`, 'gi');
const ITEM = new RegExp(`-\\s*(${REQUEST})`, 'gi');

/**
 * The change requests `cm checkin` or `cm changeset editcomment` found no pending one for, from its failure: null for
 * any other failure. `cm` makes the changeset, or saves the comment, then fails listing the requests the comment names
 * that no review has pending (applied already, discarded, or no request by that number), and applies none of them.
 * Read by structure, in any language `cm` speaks: a list, after a colon, of requests the comment names
 * (`changeRequestsNamedIn`), each `  - deadbeef` on a line of its own from a process of its own; a `cm shell` joins a
 * line starting with two spaces to the one before (`…changeset:- deadbeef`, a carriage return kept on Windows).
 */
export function changeRequestsNotApplied(output: string, comment: string): string[] | null {
  // `cm` finds a short number written in capitals too, then lists it as not found: compared in lower case here.
  const named = new Set(changeRequestsNamedIn(comment.toLowerCase()));
  if (named.size === 0) return null;
  for (const list of output.matchAll(LIST)) {
    const listed = [...list[1]!.matchAll(ITEM)].map((item) => item[1]!.toLowerCase());
    if (listed.every((request) => named.has(request))) return listed;
  }
  return null;
}
