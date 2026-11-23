import { useMemo, useState } from 'react';
import type { ImageSpot } from '@shared/domain/reviewConversation';
import type { ImageAnnotations } from '../../diff/viewer/image/imageAnnotations';
import type { ReviewThread } from '../conversation/reviewThreads';
import { topSideOf } from './fileComments';
import { imageThreadsOfFile, type ImageThreads, type ReviewDiffView, type ShownFile } from './fileThreads';
import { ImageThreadCard } from './ImageThreadCard';
import { imageCommentAt, imageCommentSide, newImageCommentSpot, newImageCommentsIn } from './newImageComment';
import { useNewImageCommentsStore } from './newImageCommentsStore';
import { NewImageCommentCard } from './NewImageCommentCard';
import type { ReviewComments } from './reviewComments';
import { imageSideOf, newCommentPinKey, pinThreadId, reviewImagePinsOf, threadPinKey } from './reviewImagePins';

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
  const openSpot = useNewImageCommentsStore((state) => state.open);
  const moveSpot = useNewImageCommentsStore((state) => state.moveTo);
  const fileKey = JSON.stringify([view, file]);
  const review = comments?.review;
  const imageThreads = useMemo(() => (threads && review && view ? imageThreadsOfFile(threads, review.target, view, file) : null), [threads, review, fileKey]);
  const spots = useMemo(() => (review && view && threads ? newImageCommentsIn(allSpots, review.id, view, file) : []), [allSpots, review, threads !== undefined, fileKey]);

  // The card open, per file: going to another file closes it.
  const [opened, setOpened] = useState<{ path: string; key: string } | null>(null);
  const openedKey = opened?.path === file.path ? opened.key : null;
  const open = (key: string | null): void => setOpened(key === null ? null : { path: file.path, key });

  // Gone to (from the Comments panel, the keys, the conversation): its pin opens and comes into view, once per time.
  const focus = comments?.focus ?? null;
  const [reveal, setReveal] = useState<{ key: string; seq: number } | null>(null);
  if (focus && imageThreads && holdsThread(imageThreads, focus.threadId) && reveal?.seq !== focus.seq && !focus.inPlace) {
    const key = threadPinKey(focus.threadId);
    setReveal({ key, seq: focus.seq });
    setOpened({ path: file.path, key });
  }

  if (!comments || !view || !imageThreads) return NO_IMAGE_ANNOTATIONS;
  const topSide = topSideOf(file);
  const pins = reviewImagePinsOf({ threads: imageThreads, spots, inCode, focusThreadId: focus?.threadId, topSide });
  const reviewId = comments.review.id;
  const side = imageCommentSide(file);
  const annotations: ImageAnnotations = {
    pins,
    opened: pins.some((pin) => pin.key === openedKey) ? openedKey : null,
    selected: focus ? threadPinKey(focus.threadId) : null,
    onOpen: (key) => {
      open(key);
      const threadId = key === null ? null : pinThreadId(key);
      const thread = threadId === null ? undefined : threadOf(imageThreads, threadId);
      if (thread) comments.selectThread(thread);
    },
    renderCard: (key) => {
      const spot = spots.find((candidate) => newCommentPinKey(candidate.key) === key);
      if (spot) return <NewImageCommentCard spot={spot} onSent={() => open(null)} />;
      const threadId = pinThreadId(key);
      const thread = threadId === null ? undefined : threadOf(imageThreads, threadId);
      const earlier = imageThreads.earlier.some((entry) => entry.thread.root.id === threadId);
      return thread ? <ImageThreadCard comments={comments} thread={thread} earlier={earlier} onClose={() => open(null)} /> : null;
    },
    commentsOn: side && imageSideOf(side),
    addComment: (spot: ImageSpot) => {
      const at = imageCommentAt(view, file, spot);
      if (!at) return;
      const started = newImageCommentSpot(reviewId, file.path, topSide, at);
      openSpot(started);
      open(newCommentPinKey(started.key));
    },
    moveComment: (key, spot) => {
      const moved = spots.find((candidate) => newCommentPinKey(candidate.key) === key);
      if (moved) moveSpot(moved.key, spot);
    },
    reveal,
  };
  return { annotations, threadCount: imageThreads.placed.length + imageThreads.earlier.length, holds: (threadId) => holdsThread(imageThreads, threadId) };
}

/** The image's annotations, how many threads it has (the header's button hiding them shows only then), and which. */
interface ReviewImageAnnotations {
  annotations: ImageAnnotations | null;
  threadCount: number;
  holds: (threadId: number) => boolean;
}

const NO_IMAGE_ANNOTATIONS: ReviewImageAnnotations = { annotations: null, threadCount: 0, holds: () => false };

function threadOf(threads: ImageThreads, threadId: number) {
  return [...threads.placed, ...threads.earlier].find((entry) => entry.thread.root.id === threadId)?.thread;
}

function holdsThread(threads: ImageThreads, threadId: number): boolean {
  return threadOf(threads, threadId) !== undefined;
}
