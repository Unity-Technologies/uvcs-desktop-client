import type { PageOf } from '../../app/navigation/pages';
import type { CommentReference } from '../../lib/comments/commentReferences';

/**
 * Where a chip in a review's comments opens, when the review has a place for it: a changeset of its branch ("Fixed in
 * cs:281301") in the review's Changes, that changeset selected in its list, where the reviewer stays, not on the
 * changeset's own page. None for anything else, which opens as every chip does. `branchChangesets`: the ids of the
 * branch's changesets; none for a review of a changeset or a shelve.
 */
export function reviewChipPage(reviewId: number, reference: CommentReference, branchChangesets: ReadonlySet<number> | undefined): PageOf<'codeReview'> | undefined {
  if (reference.kind !== 'changeset' || reference.repository !== undefined || !branchChangesets?.has(reference.id)) return undefined;
  return { kind: 'codeReview', reviewId, tab: 'changes', focusChangeset: reference.id };
}
