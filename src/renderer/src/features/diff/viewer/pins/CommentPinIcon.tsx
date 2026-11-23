/**
 * A comment's pin as an icon: the speech bubble comments on images and models are drawn as (`PinBubble`), round with
 * its tip, the bottom-left corner, square, and a plus inside. The stage's comment button, the comment cursor
 * (`--cursor-add-comment`) and a comment being written share it, so marking, writing and posting read as one thing.
 */
export function CommentPinIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={COMMENT_PIN_PATH} />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

/** The bubble: a circle around (12, 12) whose bottom-left quarter is square, its tip at (2, 22). */
export const COMMENT_PIN_PATH = 'M2 22V12A10 10 0 1 1 12 22Z';
