import { ReviewThreadCard } from '../conversation/ReviewThreadCard';
import type { FileThread } from './fileThreads';
import type { ReviewComments } from './reviewComments';
import { cardFocusOf } from './threadSelection';

interface SpotThreadCardProps {
  comments: ReviewComments;
  thread: FileThread;
  /** Written on an earlier version of the file: its tag (`imageEarlierTagOf`, `modelEarlierTagOf`); none on a version shown. */
  earlier: { label: string; tip: string } | undefined;
  /** Closes the card back to its pin. */
  onClose: () => void;
}

/**
 * A thread beside its pin on an image or a model: the conversation's card as a line's thread shows it in the code, its
 * × closing it back to its pin. Clicked anywhere, or focused, it's selected (`selectThread`), as a thread in the code is.
 */
export function SpotThreadCard({ comments, thread, earlier, onClose }: SpotThreadCardProps) {
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
          earlier,
          showInConversation: () => comments.showInConversation(thread.root.id),
          hide: { label: 'Close', onHide: onClose },
        }}
      />
    </div>
  );
}
