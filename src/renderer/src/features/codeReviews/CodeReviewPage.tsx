import { Trash2, UserPlus } from 'lucide-react';
import { CODE_REVIEW_STATUSES, type CodeReview, type CodeReviewStatus } from '@shared/domain/codeReview';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { MENU_WORDS } from '../../components/menuWords';
import { PathLabel } from '../../components/PathLabel';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { RelativeTime } from '../../ui/RelativeTime';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SkeletonBar } from '../../ui/Skeleton';
import { DiffPage } from '../diff/DiffPage';
import { deleteReviews, reassignReview, setReviewStatus } from './codeReviewOperations';
import { reviewedCodeAction } from './reviewedCode';
import { describeTarget, reviewDiffTarget } from './reviewTarget';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { useCodeReview } from './useCodeReviews';
import styles from './CodeReviewPage.module.css';

const COMMENTS_HINT = 'Comments are available in the Unity Version Control web dashboard.';

/** A code review: who reviews what, its status, and the changes to review. */
export function CodeReviewPage({ page }: PageProps<'codeReview'>) {
  const { data: review, isLoading, error } = useCodeReview(page.reviewId);

  // Not in a list already read (opened from a branch chip, the palette, a link): the page's frame, its header a skeleton.
  if (isLoading) {
    return (
      <div className={styles.page}>
        <ReviewHeaderSkeleton />
        <div className={styles.changes} />
      </div>
    );
  }
  if (error || !review) return <EmptyState title="Couldn't open the code review" description={error?.message} />;

  const diffTarget = reviewDiffTarget(review.target);
  return (
    <div className={styles.page}>
      <ReviewHeader review={review} />
      <div className={styles.changes}>
        {diffTarget ? (
          <DiffPage page={{ kind: 'diff', title: review.title, target: diffTarget, focusPath: page.focusPath }} />
        ) : (
          <EmptyState title="The reviewed changes are not available" description={describeTarget(review.target)} />
        )}
      </div>
    </div>
  );
}

/** The review's header while it's read: its three rows at their heights, a placeholder where each one's words go. */
function ReviewHeaderSkeleton() {
  return (
    <header className={styles.header} aria-busy="true" aria-label="Loading">
      <div className={`${styles.titleRow} ${styles.placeholderTitle}`}>
        <SkeletonBar width="320px" />
      </div>
      <div className={`${styles.meta} ${styles.placeholderMeta}`}>
        <SkeletonBar width="420px" />
      </div>
      <div className={`${styles.actions} ${styles.placeholderActions}`}>
        <SkeletonBar width="260px" />
      </div>
    </header>
  );
}

function ReviewHeader({ review }: { review: CodeReview }) {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  // The review menu's own entry (`codeReviewMenu`), as a button: the reviewer gets the code to run it.
  const reviewedCode = reviewedCodeAction(workspacePath, review.target, workspace?.selector);
  const ReviewedCodeIcon = reviewedCode && MENU_WORDS[reviewedCode.word].icon;

  const remove = async (): Promise<void> => {
    if (await deleteReviews(workspacePath, [review])) navigation.goBack();
  };

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={`${styles.title} selectable`}>
          {review.title} <span className={styles.id}>#{review.id}</span>
        </h1>
        <CodeReviewStatusBadge status={review.status} />
      </div>
      <div className={styles.meta}>
        <UserLabel user={review.owner} />
        <span>wants a review of</span>
        {/* A branch fitted to the row as every branch shown on its own is (`PathLabel`), whole in its tooltip. */}
        <span className={styles.target}>{review.target.kind === 'branch' ? <PathLabel path={review.target.branch} fitContent /> : describeTarget(review.target)}</span>
        <span className={styles.dot}>·</span>
        <RelativeTime date={review.date} />
        <span className={styles.dot}>·</span>
        {review.assignee ? (
          <>
            <span>Reviewer</span>
            <UserLabel user={review.assignee} />
          </>
        ) : (
          <span className={styles.unassigned}>No reviewer yet</span>
        )}
      </div>
      <div className={styles.actions}>
        <SegmentedControl<CodeReviewStatus>
          value={review.status}
          onChange={(status) => void setReviewStatus(workspacePath, review, status)}
          segments={CODE_REVIEW_STATUSES.map((status) => ({ value: status, label: status }))}
        />
        <div className={styles.spacer} />
        <span className={styles.hint} data-tip={COMMENTS_HINT}>
          {COMMENTS_HINT}
        </span>
        {reviewedCode && ReviewedCodeIcon && (
          <Button
            icon={<ReviewedCodeIcon size={14} />}
            disabled={reviewedCode.disabledReason !== undefined}
            data-tip={reviewedCode.disabledReason}
            onClick={() => void reviewedCode.run()}
          >
            {reviewedCode.label}
          </Button>
        )}
        <Button icon={<UserPlus size={14} />} onClick={() => void reassignReview(workspacePath, review)}>
          Assign
        </Button>
        <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => void remove()}>
          Delete
        </Button>
      </div>
    </header>
  );
}
