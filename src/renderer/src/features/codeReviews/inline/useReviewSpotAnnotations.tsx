import { useMemo, useState, type ReactNode } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewThread } from '../conversation/reviewThreads';
import { topSideOf } from './fileComments';
import type { FileThread, ReviewDiffView, ShownFile, ThreadSide } from './fileThreads';
import { newSpotComment, newSpotCommentsIn, spotCommentAt, spotCommentSide, type NewSpotComment } from './newSpotComment';
import type { NewSpotComments } from './newSpotCommentsStore';
import type { ReviewComments } from './reviewComments';
import { newCommentPinKey, openedPin, pinRevealedBy, pinThreadId, spotThreadIdsOf, spotThreadOf, threadPinKey, threadShownWhileHidden, type SpotThreads } from './reviewPins';
import { SpotThreadCard } from './SpotThreadCard';

/** What the viewer found placing a pin, which its card may say (a model's part not in the version shown). */
export interface PinPlaced {
  partGone: boolean;
}

/**
 * What a kind of spot (an image's, a model's) brings to a review's comments on it: its threads in a file, its pins,
 * the viewer's name for a side, its cards, and the store its comments being written are kept in.
 */
export interface SpotCommentKind<Spot, Thread extends FileThread, Threads extends SpotThreads<Thread>, Side, Pin extends { key: string }> {
  on: 'image' | 'model';
  store: UseBoundStore<StoreApi<NewSpotComments<NewSpotComment<Spot>>>>;
  threadsOfFile: (threads: readonly ReviewThread[], review: CodeReviewTarget, view: ReviewDiffView, file: ShownFile) => Threads;
  pinsOf: (input: { threads: Threads; spots: readonly NewSpotComment<Spot>[]; inCode: boolean; focusThreadId: number | undefined; topSide: ThreadSide }) => Pin[];
  sideOf: (side: ThreadSide) => Side;
  newCard: (spot: NewSpotComment<Spot>, onSent: () => void) => ReactNode;
  earlierTag: (thread: Thread, placed: PinPlaced | undefined) => { label: string; tip: string };
}

/** What a viewer of spots takes from a place (`ImageAnnotations`, `ModelAnnotations` are this, for their spot). */
export interface SpotAnnotations<Spot, Side, Pin> {
  pins: readonly Pin[];
  opened: string | null;
  selected: string | null;
  onOpen: (key: string | null) => void;
  renderCard: (key: string, placed?: PinPlaced) => ReactNode;
  commentsOn: Side | null;
  addComment: (spot: Spot) => void;
  moveComment: (key: string, spot: Spot) => void;
  reveal: { key: string; seq: number } | null;
}

export interface ReviewSpotInput {
  comments: ReviewComments | null;
  /** The review's threads, when the file takes comments (`isCommentable`). */
  threads: readonly ReviewThread[] | undefined;
  view: ReviewDiffView | null;
  file: ShownFile;
  /** Comments show in the code (`useReviewCommentsStore.inCode`): on an image or a model, its pins. */
  inCode: boolean;
}

/**
 * A review's comments on spots of a file of its diff, of one kind (`SpotCommentKind`), for its viewer: a pin per
 * thread, one card open beside its pin, a thread gone to opened and brought into view, and a spot marked starting a
 * comment on the revision the diff comments on (`spotCommentAt`), kept while the window lives (`kind.store`). The
 * annotations are none for a file that takes no comments; the threads' ids are where the header's button hides
 * comments from, and a thread gone to.
 */
export function useReviewSpotAnnotations<Spot, Thread extends FileThread, Threads extends SpotThreads<Thread>, Side, Pin extends { key: string }>(
  { comments, threads, view, file, inCode }: ReviewSpotInput,
  kind: SpotCommentKind<Spot, Thread, Threads, Side, Pin>,
): { annotations: SpotAnnotations<Spot, Side, Pin> | null; threadIds: ReadonlySet<number> } {
  const allSpots = kind.store((state) => state.spots);
  const startSpot = kind.store((state) => state.start);
  const moveSpot = kind.store((state) => state.moveTo);
  const fileKey = JSON.stringify([view, file]);
  const review = comments?.review;
  const spotThreads = useMemo(() => (threads && review && view ? kind.threadsOfFile(threads, review.target, view, file) : null), [threads, review, fileKey]);
  const threadIds = useMemo(() => spotThreadIdsOf(spotThreads), [spotThreads]);
  const spots = useMemo(() => (review && view && threads ? newSpotCommentsIn(allSpots, review.id, view, file) : []), [allSpots, review, threads !== undefined, fileKey]);

  // The card open, per file: going to another file closes it.
  const [opened, setOpened] = useState<{ path: string; key: string } | null>(null);
  // Gone to: its pin opens and comes into view, once per time (`pinRevealedBy`).
  const focus = comments?.focus ?? null;
  const [reveal, setReveal] = useState<{ key: string; seq: number } | null>(null);
  const revealed = pinRevealedBy(focus, spotThreads, reveal?.seq);
  if (revealed) {
    setReveal(revealed);
    setOpened({ path: file.path, key: revealed.key });
  }

  // Where the focus was when comments were last hidden (`threadShownWhileHidden`): a thread selected then hides too.
  const [hiddenAt, setHiddenAt] = useState<{ inCode: boolean; seq: number | null }>({ inCode, seq: null });
  if (hiddenAt.inCode !== inCode) setHiddenAt({ inCode, seq: inCode ? null : (focus?.seq ?? null) });
  const shownWhileHidden = threadShownWhileHidden(focus, hiddenAt.seq);

  const annotations = useMemo((): SpotAnnotations<Spot, Side, Pin> | null => {
    if (!comments || !view || !spotThreads) return null;
    const open = (key: string | null): void => setOpened(key === null ? null : { path: file.path, key });
    const topSide = topSideOf(file);
    const side = spotCommentSide(file);
    const pins = kind.pinsOf({ threads: spotThreads, spots, inCode, focusThreadId: shownWhileHidden, topSide });
    const threadOfPin = (key: string) => {
      const threadId = pinThreadId(key);
      return threadId === null ? null : spotThreadOf(spotThreads, threadId);
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
        if (spot) return kind.newCard(spot, () => open(null));
        const found = threadOfPin(key);
        return found && <SpotThreadCard comments={comments} thread={found.thread} earlier={found.earlier ? kind.earlierTag(found.thread, placed) : undefined} onClose={() => open(null)} />;
      },
      commentsOn: side && kind.sideOf(side),
      addComment: (spot) => {
        const at = spotCommentAt(view, file, spot);
        if (!at) return;
        const started = startSpot((serial) => newSpotComment(kind.on, comments.review.id, file.path, topSide, at, serial));
        open(newCommentPinKey(started.key));
      },
      moveComment: (key, spot) => {
        const moved = spotOfPin(key);
        if (moved) moveSpot(moved.key, spot);
      },
      reveal,
    };
  }, [comments, view, spotThreads, spots, inCode, focus, shownWhileHidden, opened, reveal, fileKey, startSpot, moveSpot]);
  return { annotations, threadIds };
}
