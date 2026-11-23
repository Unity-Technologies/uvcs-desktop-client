import { ReviewThreadCard } from '../conversation/ReviewThreadCard';
import { imageEarlierTagOf } from './earlierTag';
import type { ImageThread } from './fileThreads';
import type { ReviewComments } from './reviewComments';
import { cardFocusOf } from './threadSelection';

interface ImageThreadCardProps {
  comments: ReviewComments;
  thread: ImageThread;
  /** Written on an earlier version of the image: tagged so. */
  earlier: boolean;
  /** Closes the card back to its pin. */
  onClose: () => void;
}

/**
 * A thread beside its pin on an image: the conversation's card as a line's thread shows it in the code, its × closing
 * it back to its pin. Clicked anywhere, or focused, it's selected (`selectThread`), as a thread in the code is.
 */
export function ImageThreadCard({ comments, thread, earlier, onClose }: ImageThreadCardProps) {
  const { highlight, selected } = cardFocusOf(comments.focus, thread.root.id);
  const select = (): void => comments.selectThread(thread);
  return (
    <div onClickCapture={select} onFocusCapture={select}>
      <ReviewThreadCard
        review={comments.review}
        thread={thread}
        user={comments.user}
        highlight={highlight}
        selected={selected}
        inCode={{
          earlier: earlier ? imageEarlierTagOf(thread) : undefined,
          showInConversation: () => comments.showInConversation(thread.root.id),
          hide: { label: 'Close', onHide: onClose },
        }}
      />
    </div>
  );
}
