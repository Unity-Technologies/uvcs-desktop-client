/**
 * What the header's comments button says it does: hide or show the comments, in the same words for code, images and
 * models. Where the setting reaches (every file of every review, `useReviewCommentsStore.inCode`; the comment dialog's
 * one thread) is left out: "in every file" and "on the model" both read as more than a show-or-hide switch.
 */
export function commentsToggleLabel(shown: boolean): string {
  return shown ? 'Hide comments' : 'Show comments';
}
