import { useEffect, useMemo, useRef, useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { ListWithDetails } from '../../components/ListWithDetails';
import { commentLineText } from '../../lib/comments/commentText';
import { lazyComponent } from '../../lib/lazyComponent';
import { DiffFocusRequestContext, type DiffFocusRequest } from '../diff/diffFocusRequest';
import { DiffPage } from '../diff/DiffPage';
import { EntryAnnotatorContext } from '../diff/entryAnnotator';
import type { DiffTarget } from '@shared/domain/diff';
import { threadsOf } from './conversation/reviewThreads';
import { useReviewConversation } from './conversation/useReviewConversation';
import { isLineThread, type LineThread } from './inline/fileThreads';
import { ReviewCommentsContext, threadDiffRequest, type ReviewComments, type ThreadFocus } from './inline/reviewComments';
import { ReviewCommentsPanel } from './inline/ReviewCommentsPanel';

const COMMENTS_PANEL_KEY = 'reviewComments';

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
 * (`focusThread`, from the conversation or a link), it shows that thread.
 */
export function ReviewChangesTab({ review, page, diffTarget }: ReviewChangesTabProps) {
  const user = usePlaceUser();
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

  // A thread asked for by the page while the tab shows (a link to it): gone to as the panel goes to one.
  const pageThread = page.focusThread;
  const shownPageThread = useRef(pageThread);
  useEffect(() => {
    if (pageThread === shownPageThread.current || pageThread === undefined || !threads) return;
    shownPageThread.current = pageThread;
    const thread = threads.find((candidate) => candidate.root.id === pageThread);
    if (thread && isLineThread(thread)) goToThread(thread);
  }, [pageThread, threads]);

  const comments = useMemo<ReviewComments>(
    () => ({
      review,
      threads,
      user,
      focus,
      goToThread,
      showInConversation: (threadId) => navigation.replacePage({ kind: 'codeReview', reviewId: review.id, tab: 'conversation', focusThread: threadId }),
    }),
    [review, threads, user, focus],
  );

  return (
    <ReviewCommentsContext.Provider value={comments}>
      <EntryAnnotatorContext.Provider value={ReviewFileAnnotator}>
        <DiffFocusRequestContext.Provider value={request}>
          <ListWithDetails
            detailsKey={COMMENTS_PANEL_KEY}
            list={
              <DiffPage
                page={{ kind: 'diff', title: commentLineText(review.title), target: diffTarget, focusPath: page.focusPath, focusLines: page.focusLines }}
                focusChangeset={page.focusChangeset}
                detailsToggle={<DetailsToggleButton detailsKey={COMMENTS_PANEL_KEY} noun="comments" />}
              />
            }
            details={<ReviewCommentsPanel comments={comments} />}
          />
        </DiffFocusRequestContext.Provider>
      </EntryAnnotatorContext.Provider>
    </ReviewCommentsContext.Provider>
  );
}
