import { MessageSquare } from 'lucide-react';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { commentCountsText } from './commentCounts';
import styles from './ReviewCommentCounts.module.css';

/** A review's comments in a row: how many, and how many are still open (change requests to apply, questions to answer). */
export function ReviewCommentCounts({ review }: { review: Pick<CodeReviewSummary, 'commentCount' | 'openIssueCount'> }) {
  const text = commentCountsText(review);
  return (
    <span className={styles.counts} data-tip={text} aria-label={text}>
      <span className={styles.comments} data-none={review.commentCount === 0}>
        <MessageSquare size={13} aria-hidden />
        {review.commentCount}
      </span>
      {review.openIssueCount > 0 && <span className={styles.open}>{review.openIssueCount} open</span>}
    </span>
  );
}
