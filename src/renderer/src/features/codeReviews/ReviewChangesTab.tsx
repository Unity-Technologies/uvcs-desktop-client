import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FILES_WIDTH } from '../diff/DiffBrowserLayout';
import styles from './CodeReviewPage.module.css';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlaceUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { detailsWidthOf, useDetailsPaneStore, type DetailsWidthLimits } from '../../components/detailsPaneStore';
import { DetailsToggleButton } from '../../components/DetailsToggleButton';
import { ListWithDetails } from '../../components/ListWithDetails';
import { commentLineText } from '../../lib/comments/commentText';
import { lazyComponent } from '../../lib/lazyComponent';
import { DiffFocusRequestContext, type DiffFocusRequest } from '../diff/diffFocusRequest';
import { DiffPage } from '../diff/DiffPage';
import { EntryAnnotatorContext } from '../diff/entryAnnotator';
import { EntryFlagContext } from '../diff/entryFlag';
import type { DiffTarget } from '@shared/domain/diff';
import { commentLocationPage } from './conversation/threadBadges';
import { useReviewThreads } from './conversation/useReviewThreads';
import { isLineThread, type LineThread } from './inline/fileThreads';
import { reviewFileFlag } from './inline/reviewFileFlag';
import { conversationAt, ReviewCommentsContext, threadDiffRequest, type ReviewComments, type ThreadFocus } from './inline/reviewComments';
import { ReviewCommentsPanel } from './inline/ReviewCommentsPanel';
import { useCommentContext } from './inline/useCommentContext';
import { commentsPanelStartsHidden, commentsPanelThreads, diffWidthBesidePanel, initialCommentsFilter, NO_COMMENTS_SEARCH, shownCommentsFilter, steppedThread, type CommentsFilter, type CommentsSearch } from './inline/commentsPanel';
import { hotkey } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';

const COMMENTS_PANEL_KEY = 'reviewComments';
/** Narrower than an object's details, and giving way first as the window narrows: the diff beside it is what's read. */
const COMMENTS_PANEL_WIDTH: DetailsWidthLimits = { initial: 340, min: 260, max: 560, restMin: 640 };

// It places comments by line diffs (Pierre's), which load with the diff viewer, on first use: not in the startup bundle.
const ReviewFileAnnotator = lazyComponent(() => import('./inline/ReviewFileAnnotator').then((module) => module.ReviewFileAnnotator));

interface ReviewChangesTabProps {
  review: CodeReview;
  page: PageOf<'codeReview'>;
  diffTarget: DiffTarget;
  /** Whether it's the tab shown: it stays mounted behind the conversation, its keys off meanwhile. */
  shown: boolean;
}

/**
 * A review's changes with what was said on its code: each file's diff holds its threads (`ReviewFileAnnotator`), and
 * the Comments panel beside it lists them all, going to one in the mode it was written in. Opened on a thread
 * (`focusThread`, from the conversation), it shows that thread.
 */
export function ReviewChangesTab({ review, page, diffTarget, shown }: ReviewChangesTabProps) {
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
  usePanelStart(threads === undefined ? null : all.length, tab);

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
  const fileFlag = useMemo(() => (threads ? reviewFileFlag(threads, review.target) : null), [threads, review.target]);
  const step = (direction: 1 | -1): void => {
    const next = steppedThread(listed, all, focus?.threadId, direction);
    if (next) goToThread(next);
  };
  // Only while the tab shows: it stays mounted behind the conversation.
  useShortcut(hotkey('nextComment'), () => step(1), shown && listed.length > 0, { whileTyping: false });
  useShortcut(hotkey('previousComment'), () => step(-1), shown && listed.length > 0, { whileTyping: false });
  const comments = useMemo<ReviewComments>(
    () => ({ review, threads, user, focus, goToThread, showInConversation, seeInContext }),
    [review, threads, user, focus, showInConversation, seeInContext],
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

/**
 * Starts the Comments panel hidden when it has nothing to list (`commentsPanelStartsHidden`), decided once the
 * conversation is first read (`codeThreads`, null until then); leaving the review forgets it.
 */
function usePanelStart(codeThreads: number | null, tab: RefObject<HTMLElement | null>): void {
  const decided = useRef(false);
  const startHidden = useDetailsPaneStore((state) => state.startHidden);
  const forgetStarted = useDetailsPaneStore((state) => state.forgetStarted);
  // Before the frame paints: the panel never shows for a moment first.
  useLayoutEffect(() => {
    if (decided.current || codeThreads === null) return;
    decided.current = true;
    const panelWidth = detailsWidthOf(useDetailsPaneStore.getState(), COMMENTS_PANEL_KEY, COMMENTS_PANEL_WIDTH);
    const diffWidth = diffWidthBesidePanel({ tabWidth: tab.current?.clientWidth ?? 0, filesWidth: FILES_WIDTH, panelWidth });
    if (commentsPanelStartsHidden({ codeThreads, diffWidth })) startHidden(COMMENTS_PANEL_KEY);
  }, [codeThreads, startHidden, tab]);
  useEffect(
    () => () => {
      decided.current = false;
      forgetStarted(COMMENTS_PANEL_KEY);
    },
    [forgetStarted],
  );
}
