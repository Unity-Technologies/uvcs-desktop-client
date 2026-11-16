import type { CodeReviewSummary } from '@shared/domain/codeReview';

/** Titles longer than this are cut at a word, so the confirmation stays a couple of lines. */
const MAX_QUOTED_TITLE = 80;

/**
 * A short heading, and the review's title quoted in the message (cut with an ellipsis when long). Merge requests are
 * named so; a mix of both, reviews.
 */
export function deleteReviewsQuestion(reviews: readonly Pick<CodeReviewSummary, 'title' | 'mergeRequest'>[]): { title: string; message: string } {
  const kept = 'The reviewed changes are kept. This cannot be undone.';
  const requests = reviews.filter((review) => review.mergeRequest).length;
  const noun = requests === reviews.length ? 'merge request' : requests === 0 ? 'code review' : 'review';
  if (reviews.length !== 1) return { title: `Delete ${reviews.length} ${noun}s?`, message: kept };
  return { title: `Delete ${noun}?`, message: `“${quotedTitle(reviews[0]!.title)}” will be deleted. ${kept}` };
}

function quotedTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_QUOTED_TITLE) return trimmed;
  const cut = trimmed.slice(0, MAX_QUOTED_TITLE);
  // One character more, so a word ending right at the limit is kept whole.
  const lastSpace = trimmed.slice(0, MAX_QUOTED_TITLE + 1).lastIndexOf(' ');
  return `${(lastSpace > MAX_QUOTED_TITLE / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
