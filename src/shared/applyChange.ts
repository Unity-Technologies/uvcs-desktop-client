/**
 * How a changeset's comment names a code review's change request to apply, as `cm checkin` and `cm changeset
 * editcomment` read it (docs/features/code-reviews.md "Applying change requests"): `[apply-change:c0d1ce00]`, anywhere
 * in the text as written. Its words in any case; the request by the first eight hex digits of its guid, matched as
 * written against the guid's lower-case digits (so only lower case applies), or by the whole guid, in any case.
 */
const APPLY_CHANGE_SOURCE =
  '\\[[aA][pP][pP][lL][yY]-[cC][hH][aA][nN][gG][eE]:([0-9a-f]{8}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\\]';

/** Every change request a comment names to apply, in order: `[1]` the guid, or its first eight digits, as written. */
export function applyChangeMatches(text: string): RegExpMatchArray[] {
  return [...text.matchAll(new RegExp(APPLY_CHANGE_SOURCE, 'g'))];
}

/** Whether a comment names a change request to apply: `cm` marks it applied in the changeset. */
export function appliesChangeRequests(comment: string): boolean {
  return new RegExp(APPLY_CHANGE_SOURCE).test(comment);
}

/** Whether a text is one change request to apply and nothing else. */
export function isApplyChange(text: string): boolean {
  return new RegExp(`^${APPLY_CHANGE_SOURCE}$`).test(text);
}

/** The change requests a comment names, as `cm` compares them: a whole guid in lower case, a short one as written. */
export function changeRequestsNamedIn(comment: string): string[] {
  return applyChangeMatches(comment).map((match) => match[1]!.toLowerCase());
}
