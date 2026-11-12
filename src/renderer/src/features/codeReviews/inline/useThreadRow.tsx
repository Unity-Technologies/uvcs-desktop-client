import type { DiffLineAnnotation } from '@pierre/diffs';
import { useMemo, useState, type ReactNode } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import type { DiffAnnotations, LineMarker } from '../../diff/viewer/diffAnnotations';
import { ReviewThreadCard } from '../conversation/ReviewThreadCard';
import { CommentMarkerContent } from './CommentMarkerContent';
import { CommentsInCodeButton } from './CommentsInCodeButton';
import type { ContextComparison } from './commentContext';
import { contextThreadParts, THREAD_ROW } from './contextThreadRow';
import type { LineThread } from './fileThreads';
import { markerTip } from './markerTip';
import { markerIsOpen, markerLabel } from './threadRows';
import { showInConversation } from './reviewComments';
// The thread's row sets the app's own text back inside Pierre's shadow root, as a row of the review's diff does.
import rowStyles from './InlineThreads.module.css';

interface ThreadRowOptions {
  review: CodeReview;
  thread: LineThread;
  user: string | undefined;
  /** None until the view's versions are known: the diff then has no row. */
  comparison: ContextComparison | null;
  onClose: () => void;
}

interface ThreadRow {
  /** The rows "See in context" gives its diff (`DiffAnnotationsContext`); none until the view's versions are known. */
  annotations: DiffAnnotations | null;
  /** The file header's comments button, to read the code without the thread and bring it back. */
  controls: ReactNode;
}

/**
 * The thread under its line in See in context's diff, scrolled to it; hidden by the header's comments button, a marker
 * on its line (`contextThreadParts`). It shows each time the dialog opens: the thread is what the dialog is about, so the
 * review's own setting (`useReviewCommentsStore.inCode`) doesn't hide it here, nor does hiding it here change that.
 */
export function useThreadRow({ review, thread, user, comparison, onClose }: ThreadRowOptions): ThreadRow {
  const [shown, setShown] = useState(true);
  const side = comparison?.side;
  const line = comparison?.line;
  // Its own object only when the line changes: a reply made here refreshes the thread, and scrolls nothing.
  const scrollTo = useMemo(() => (side && line !== undefined ? { side, lineNumber: line } : null), [side, line]);
  const annotations = useMemo<DiffAnnotations | null>(() => {
    if (!side || line === undefined) return null;
    const parts = contextThreadParts(side, line, shown);
    const placed = { threads: [{ thread, side, line }], line };
    const markers: LineMarker[] = parts.marked
      ? [{ key: THREAD_ROW, side, lineNumber: line, label: markerLabel(placed), tip: markerTip(placed), content: <CommentMarkerContent line={placed} />, emphasized: markerIsOpen(placed), onOpen: () => setShown(true) }]
      : [];
    return {
      rows: parts.rows,
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
                showInConversation(review.id, thread.root.id);
              },
            }}
          />
        </div>
      ),
      markers,
      bands: parts.bands,
      scrollTo,
      opensAtRow: true,
    };
  }, [review, thread, user, side, line, shown, scrollTo, onClose]);
  return { annotations, controls: <CommentsInCodeButton shown={shown} onChange={setShown} /> };
}
