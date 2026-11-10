import type { DiffLineAnnotation } from '@pierre/diffs';
import { useMemo } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import type { DiffAnnotations } from '../../diff/viewer/diffAnnotations';
import { ReviewThreadCard } from '../conversation/ReviewThreadCard';
import type { ContextComparison } from './commentContext';
import type { LineThread } from './fileThreads';
// The thread's row sets the app's own text back inside Pierre's shadow root, as a row of the review's diff does.
import rowStyles from './InlineThreads.module.css';

const THREAD_ROW = 'thread';

interface ThreadRowOptions {
  review: CodeReview;
  thread: LineThread;
  user: string | undefined;
  /** None until the view's versions are known: the diff then has no row. */
  comparison: ContextComparison | null;
  showInConversation: () => void;
  onClose: () => void;
}

/** The rows "See in context" gives a diff (`DiffAnnotationsContext`): the thread under its line, the diff scrolled to it. */
export function useThreadRow({ review, thread, user, comparison, showInConversation, onClose }: ThreadRowOptions): DiffAnnotations | null {
  const side = comparison?.side;
  const line = comparison?.line;
  // Its own object only when the line changes: a reply made here refreshes the thread, and scrolls nothing.
  const scrollTo = useMemo(() => (side && line !== undefined ? { side, lineNumber: line } : null), [side, line]);
  return useMemo<DiffAnnotations | null>(
    () =>
      side && line !== undefined
        ? {
            rows: [{ side, lineNumber: line, metadata: THREAD_ROW }],
            render: (_row: DiffLineAnnotation<string>) => (
              <div className={rowStyles.row}>
                <ReviewThreadCard
                  review={review}
                  thread={thread}
                  user={user}
                  // What the dialog is about: shown whole, ringed, even when settled (a settled thread starts folded).
                  highlight={0}
                  selected
                  inCode={{
                    inContext: true,
                    showInConversation: () => {
                      onClose();
                      showInConversation();
                    },
                  }}
                />
              </div>
            ),
            markers: [],
            scrollTo,
            opensAtRow: true,
          }
        : null,
    [review, thread, user, side, line, scrollTo, showInConversation, onClose],
  );
}
