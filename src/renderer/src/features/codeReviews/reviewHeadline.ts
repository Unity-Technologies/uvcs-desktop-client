import type { CodeReviewSummary } from '@shared/domain/codeReview';

/**
 * The review page's second line after its author: "Ana wants a review of /main/task", or for a merge request "Ana
 * wants to merge /main/task into /main", in the past once merged or closed. Its destination changes in place
 * (`DestinationPicker`) only while it is still to merge.
 */
export interface ReviewHeadline {
  verb: string;
  destination?: { name: string; editable: boolean };
}

export function reviewHeadline({ mergeRequest }: Pick<CodeReviewSummary, 'mergeRequest'>): ReviewHeadline {
  if (!mergeRequest) return { verb: 'wants a review of' };
  const { state, destination: name } = mergeRequest;
  switch (state) {
    case 'Draft':
    case 'Open':
      return { verb: 'wants to merge', destination: { name, editable: true } };
    case 'Merged':
      return { verb: 'merged', destination: { name, editable: false } };
    case 'Closed':
      return { verb: 'wanted to merge', destination: { name, editable: false } };
  }
}
