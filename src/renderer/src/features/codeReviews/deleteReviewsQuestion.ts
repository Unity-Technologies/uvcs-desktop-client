/** Titles longer than this are cut at a word, so the confirmation stays a couple of lines. */
const MAX_QUOTED_TITLE = 80;

/** A short heading, and the review's title quoted in the message (cut with an ellipsis when long). */
export function deleteReviewsQuestion(titles: readonly string[]): { title: string; message: string } {
  const kept = 'The reviewed changes are kept. This cannot be undone.';
  if (titles.length !== 1) return { title: `Delete ${titles.length} code reviews?`, message: kept };
  return { title: 'Delete code review?', message: `“${quotedTitle(titles[0]!)}” will be deleted. ${kept}` };
}

function quotedTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_QUOTED_TITLE) return trimmed;
  const cut = trimmed.slice(0, MAX_QUOTED_TITLE);
  // One character more, so a word ending right at the limit is kept whole.
  const lastSpace = trimmed.slice(0, MAX_QUOTED_TITLE + 1).lastIndexOf(' ');
  return `${(lastSpace > MAX_QUOTED_TITLE / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
