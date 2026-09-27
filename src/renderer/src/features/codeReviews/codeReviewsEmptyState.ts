export interface CodeReviewsEmptyState {
  title: string;
  description?: string;
  /** What the action button offers: a new review, or the filters back to their defaults. */
  action: 'newReview' | 'clearFilters';
}

/** Why the Code reviews view has no rows: the text typed, the filters picked, or no reviews in the time range. */
export function codeReviewsEmptyState({ searching, filtered }: { searching: boolean; filtered: boolean }): CodeReviewsEmptyState {
  if (searching) return { title: 'No matching code reviews', description: 'No title or number contains this text.', action: 'clearFilters' };
  if (filtered) return { title: 'No code reviews match these filters', action: 'clearFilters' };
  return { title: 'No code reviews', description: 'Ask a teammate to look at a branch or changeset before it gets merged.', action: 'newReview' };
}
