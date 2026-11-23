import { useMemo, useState } from 'react';
import type { ModelSpot } from '@shared/domain/reviewConversation';
import type { ModelAnnotations } from '../../diff/viewer/model/modelAnnotations';
import type { ReviewThread } from '../conversation/reviewThreads';
import { topSideOf } from './fileComments';
import { modelThreadsOfFile, type ReviewDiffView, type ShownFile } from './fileThreads';
import { modelEarlierTagOf } from './earlierTag';
import { SpotThreadCard } from './SpotThreadCard';
import { newSpotComment, newSpotCommentsIn, spotCommentAt, spotCommentSide, type NewModelCommentSpot } from './newSpotComment';
import { useNewModelCommentsStore } from './newModelCommentsStore';
import { NewModelCommentCard } from './NewModelCommentCard';
import type { ReviewComments } from './reviewComments';
import { modelSideOf, reviewModelPinsOf } from './reviewModelPins';
import { newCommentPinKey, openedPin, pinRevealedBy, pinThreadId, spotThreadIdsOf, spotThreadOf, threadPinKey } from './reviewPins';

interface ReviewModelInput {
  comments: ReviewComments | null;
  /** The review's threads, when the file takes comments (`isCommentable`). */
  threads: readonly ReviewThread[] | undefined;
  view: ReviewDiffView | null;
  file: ShownFile;
  /** Comments show in the code (`useReviewCommentsStore.inCode`): on a model, its pins. */
  inCode: boolean;
}

/**
 * A review's comments on a 3D model of its diff, for the model viewer (`ModelAnnotationsContext`): a pin per thread
 * (`reviewModelPinsOf`), one card open beside its pin, a thread gone to opened and the camera taken to it, and a click
 * starting a comment on the revision the diff comments on (`spotCommentAt`), kept while the window lives
 * (`useNewModelCommentsStore`). None for a file that takes no comments.
 */
export function useReviewModelAnnotations({ comments, threads, view, file, inCode }: ReviewModelInput): ReviewModelAnnotations {
  const allSpots = useNewModelCommentsStore((state) => state.spots);
  const startSpot = useNewModelCommentsStore((state) => state.start);
  const moveSpot = useNewModelCommentsStore((state) => state.moveTo);
  const fileKey = JSON.stringify([view, file]);
  const review = comments?.review;
  const modelThreads = useMemo(() => (threads && review && view ? modelThreadsOfFile(threads, review.target, view, file) : null), [threads, review, fileKey]);
  const threadIds = useMemo(() => spotThreadIdsOf(modelThreads), [modelThreads]);
  const spots = useMemo(() => (review && view && threads ? newSpotCommentsIn(allSpots, review.id, view, file) : NO_SPOTS), [allSpots, review, threads !== undefined, fileKey]);

  // The card open, per file: going to another file closes it.
  const [opened, setOpened] = useState<{ path: string; key: string } | null>(null);
  // Gone to: its pin opens and comes into view, once per time (`pinRevealedBy`).
  const focus = comments?.focus ?? null;
  const [reveal, setReveal] = useState<{ key: string; seq: number } | null>(null);
  const revealed = pinRevealedBy(focus, modelThreads, reveal?.seq);
  if (revealed) {
    setReveal(revealed);
    setOpened({ path: file.path, key: revealed.key });
  }

  const annotations = useMemo((): ModelAnnotations | null => {
    if (!comments || !view || !modelThreads) return null;
    const open = (key: string | null): void => setOpened(key === null ? null : { path: file.path, key });
    const topSide = topSideOf(file);
    const side = spotCommentSide(file);
    const pins = reviewModelPinsOf({ threads: modelThreads, spots, inCode, focusThreadId: focus?.threadId, topSide });
    const threadOfPin = (key: string) => {
      const threadId = pinThreadId(key);
      return threadId === null ? null : spotThreadOf(modelThreads, threadId);
    };
    const spotOfPin = (key: string) => spots.find((candidate) => newCommentPinKey(candidate.key) === key);
    return {
      pins,
      opened: openedPin(pins, opened, file.path),
      selected: focus ? threadPinKey(focus.threadId) : null,
      onOpen: (key) => {
        open(key);
        const found = key === null ? null : threadOfPin(key);
        if (found) comments.selectThread(found.thread);
      },
      renderCard: (key, placed) => {
        const spot = spotOfPin(key);
        if (spot) return <NewModelCommentCard spot={spot} onSent={() => open(null)} />;
        const found = threadOfPin(key);
        return found && <SpotThreadCard comments={comments} thread={found.thread} earlier={found.earlier ? modelEarlierTagOf(found.thread, placed.partGone) : undefined} onClose={() => open(null)} />;
      },
      commentsOn: side && modelSideOf(side),
      addComment: (spot: ModelSpot) => {
        const at = spotCommentAt(view, file, spot);
        if (!at) return;
        const started = startSpot((serial) => newSpotComment('model', comments.review.id, file.path, topSide, at, serial));
        open(newCommentPinKey(started.key));
      },
      moveComment: (key, spot) => {
        const moved = spotOfPin(key);
        if (moved) moveSpot(moved.key, spot);
      },
      reveal,
    };
  }, [comments, view, modelThreads, spots, inCode, focus, opened, reveal, fileKey, startSpot, moveSpot]);
  return { annotations, threadIds };
}

/** The model's annotations, and its threads' ids: where the header's button hides comments from, and a thread gone to. */
interface ReviewModelAnnotations {
  annotations: ModelAnnotations | null;
  threadIds: ReadonlySet<number>;
}

const NO_SPOTS: readonly NewModelCommentSpot[] = [];
