import { useCallback, useMemo, useRef, useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { useDetailsPaneStore, type DetailsWidthLimits } from '../../components/detailsPaneStore';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { ListWithDetails } from '../../components/ListWithDetails';
import { commentLineText } from '../../lib/comments/commentText';
import { lazyComponent } from '../../lib/lazyComponent';
import { DiffFocusRequestContext, type DiffFocusRequest } from '../diff/diffFocusRequest';
import { DiffPage } from '../diff/DiffPage';
import { EntryAnnotatorContext } from '../diff/entryAnnotator';
import type { DiffTarget } from '@shared/domain/diff';
import { threadsOf } from './conversation/reviewThreads';
import { commentLocationPage } from './conversation/threadBadges';
import { useReviewConversation } from './conversation/useReviewConversation';
import { isLineThread, type LineThread } from './inline/fileThreads';
import { conversationAt, ReviewCommentsContext, threadDiffRequest, type ReviewComments, type ThreadFocus } from './inline/reviewComments';
import { ReviewCommentsPanel } from './inline/ReviewCommentsPanel';
import { useCommentContext } from './inline/useCommentContext';

const COMMENTS_PANEL_KEY = 'reviewComments';
/** Narrower than an object's details, and giving way first as the window narrows: the diff beside it is what's read. */
const COMMENTS_PANEL_WIDTH: DetailsWidthLimits = { initial: 340, min: 260, max: 560, restMin: 640 };

// It places comments by line diffs (Pierre's), which load with the diff viewer, on first use: not in the startup bundle.
const ReviewFileAnnotator = lazyComponent(() => import('./inline/ReviewFileAnnotator').then((module) => module.ReviewFileAnnotator));

interface ReviewChangesTabProps {
  review: CodeReview;
  page: PageOf<'codeReview'>;
  diffTarget: DiffTarget;
}

/**
 * A review's changes with what was said on its code: each file's diff holds its threads (`ReviewFileAnnotator`), and
 * the Comments panel beside it lists them all, going to one in the mode it was written in. Opened on a thread
 * (`focusThread`, from the conversation), it shows that thread.
 */
export function ReviewChangesTab({ review, page, diffTarget }: ReviewChangesTabProps) {
  const user = usePlaceUser();
  const toggleDetails = useDetailsPaneStore((state) => state.toggleHidden);
  const { data: conversation } = useReviewConversation(review.id);
  const threads = useMemo(() => conversation && threadsOf(conversation.comments), [conversation]);
  const seq = useRef(1);
  const [focus, setFocus] = useState<ThreadFocus | null>(page.focusThread === undefined ? null : { threadId: page.focusThread, seq: seq.current });
  const [request, setRequest] = useState<DiffFocusRequest | null>(null);

  const goToThread = (thread: LineThread): void => {
    seq.current += 1;
    setFocus({ threadId: thread.root.id, seq: seq.current });
    setRequest(threadDiffRequest(review, thread, seq.current));
  };

  // A page of its own, so Back returns to the code at the thread, which this page is first set to.
  const showInConversation = useCallback(
    (threadId: number): void => {
      const thread = threads?.find((candidate) => candidate.root.id === threadId);
      if (thread && isLineThread(thread)) navigation.replacePage(commentLocationPage(review.id, thread.root));
      navigation.openPage(conversationAt(review.id, threadId));
    },
    [review.id, threads],
  );
  const seeInContext = useCommentContext(review, showInConversation);
  const comments = useMemo<ReviewComments>(
    () => ({ review, threads, user, focus, goToThread, showInConversation, seeInContext }),
    [review, threads, user, focus, showInConversation, seeInContext],
  );

  return (
    <ReviewCommentsContext.Provider value={comments}>
      <EntryAnnotatorContext.Provider value={ReviewFileAnnotator}>
        <DiffFocusRequestContext.Provider value={request}>
          <ListWithDetails
            detailsKey={COMMENTS_PANEL_KEY}
            widthLimits={COMMENTS_PANEL_WIDTH}
            list={
              <DiffPage
                page={{ kind: 'diff', title: commentLineText(review.title), target: diffTarget, focusPath: page.focusPath, focusLines: page.focusLines }}
                focusChangeset={page.focusChangeset}
                detailsToggle={<DetailsToggleButton detailsKey={COMMENTS_PANEL_KEY} noun="Comments panel" />}
              />
            }
            details={<ReviewCommentsPanel comments={comments} onClose={() => toggleDetails(COMMENTS_PANEL_KEY)} />}
          />
        </DiffFocusRequestContext.Provider>
      </EntryAnnotatorContext.Provider>
    </ReviewCommentsContext.Provider>
  );
}
