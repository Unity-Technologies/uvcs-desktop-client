import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import type { DiffTarget } from '@shared/domain/diff';
import { usePlaceUser } from '../../app/account/accounts';
import type { PageOf } from '../../app/navigation/pages';
import { useDetailsPaneStore } from '../../components/detailsPaneStore';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { ListWithDetails } from '../../components/ListWithDetails';
import { commentLineText } from '../../lib/comments/commentText';
import { lazyComponent } from '../../lib/lazyComponent';
import { hotkey } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { DiffFocusRequestContext, type DiffFocusRequest } from '../diff/diffFocusRequest';
import { DiffPage } from '../diff/DiffPage';
import { EntryAnnotatorContext } from '../diff/entryAnnotator';
import { EntryFlagContext } from '../diff/entryFlag';
import { useReviewThreads } from './conversation/useReviewThreads';
import { commentsPanelThreads, initialCommentsFilter, NO_COMMENTS_SEARCH, shownCommentsFilter, steppedThread, type CommentsFilter, type CommentsSearch } from './inline/commentsPanel';
import { isLineThread, type LineThread } from './inline/fileThreads';
import { reviewFileFlag } from './inline/reviewFileFlag';
import { ReviewCommentsContext, showInConversation, threadDiffRequest, type ReviewComments, type ThreadFocus } from './inline/reviewComments';
import { ReviewCommentsPanel } from './inline/ReviewCommentsPanel';
import { useCommentContext } from './inline/useCommentContext';
import { changesFocusAskedFor } from './reviewTab';
import { COMMENTS_PANEL_KEY, COMMENTS_PANEL_WIDTH, useCommentsPanelStart } from './useCommentsPanelStart';
import styles from './CodeReviewPage.module.css';

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
  const threads = useReviewThreads(review.id);
  const seq = useRef(1);
  const [focus, setFocus] = useState<ThreadFocus | null>(page.focusThread === undefined ? null : { threadId: page.focusThread, seq: seq.current });
  const [request, setRequest] = useState<DiffFocusRequest | null>(null);

  // The panel's filter, here so the keys go through what the panel lists while it's hidden too: it opens on what's
  // still open, when anything is, decided at the first read and kept (`shownCommentsFilter`), until one is picked.
  const [pickedFilter, setFilter] = useState<CommentsFilter | null>(null);
  const [openedOn, setOpenedOn] = useState<CommentsFilter | null>(null);
  if (threads && openedOn === null) setOpenedOn(initialCommentsFilter(threads));
  const filter = shownCommentsFilter(pickedFilter, openedOn);
  const all = useMemo(() => (threads ? commentsPanelThreads(threads, 'all') : []), [threads]);
  const [search, setSearch] = useState<CommentsSearch>(NO_COMMENTS_SEARCH);
  const listed = useMemo(() => (threads ? commentsPanelThreads(threads, filter, search) : []), [threads, filter, search]);
  const tab = useRef<HTMLDivElement>(null);
  useCommentsPanelStart(threads === undefined ? null : all.length, tab);

  const goToThread = (thread: LineThread): void => {
    seq.current += 1;
    setFocus({ threadId: thread.root.id, seq: seq.current });
    setRequest(threadDiffRequest(review, thread, seq.current));
  };

  const showThreadInConversation = useCallback((threadId: number): void => showInConversation(review.id, threadId), [review.id]);
  const seeInContext = useCommentContext(review);
  // The page moved to a thread while these changes show already (a comment's file gone to from the conversation): go
  // to it once the threads are read.
  const [shownPage, setShownPage] = useState(page);
  const [asked, setAsked] = useState<number | undefined>(undefined);
  if (shownPage !== page) {
    setShownPage(page);
    const threadId = changesFocusAskedFor(shownPage, page);
    if (threadId !== undefined) setAsked(threadId);
  }
  useEffect(() => {
    if (asked === undefined || !threads) return;
    const thread = threads.find((candidate) => candidate.root.id === asked);
    setAsked(undefined);
    if (thread && isLineThread(thread)) goToThread(thread);
  }, [asked, threads]);
  const fileFlag = useMemo(() => (threads ? reviewFileFlag(threads, review.target) : null), [threads, review.target]);
  const step = (direction: 1 | -1): void => {
    const next = steppedThread(listed, all, focus?.threadId, direction);
    if (next) goToThread(next);
  };
  // Only while the tab shows, as every key in it (`ViewShownContext`): it stays mounted behind the conversation.
  useShortcut(hotkey('nextComment'), () => step(1), listed.length > 0, { whileTyping: false });
  useShortcut(hotkey('previousComment'), () => step(-1), listed.length > 0, { whileTyping: false });
  const comments = useMemo<ReviewComments>(
    () => ({ review, threads, user, focus, goToThread, showInConversation: showThreadInConversation, seeInContext }),
    [review, threads, user, focus, showThreadInConversation, seeInContext],
  );

  return (
    <ReviewCommentsContext.Provider value={comments}>
      <EntryAnnotatorContext.Provider value={ReviewFileAnnotator}>
        <EntryFlagContext.Provider value={fileFlag}>
          <DiffFocusRequestContext.Provider value={request}>
            <div ref={tab} className={styles.changesTab}>
              <ListWithDetails
                detailsKey={COMMENTS_PANEL_KEY}
                widthLimits={COMMENTS_PANEL_WIDTH}
                list={
                  <DiffPage
                    page={{ kind: 'diff', title: commentLineText(review.title), target: diffTarget, focusPath: page.focusPath, focusLines: page.focusLines }}
                    focusChangeset={page.focusChangeset}
                    pageAppliesShelve
                    detailsToggle={<DetailsToggleButton detailsKey={COMMENTS_PANEL_KEY} noun="Comments panel" />}
                  />
                }
                details={
                  <ReviewCommentsPanel
                    comments={comments}
                    filter={filter}
                    onFilterChange={setFilter}
                    search={search}
                    onSearchChange={setSearch}
                    listed={listed}
                    all={all}
                    onStep={step}
                    onClose={() => toggleDetails(COMMENTS_PANEL_KEY)}
                  />
                }
              />
            </div>
          </DiffFocusRequestContext.Provider>
        </EntryFlagContext.Provider>
      </EntryAnnotatorContext.Provider>
    </ReviewCommentsContext.Provider>
  );
}
