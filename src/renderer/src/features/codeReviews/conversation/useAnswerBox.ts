import { useEffect, useRef, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { useCommentDraftStore } from '../../../components/commentDraftStore';
import { canDiscard } from './commentPermissions';
import type { ReviewThread } from './reviewThreads';
import { answerDraftOf, answerOpenedByHand, answerShownOnReturn, followDrafts, type AnswerBox, type Answering, type AnswerFollowing } from './threadAnswer';

export interface AnswerBoxControl {
  box: AnswerBox;
  /** "Reply…" or "Discard…" clicked: that box opens with the focus. */
  open: (answering: Answering) => void;
  /** Sent or cancelled here. */
  close: () => void;
  /** On the box's element: while the focus is in it, a draft forgotten elsewhere doesn't close it. */
  boxRef: RefObject<HTMLDivElement | null>;
  /** Where each composer keeps its draft (`commentDraftKey`): the keys this box follows. */
  replyKey: string;
  discardKey: string;
}

/**
 * A thread's answer box, following its drafts in `useCommentDraftStore`: open with a draft left unsent as the card
 * mounts (`answerShownOnReturn`), then kept in step as the same thread is written in elsewhere, the other tab of the
 * review or a popover on an image or a model (`followDrafts`). Its card folds by it (`initialThreadCardFold`), and
 * unfolds when words written elsewhere open it (`onUnfold`).
 */
export function useAnswerBox(thread: ReviewThread, user: string | undefined, onUnfold: () => void): AnswerBoxControl {
  const place = usePlace();
  const replyKey = commentDraftKey(placeId(place), 'reviewReply', thread.root.guid);
  const discardKey = commentDraftKey(placeId(place), 'reviewDiscard', thread.root.guid);
  // Each draft's state, not its text: typing changes neither, so no card showing the thread renders for a keystroke.
  const drafts = useCommentDraftStore(useShallow((state) => ({ reply: answerDraftOf(state.drafts[replyKey]), discard: answerDraftOf(state.drafts[discardKey]) })));
  const discardable = canDiscard(thread, user);
  const [following, setFollowing] = useState<AnswerFollowing>(() => ({ box: answerShownOnReturn(drafts, discardable), seen: drafts }));
  const boxRef = useRef<HTMLDivElement | null>(null);

  // An effect, not a render-time update: whether the focus is in the box is read from the document, and unfolding the
  // card is the card's own state. It reads the state of the render it follows, the latest. The other tab, hidden but
  // mounted, follows at once; a view its `Activity` hides runs it again once shown, and catches up.
  useEffect(() => {
    const focused = boxRef.current?.contains(document.activeElement) ?? false;
    const step = followDrafts(following, drafts, discardable, focused);
    if (step.following !== following) setFollowing(step.following);
    if (step.unfolds) onUnfold();
    // Only the drafts and the permission move it; the state read is the render's own, and `onUnfold` only unfolds.
  }, [drafts, discardable]);

  return {
    box: following.box,
    open: (answering) => setFollowing((current) => ({ ...current, box: answerOpenedByHand(answering) })),
    close: () => setFollowing((current) => ({ ...current, box: { answering: null, focuses: false } })),
    boxRef,
    replyKey,
    discardKey,
  };
}
