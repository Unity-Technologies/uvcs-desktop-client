import { Trash2, UserPlus } from 'lucide-react';
import { CODE_REVIEW_STATUSES, type CodeReview, type CodeReviewStatus } from '@shared/domain/codeReview';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { RelativeTime } from '../../ui/RelativeTime';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { CenteredSpinner } from '../../ui/Spinner';
import { DiffPage } from '../diff/DiffPage';
import { deleteReviews, reassignReview, setReviewStatus } from './codeReviewOperations';
import { describeTarget, reviewDiffTarget } from './reviewTarget';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { useCodeReview } from './useCodeReviews';
import styles from './CodeReviewPage.module.css';

/** A code review: who reviews what, its status, and the changes to review. */
export function CodeReviewPage({ page }: PageProps<'codeReview'>) {
  const { data: review, isLoading, error } = useCodeReview(page.reviewId);

  if (isLoading) return <CenteredSpinner />;
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

function ReviewHeader({ review }: { review: CodeReview }) {
  const workspacePath = useWorkspacePath();

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
        <span className={styles.target}>{describeTarget(review.target)}</span>
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
        <span className={styles.hint}>Comments are available in the Unity Version Control web dashboard.</span>
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
