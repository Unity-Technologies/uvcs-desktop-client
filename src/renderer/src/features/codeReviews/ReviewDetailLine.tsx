import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { ReviewStatusIcon } from './ReviewStatusIcon';
import styles from './ReviewDetailLine.module.css';

/**
 * A merge card section's detail; the review's leads with its status's icon ("👍 1 approving review"), the icon a
 * branch's chip shows for it, while the section's disc stays the overall verdict.
 */
export function ReviewDetailLine({ detail, status, className }: { detail: string; status?: CodeReviewStatus; className?: string }) {
  return (
    <p className={`${styles.line} ${className ?? ''}`}>
      {status && <ReviewStatusIcon status={status} size={12} />}
      {detail}
    </p>
  );
}
