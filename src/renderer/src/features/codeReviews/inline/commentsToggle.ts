/**
 * What the header's comments button reaches: in a review's diff, every file's comments, code, images and models alike
 * (`useReviewCommentsStore.inCode`, one setting for every review); in the comment dialog, the one thread in its code.
 */
export type CommentsToggleReach = 'everyFile' | 'thisThread';

/**
 * What the header's button says it does: hide or show the comments, and how far that goes. A review's says "in every
 * file": "on the model" read as this file only, and the comments of every other file went with it.
 */
export function commentsToggleLabel(shown: boolean, reach: CommentsToggleReach): string {
  const verb = shown ? 'Hide comments' : 'Show comments';
  return reach === 'everyFile' ? `${verb} in every file` : `${verb} in the code`;
}
