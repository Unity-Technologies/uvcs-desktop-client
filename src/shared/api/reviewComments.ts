import type { Place } from '../domain/place';
import type { NewLineComment, ReviewConversation } from '../domain/reviewConversation';

/** What is said on a code review: its description, its comments and their replies (docs/features/code-reviews.md). */
export interface ReviewCommentsApi {
  conversation(place: Place, reviewId: number): Promise<ReviewConversation>;
  /** A comment on the whole review. */
  add(place: Place, reviewId: number, text: string): Promise<void>;
  /** A comment on a line of a file, from the review's diff. */
  addOnLine(place: Place, reviewId: number, comment: NewLineComment, text: string): Promise<void>;
  /** `discard`: the reply discards the change request it answers, saying why. */
  reply(place: Place, commentGuid: string, text: string, options?: { discard?: boolean }): Promise<void>;
  edit(place: Place, commentGuid: string, text: string): Promise<void>;
  remove(place: Place, commentGuid: string): Promise<void>;
  /** Writes the review's description, or clears it with an empty text. */
  setDescription(place: Place, reviewId: number, text: string): Promise<void>;
}
