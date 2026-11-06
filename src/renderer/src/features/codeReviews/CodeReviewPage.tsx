import { commentLineText } from '../../lib/comments/commentText';
import { FileDiff, MessageSquare, MoreHorizontal } from 'lucide-react';
import type { CodeReview } from '@shared/domain/codeReview';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageProps, ReviewTab } from '../../app/navigation/pages';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { MENU_WORDS } from '../../components/menuWords';
import { PathLabel } from '../../components/PathLabel';
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
import { DiffPage } from '../diff/DiffPage';
import { reviewPageMenu } from './codeReviewMenu';
import { OwnReviewButton } from './OwnReviewButton';
import { reviewedCodeAction } from './reviewedCode';
import { describeTarget, reviewDiffTarget } from './reviewTarget';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { useCodeReview } from './useCodeReviews';
import { ReviewConversationTab } from './conversation/ReviewConversationTab';
import { openingTab } from './reviewTab';
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
            onChange={(value) => navigation.replacePage({ ...page, tab: value })}
            tabs={[
              { value: 'conversation', label: 'Conversation', icon: <MessageSquare size={14} />, count: review.commentCount },
              { value: 'changes', label: 'Changes', icon: <FileDiff size={14} /> },
            ]}
          />
        </div>
      </Stowable>
      <div className={styles.tabPanel} role="tabpanel" id={tabPanelId(TABS_ID, tab)} aria-labelledby={tabId(TABS_ID, tab)}>
        {tab === 'conversation' ? (
          <ReviewConversationTab review={review} />
        ) : diffTarget ? (
          <DiffPage page={{ kind: 'diff', title: commentLineText(review.title), target: diffTarget, focusPath: page.focusPath, focusLines: page.focusLines }} />
        ) : (
          <EmptyState title="The reviewed changes are not available" description={describeTarget(review.target)} />
        )}
      </div>
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
 * the reviewed code to the workspace, the user's own review, and the page's menu (`reviewPageMenu`), deleting in it.
 */
function ReviewHeader({ review }: { review: CodeReview }) {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  // The review menu's own entry (`codeReviewMenu`), as a button: the reviewer gets the code to run it, in a workspace.
  const reviewedCode = reviewedCodeAction(place, review.target, workspace?.selector);
  const ReviewedCodeIcon = reviewedCode && MENU_WORDS[reviewedCode.word].icon;

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
