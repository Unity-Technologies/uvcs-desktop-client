import type { CodeReview, MergeRequestState } from '@shared/domain/codeReview';

/**
 * The review page's second line after its author: "Ana wants a review of /main/task", or for a merge request "Ana
 * wants to merge /main/task into /main"; "asked to merge" once merged (anyone may have merged it: the state's badge
 * says it is), "wanted to merge" once closed. Its destination changes in place (`DestinationPicker`) only while it is
 * still to merge, and only with its source branch named: the picker offers the source's ancestors.
 */
export interface ReviewHeadline {
  verb: string;
  /** Where a merge request merges; `editable` with the source the picker offers the ancestors of. */
  destination?: { name: string; editable: true; source: string } | { name: string; editable: false };
}

export function reviewHeadline({ target, mergeRequest }: Pick<CodeReview, 'target' | 'mergeRequest'>): ReviewHeadline {
  if (!mergeRequest) return { verb: 'wants a review of' };
  const { state, destination: name } = mergeRequest;
  const stillToMerge = state === 'Draft' || state === 'Open';
  const destination = stillToMerge && target.kind === 'branch' ? { name, editable: true as const, source: target.branch } : { name, editable: false as const };
  return { verb: mergeVerbOf(state), destination };
}

const VERBS = { Draft: 'wants to merge', Open: 'wants to merge', Merged: 'asked to merge', Closed: 'wanted to merge' } as const;

/** What the owner did, by the request's state: "wants to merge", "asked to merge" once merged, "wanted to merge" once closed. */
export function mergeVerbOf(state: MergeRequestState): string {
  return VERBS[state];
}
