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

/**
 * A comment without the change requests it names to apply: what a recent comment brings to a new check-in, as the
 * requests it applied are no longer pending and `cm` would fail it on them. Any case, as `cm` finds them. Words on both
 * sides of one keep a space between them, none is left at a line's start or end, and a line left empty goes with its
 * line end, so the paragraph around it stays one. Line ends stay as they were (CRLF too).
 */
export function withoutApplyChanges(comment: string): string {
  const references = new RegExp(`[ \\t]*(?:${APPLY_CHANGE_SOURCE}[ \\t]*)+`, 'gi');
  const parts = comment.split(/(\r?\n)/);
  const kept: string[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index]!;
    const end = parts[index + 1];
    const cleaned = line.replace(references, (run: string, ...rest: unknown[]) => {
      const offset = rest[rest.length - 2] as number;
      return offset === 0 || offset + run.length === line.length ? '' : ' ';
    });
    if (cleaned === '' && line !== '') {
      // The line goes, and one line end with it: its own, or the one before it on the last line.
      if (end === undefined && kept.length > 0) kept.pop();
      continue;
    }
    kept.push(cleaned);
    if (end !== undefined) kept.push(end);
  }
  return kept.join('');
}
