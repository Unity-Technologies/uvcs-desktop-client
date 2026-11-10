import { FileDiff, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useIsFetching } from '@tanstack/react-query';
import { useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { placeKey } from '../../api/queryKeys';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageProps, ReviewTab } from '../../app/navigation/pages';
import { isShownByCodeReviewPage } from '../../app/refresh/refreshScopes';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { MENU_WORDS } from '../../components/menuWords';
import { PathLabel } from '../../components/PathLabel';
import { ViewRefreshButton } from '../../components/ViewRefreshButton';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { EmptyState } from '../../ui/EmptyState';
import { RelativeTime } from '../../ui/RelativeTime';
import { SkeletonBar } from '../../ui/Skeleton';
import { tabId, tabPanelId, Tabs } from '../../ui/Tabs';
import { Stowable } from '../../ui/Stowable';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { reviewPageMenu } from './codeReviewMenu';
import { OwnReviewButton } from './OwnReviewButton';
import { reviewedCodeAction } from './reviewedCode';
import { describeTarget, reviewDiffTarget } from './reviewTarget';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { useCodeReview } from './useCodeReviews';
import { ReviewConversationTab } from './conversation/ReviewConversationTab';
import { ReviewChangesTab } from './ReviewChangesTab';
import { ViewShownContext } from '../../lib/viewShown';
import { conversationFocus, mountedTabs, openingTab, reviewTabShown } from './reviewTab';
import { ReviewTitle } from './ReviewTitle';
import styles from './CodeReviewPage.module.css';

const TABS_ID = 'code-review';

/**
 * A code review: what's reviewed, by whom, and its status, then its two tabs: its conversation (what was said on it) and its
 * changes. The page names the tab it shows (`openingTab`); picking another shows the page with it, in place.
 */
export function CodeReviewPage({ page }: PageProps<'codeReview'>) {
  const { data: review, isLoading, error } = useCodeReview(page.reviewId);
  const diffExpanded = useDiffExpanded();
  const tab = openingTab(page);
  const [mountedSoFar, setMounted] = useState<readonly ReviewTab[]>([tab]);
  const mounted = mountedTabs(mountedSoFar, tab);
  if (mounted !== mountedSoFar) setMounted(mounted);

  // Not in a list already read (opened from a branch chip, the palette, a link): the page's frame, its header a skeleton.
  if (isLoading) {
    return (
      <div className={styles.page}>
        <ReviewHeaderSkeleton />
        <div className={styles.tabPanel} />
      </div>
    );
  }
  if (error || !review) return <EmptyState title="Couldn't open the code review" description={error?.message} />;

  const diffTarget = reviewDiffTarget(review.target);
  return (
    <div className={styles.page}>
      {/* Out of sight while the review's diff is expanded, as the diff's own header is. */}
      <Stowable stowed={diffExpanded}>
        <ReviewHeader review={review} />
        <div className={styles.tabs}>
          <Tabs<ReviewTab>
            label="Code review"
            idPrefix={TABS_ID}
            value={tab}
            // A tab picked shows it as it is: what a link or a click on a thread went to stays behind.
            onChange={(value) => navigation.replacePage({ ...page, tab: value, focusThread: undefined, focusChangeset: undefined })}
            tabs={[
              { value: 'conversation', label: 'Conversation', icon: <MessageSquare size={14} />, count: review.commentCount },
              { value: 'changes', label: 'Changes', icon: <FileDiff size={14} /> },
            ]}
          />
        </div>
      </Stowable>
      {/* Each tab shown so far stays mounted, the other hidden: going back to it finds it as it was left (`mountedTabs`). */}
      {mounted.includes('conversation') && (
        <div className={styles.tabPanel} role="tabpanel" id={tabPanelId(TABS_ID, 'conversation')} aria-labelledby={tabId(TABS_ID, 'conversation')} hidden={!reviewTabShown(page, 'conversation')}>
          <ViewShownContext.Provider value={reviewTabShown(page, 'conversation')}>
            <ReviewConversationTab review={review} focusThread={conversationFocus(page)} />
          </ViewShownContext.Provider>
        </div>
      )}
      {mounted.includes('changes') && (
        <div className={styles.tabPanel} role="tabpanel" id={tabPanelId(TABS_ID, 'changes')} aria-labelledby={tabId(TABS_ID, 'changes')} hidden={!reviewTabShown(page, 'changes')}>
          {diffTarget ? (
            <ViewShownContext.Provider value={reviewTabShown(page, 'changes')}>
              <ReviewChangesTab review={review} page={page} diffTarget={diffTarget} />
            </ViewShownContext.Provider>
          ) : (
            <EmptyState title="The reviewed changes are not available" description={describeTarget(review.target)} />
          )}
        </div>
      )}
    </div>
  );
}

/** The review's header while it's read: its two rows at their heights, a placeholder where each one's words go. */
function ReviewHeaderSkeleton() {
  return (
    <header className={styles.header} aria-busy="true" aria-label="Loading">
      <div className={`${styles.titleRow} ${styles.placeholderTitle}`}>
        <SkeletonBar width="320px" />
      </div>
      <div className={`${styles.meta} ${styles.placeholderMeta}`}>
        <SkeletonBar width="420px" />
      </div>
    </header>
  );
}

/**
 * Two rows: the title, then what's reviewed, by whom and when, its status first. The actions sit at the title's end:
 * the reviewed code to the workspace, the user's own review, Refresh (others write on the review while it's open), and
 * the page's menu (`reviewPageMenu`), deleting in it.
 */
function ReviewHeader({ review }: { review: CodeReview }) {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  // The review menu's own entry (`codeReviewMenu`), as a button: the reviewer gets the code to run it, in a workspace.
  const reviewedCode = reviewedCodeAction(place, review.target, workspace?.selector);
  const ReviewedCodeIcon = reviewedCode && MENU_WORDS[reviewedCode.word].icon;
  // What Refresh reads again here (`pageRefreshScope`): its icon spins while any of it is read.
  const shownByThePage = isShownByCodeReviewPage(review.id, review.target);
  const fetching = useIsFetching({ queryKey: placeKey(place), predicate: ({ queryKey }) => shownByThePage(queryKey) }) > 0;

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <ReviewTitle review={review} />
        <div className={styles.headerActions}>
          {reviewedCode && ReviewedCodeIcon && (
            // aria-disabled rather than disabled, so hovering still shows the tooltip saying why.
            <Button
              className={styles.reviewedCode}
              icon={<ReviewedCodeIcon size={14} />}
              aria-disabled={reviewedCode.disabledReason !== undefined || undefined}
              data-tip={reviewedCode.disabledReason ?? reviewedCode.label}
              onClick={() => reviewedCode.disabledReason === undefined && void reviewedCode.run()}
            >
              {reviewedCode.label}
            </Button>
          )}
          <OwnReviewButton review={review} />
          <ViewRefreshButton fetching={fetching} />
          <ActionDropdownMenu entries={reviewPageMenu(place, review)}>
            <IconButton icon={<MoreHorizontal size={15} />} label="More actions" />
          </ActionDropdownMenu>
        </div>
      </div>
      <div className={styles.meta}>
        <CodeReviewStatusBadge status={review.status} />
        <UserLabel user={review.owner} />
        <span>wants a review of</span>
        {/* A branch fitted to the row as every branch shown on its own is (`PathLabel`), whole in its tooltip. */}
        <span className={styles.target}>{review.target.kind === 'branch' ? <PathLabel path={review.target.branch} fitContent /> : describeTarget(review.target)}</span>
        <span className={styles.dot}>·</span>
        <RelativeTime date={review.date} />
      </div>
    </header>
  );
}
