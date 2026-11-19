import type { CodeReview, MergeRequestState } from '@shared/domain/codeReview';
import { changeableDestinationOf } from './changeableDestination';

/**
 * The review page's second line after its author: "Ana wants a review of /main/task", or for a merge request "Ana
 * wants to merge /main/task into /main"; "asked to merge" once merged (anyone may have merged it: the state's badge
 * says it is), "wanted to merge" once closed. Its destination changes in place (`DestinationPicker`) where
 * `changeableDestinationOf` lets it.
 */
export interface ReviewHeadline {
  verb: string;
  /** Where a merge request merges; `editable` with the source the picker offers the ancestors of. */
  destination?: { name: string; editable: true; source: string } | { name: string; editable: false };
}

export function reviewHeadline({ target, mergeRequest }: Pick<CodeReview, 'target' | 'mergeRequest'>): ReviewHeadline {
  if (!mergeRequest) return { verb: 'wants a review of' };
  const { state, destination: name } = mergeRequest;
  const changeable = changeableDestinationOf({ target, mergeRequest });
  const destination = changeable ? { name, editable: true as const, source: changeable.source } : { name, editable: false as const };
  return { verb: mergeVerbOf(state), destination };
}

const VERBS = { Draft: 'wants to merge', Open: 'wants to merge', Merged: 'asked to merge', Closed: 'wanted to merge' } as const;

/** What the owner did, by the request's state: "wants to merge", "asked to merge" once merged, "wanted to merge" once closed. */
export function mergeVerbOf(state: MergeRequestState): string {
  return VERBS[state];
}
