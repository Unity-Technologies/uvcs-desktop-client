/** Marks a comment field's box (the editor and the plain field before it loads), where its own keys win. */
export const COMMENT_FIELD_ATTRIBUTE = 'data-comment-field';

/** Whether a key pressed on `target` is pressed in a comment field (`yieldsToCommentField`). */
export function inCommentField(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${COMMENT_FIELD_ATTRIBUTE}]`) !== null;
}
