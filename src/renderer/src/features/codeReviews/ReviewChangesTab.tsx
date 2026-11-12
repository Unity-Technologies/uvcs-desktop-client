import { MessagesSquare } from 'lucide-react';
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
import { pluralize } from '../../lib/text';
import { commentsByFile, commentsPanelCounts, commentsPanelThreads, initialCommentsFilter, NO_COMMENTS_SEARCH, NO_FOLDED_FILES, unfoldedFor, type FoldedFiles, shownCommentsFilter, steppedThread, type CommentsFilter, type CommentsSearch } from './inline/commentsPanel';
import { isLineThread, type LineThread } from './inline/fileThreads';
import { reviewFileFlag } from './inline/reviewFileFlag';
import { ReviewCommentsContext, showInConversation, threadDiffRequest, type ReviewComments, type ThreadFocus } from './inline/reviewComments';
import { ReviewCommentsPanel } from './inline/ReviewCommentsPanel';
import { useReviewCommentsStore } from './inline/reviewCommentsStore';
import { selectedInPlace } from './inline/threadSelection';
import { useCommentContext } from './inline/useCommentContext';
import { changesFocusAskedFor, changesFocusRequest, type ChangesFocus } from './reviewTab';
import { useReviewCheckpoint } from './rounds/useReviewCheckpoint';
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
  const threads = useReviewThreads(review);
  const { reviewedUpTo, newIds, settled: checkpointSettled } = useReviewCheckpoint(review);
  const seq = useRef(1);
  const [focus, setFocus] = useState<ThreadFocus | null>(page.focusThread === undefined ? null : { threadId: page.focusThread, seq: seq.current });
  const [request, setRequest] = useState<DiffFocusRequest | null>(null);

  // The panel's filter, here so the keys go through what the panel lists while it's hidden too: it opens on what's new
  // to a reviewer back for another round, else on what's still open, when anything is, decided once the threads and
  // where the user left off are read, and kept (`shownCommentsFilter`), until one is picked.
  const [pickedFilter, setFilter] = useState<CommentsFilter | null>(null);
  const [openedOn, setOpenedOn] = useState<CommentsFilter | null>(null);
  if (threads && checkpointSettled && openedOn === null) setOpenedOn(initialCommentsFilter(threads, newIds));
  const filter = shownCommentsFilter(pickedFilter, openedOn);
  const order = useReviewCommentsStore((state) => state.panelOrder);
  const setOrder = useReviewCommentsStore((state) => state.setPanelOrder);
  const all = useMemo(() => (threads ? commentsPanelThreads(threads, 'all', NO_COMMENTS_SEARCH, order, newIds) : []), [threads, order, newIds]);
  const [search, setSearch] = useState<CommentsSearch>(NO_COMMENTS_SEARCH);
  const listed = useMemo(() => (threads ? commentsPanelThreads(threads, filter, search, order, newIds) : []), [threads, filter, search, order, newIds]);
  const groups = useMemo(() => commentsByFile(listed, order), [listed, order]);
  // Kept here, as the filter is: N unfolds the file of the comment it goes to with the panel hidden too.
  const [folded, setFolded] = useState<FoldedFiles>(NO_FOLDED_FILES);
  const tab = useRef<HTMLDivElement>(null);
  useCommentsPanelStart(threads === undefined ? null : all.length, tab);

  const goToThread = (thread: LineThread, inChangeset?: number): void => {
    seq.current += 1;
    setFocus({ threadId: thread.root.id, seq: seq.current });
    setFolded((current) => unfoldedFor(current, thread));
    setRequest(threadDiffRequest(review, thread, seq.current, inChangeset));
  };

  // The focus as last set, for a pick to compare with outside a state updater, which must stay pure.
  const latestFocus = useRef(focus);
  latestFocus.current = focus;
  const selectThread = useCallback((thread: LineThread): void => {
    const next = selectedInPlace(latestFocus.current, thread.root.id, seq.current + 1);
    if (next === latestFocus.current) return;
    seq.current = next.seq;
    latestFocus.current = next;
    setFocus(next);
    setFolded((current) => unfoldedFor(current, thread));
  }, []);

  const showThreadInConversation = useCallback((threadId: number): void => showInConversation(review.id, threadId), [review.id]);
  const seeInContext = useCommentContext(review);
  // The page moved while these changes show already (a comment's file gone to from the conversation, a check-in, what's
  // new since the user's review): go to what it asks, a thread once the threads are read.
  const [shownPage, setShownPage] = useState(page);
  const [asked, setAsked] = useState<ChangesFocus | undefined>(undefined);
  if (shownPage !== page) {
    setShownPage(page);
    const next = changesFocusAskedFor(shownPage, page);
    if (next !== undefined) setAsked(next);
  }
  useEffect(() => {
    if (asked === undefined || (asked.threadId !== undefined && !threads)) return;
    setAsked(undefined);
    const thread = threads?.find((candidate) => candidate.root.id === asked.threadId);
    if (thread && isLineThread(thread)) {
      goToThread(thread, asked.changesetId);
    } else if (asked.changesetId !== undefined || asked.changesets !== undefined) {
      seq.current += 1;
      setRequest(changesFocusRequest(asked, seq.current));
    }
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
    () => ({ review, threads, user, focus, goToThread, selectThread, showInConversation: showThreadInConversation, seeInContext }),
    [review, threads, user, focus, selectThread, showThreadInConversation, seeInContext],
  );

  // Beside the Comments panel toggle: what's still open, as the panel's Open chip counts it.
  const open = threads ? commentsPanelCounts(threads, newIds).open : undefined;
  const openComments = open === undefined ? undefined : { value: open, label: pluralize(open, 'open comment') };

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
                    focusChangesets={page.focusChangesets}
                    reviewedUpTo={reviewedUpTo}
                    pageAppliesShelve
                    detailsToggle={<DetailsToggleButton detailsKey={COMMENTS_PANEL_KEY} noun="Comments panel" icon={<MessagesSquare size={14} />} count={openComments} />}
                  />
                }
                details={
                  <ReviewCommentsPanel
                    comments={comments}
                    filter={filter}
                    newIds={newIds}
                    onFilterChange={setFilter}
                    search={search}
                    onSearchChange={setSearch}
                    listed={listed}
                    order={order}
                    onOrderChange={setOrder}
                    groups={groups}
                    folded={folded}
                    onFoldedChange={setFolded}
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
