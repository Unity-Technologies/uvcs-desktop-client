import type { CodeReview } from '@shared/domain/codeReview';
import type { ReviewDescription } from '@shared/domain/reviewConversation';

/** How the description reads: who wrote it and when (the review's author, as it was created, while it has none). */
export interface DescriptionHeader {
  author: string;
  date: string;
  editedDate?: string;
  /** The pencil's label: to edit the description, or to write the first one. */
  editLabel: 'Edit description' | 'Add a description';
  /** What it says; none for a review with no description, or one emptied. */
  text?: string;
}

export function descriptionHeader(review: Pick<CodeReview, 'owner' | 'date'>, description: ReviewDescription | undefined): DescriptionHeader {
  const text = description?.text.trim() ? description.text : undefined;
  return {
    author: description?.author ?? review.owner,
    date: description?.date ?? review.date,
    ...(description?.editedDate && { editedDate: description.editedDate }),
    editLabel: description ? 'Edit description' : 'Add a description',
    ...(text !== undefined && { text }),
  };
}
