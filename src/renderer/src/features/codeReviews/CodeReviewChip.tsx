import type { CodeReview } from '@shared/domain/codeReview';
import { openReview } from './codeReviewOperations';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import styles from './CodeReviewStatusBadge.module.css';

/** A small status chip for a row that has a code review; clicking it opens the review. */
export function CodeReviewChip({ review }: { review: CodeReview }) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-tip={review.title}
      data-tip-sub={`Code review ${review.id} · ${review.status} · click to open`}
      aria-label={`Open code review ${review.id}: ${review.title}`}
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        openReview(review);
      }}
    >
      <CodeReviewStatusBadge status={review.status} compact />
    </button>
  );
}
