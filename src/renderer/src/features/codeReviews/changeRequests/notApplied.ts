import { listNames } from '../../../lib/text';

/**
 * What a check-in or a comment edit says when its comment names change requests no review had pending
 * (`changeRequestsNotApplied`): `cm` made the changeset, or saved the comment, and applied none of the requests it
 * names, the others included. Null when nothing was left out.
 */
export function changeRequestsNotAppliedText(notApplied: readonly string[]): string | null {
  if (notApplied.length === 0) return null;
  const one = notApplied.length === 1;
  return `No change request was applied: ${listNames(notApplied)} ${one ? 'is' : 'are'} applied already, or no review has ${one ? 'it' : 'them'} open.`;
}
