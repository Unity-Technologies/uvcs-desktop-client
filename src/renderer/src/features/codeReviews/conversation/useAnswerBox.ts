import { useEffect, useRef, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { useCommentDraftStore } from '../../../components/commentDraftStore';
import { canDiscard } from './commentPermissions';
import type { ReviewThread } from './reviewThreads';
import { answerOpenedByHand, answerShownOnReturn, nextAnswerBox, type AnswerBox, type Answering } from './threadAnswer';

export interface AnswerBoxControl {
  box: AnswerBox;
  /** "Reply…" or "Discard…" clicked: that box opens with the focus. */
  open: (answering: Answering) => void;
  /** Sent or cancelled here. */
  close: () => void;
  /** On the box's element: while the focus is in it, a draft forgotten elsewhere doesn't close it. */
  boxRef: RefObject<HTMLDivElement | null>;
}

/**
 * A thread's answer box, following its drafts in `useCommentDraftStore`: open with a draft left unsent as the card
 * mounts (`answerShownOnReturn`), then kept in step as the same thread is written in elsewhere, the other tab of the
 * review or a popover on an image or a model (`nextAnswerBox`). Its card folds by it (`initialThreadCardFold`).
 */
export function useAnswerBox(thread: ReviewThread, user: string | undefined): AnswerBoxControl {
  const place = usePlace();
  const drafts = useCommentDraftStore(
    useShallow((state) => ({
      reply: state.drafts[commentDraftKey(placeId(place), 'reviewReply', thread.root.guid)],
      discard: state.drafts[commentDraftKey(placeId(place), 'reviewDiscard', thread.root.guid)],
    })),
  );
  const discardable = canDiscard(thread, user);
  const [box, setBox] = useState<AnswerBox>(() => answerShownOnReturn(drafts, discardable));
  const previousDrafts = useRef(drafts);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // An effect, not a render-time update: whether the focus is in the box is read from the document. The other tab,
  // hidden but mounted, follows at once; a view its `Activity` hides runs it again once shown, and catches up.
  useEffect(() => {
    const focused = boxRef.current?.contains(document.activeElement) ?? false;
    // Read now: the updater runs on the next render, after the ref below already holds these drafts.
    const previous = previousDrafts.current;
    setBox((current) => nextAnswerBox(current, previous, drafts, discardable, focused));
    previousDrafts.current = drafts;
  }, [drafts, discardable]);

  return {
    box,
    open: (answering) => setBox(answerOpenedByHand(answering)),
    close: () => setBox({ answering: null, focuses: false }),
    boxRef,
  };
}
