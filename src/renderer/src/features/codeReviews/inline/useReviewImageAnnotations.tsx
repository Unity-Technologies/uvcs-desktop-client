import { useMemo, useState } from 'react';
import type { ImageSpot } from '@shared/domain/reviewConversation';
import type { ImageAnnotations } from '../../diff/viewer/image/imageAnnotations';
import type { ReviewThread } from '../conversation/reviewThreads';
import { topSideOf } from './fileComments';
import { imageThreadsOfFile, type ReviewDiffView, type ShownFile } from './fileThreads';
import { ImageThreadCard } from './ImageThreadCard';
import { imageCommentAt, imageCommentSide, newImageCommentSpot, newImageCommentsIn, type NewImageCommentSpot } from './newImageComment';
import { useNewImageCommentsStore } from './newImageCommentsStore';
import { NewImageCommentCard } from './NewImageCommentCard';
import type { ReviewComments } from './reviewComments';
import { imageSideOf, reviewImagePinsOf } from './reviewImagePins';
import { newCommentPinKey, openedPin, pinRevealedBy, pinThreadId, spotThreadIdsOf, spotThreadOf, threadPinKey } from './reviewPins';

interface ReviewImageInput {
  comments: ReviewComments | null;
  /** The review's threads, when the file takes comments (`isCommentable`). */
  threads: readonly ReviewThread[] | undefined;
  view: ReviewDiffView | null;
  file: ShownFile;
  /** Comments show in the code (`useReviewCommentsStore.inCode`): on an image, its pins. */
  inCode: boolean;
}

/**
 * A review's comments on an image of its diff, for the image viewer (`ImageAnnotationsContext`): a pin per thread
 * (`reviewImagePinsOf`), one card open beside its pin, a thread gone to opened and brought into view, and a click or a
 * drag starting a comment on the revision the diff comments on (`imageCommentAt`), kept while the window lives
 * (`useNewImageCommentsStore`). None for a file that takes no comments.
 */
export function useReviewImageAnnotations({ comments, threads, view, file, inCode }: ReviewImageInput): ReviewImageAnnotations {
  const allSpots = useNewImageCommentsStore((state) => state.spots);
  const startSpot = useNewImageCommentsStore((state) => state.start);
  const moveSpot = useNewImageCommentsStore((state) => state.moveTo);
  const fileKey = JSON.stringify([view, file]);
  const review = comments?.review;
  const imageThreads = useMemo(() => (threads && review && view ? imageThreadsOfFile(threads, review.target, view, file) : null), [threads, review, fileKey]);
  const threadIds = useMemo(() => spotThreadIdsOf(imageThreads), [imageThreads]);
  const spots = useMemo(() => (review && view && threads ? newImageCommentsIn(allSpots, review.id, view, file) : NO_SPOTS), [allSpots, review, threads !== undefined, fileKey]);

  // The card open, per file: going to another file closes it.
  const [opened, setOpened] = useState<{ path: string; key: string } | null>(null);
  // Gone to: its pin opens and comes into view, once per time (`pinRevealedBy`).
  const focus = comments?.focus ?? null;
  const [reveal, setReveal] = useState<{ key: string; seq: number } | null>(null);
  const revealed = pinRevealedBy(focus, imageThreads, reveal?.seq);
  if (revealed) {
    setReveal(revealed);
    setOpened({ path: file.path, key: revealed.key });
  }

  const annotations = useMemo((): ImageAnnotations | null => {
    if (!comments || !view || !imageThreads) return null;
    const open = (key: string | null): void => setOpened(key === null ? null : { path: file.path, key });
    const topSide = topSideOf(file);
    const side = imageCommentSide(file);
    const pins = reviewImagePinsOf({ threads: imageThreads, spots, inCode, focusThreadId: focus?.threadId, topSide });
    const threadOfPin = (key: string) => {
      const threadId = pinThreadId(key);
      return threadId === null ? null : spotThreadOf(imageThreads, threadId);
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
      renderCard: (key) => {
        const spot = spotOfPin(key);
        if (spot) return <NewImageCommentCard spot={spot} onSent={() => open(null)} />;
        const found = threadOfPin(key);
        return found && <ImageThreadCard comments={comments} thread={found.thread} earlier={found.earlier} onClose={() => open(null)} />;
      },
      commentsOn: side && imageSideOf(side),
      addComment: (spot: ImageSpot) => {
        const at = imageCommentAt(view, file, spot);
        if (!at) return;
        const started = startSpot((serial) => newImageCommentSpot(comments.review.id, file.path, topSide, at, serial));
        open(newCommentPinKey(started.key));
      },
      moveComment: (key, spot) => {
        const moved = spotOfPin(key);
        if (moved) moveSpot(moved.key, spot);
      },
      reveal,
    };
  }, [comments, view, imageThreads, spots, inCode, focus, opened, reveal, fileKey, startSpot, moveSpot]);
  return { annotations, threadIds };
}

/** The image's annotations, and its threads' ids: where the header's button hides comments from, and a thread gone to. */
interface ReviewImageAnnotations {
  annotations: ImageAnnotations | null;
  threadIds: ReadonlySet<number>;
}

const NO_SPOTS: readonly NewImageCommentSpot[] = [];
