import type { CodeReviewSummary } from '@shared/domain/codeReview';

/** A merge request's destination that can change, with the branch it merges: the picker offers that branch's ancestors. */
export interface ChangeableDestination {
  destination: string;
  source: string;
}

/**
 * Where a merge request merges, when that can still change: while it's Draft or Open, and only with its source branch
 * named, since the picker (`DestinationPicker`, `destinationGroups`) offers the source's ancestors. None for a plain
 * code review, a merged or closed request, or one listed without its branch's name. The page's headline, the row's
 * menu and the details panel all decide by it; the server checks the user may change it.
 */
export function changeableDestinationOf({ target, mergeRequest }: Pick<CodeReviewSummary, 'target' | 'mergeRequest'>): ChangeableDestination | undefined {
  if (!mergeRequest || target?.kind !== 'branch') return undefined;
  const stillToMerge = mergeRequest.state === 'Draft' || mergeRequest.state === 'Open';
  return stillToMerge ? { destination: mergeRequest.destination, source: target.branch } : undefined;
}
