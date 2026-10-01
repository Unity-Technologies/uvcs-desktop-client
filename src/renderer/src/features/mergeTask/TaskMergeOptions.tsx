import { CircleDot, RotateCcw } from 'lucide-react';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { Checkbox } from '../../ui/Checkbox';
import { openReview } from '../codeReviews/codeReviewOperations';
import { canMarkReviewed } from './mergeTaskSummary';
import type { TaskMergeChoices } from './taskMerge';
import styles from './TaskMergeOptions.module.css';

interface TaskMergeOptionsProps {
  /** The task branch's review, when it has one. */
  review: CodeReviewSummary | undefined;
  choices: TaskMergeChoices;
  onChange: (choices: TaskMergeChoices) => void;
}

/** What finishing a task does besides merging it, under the merge page's comment. */
export function TaskMergeOptions({ review, choices, onChange }: TaskMergeOptionsProps) {
  return (
    <div className={styles.options}>
      {canMarkReviewed(review) && (
        <span className={styles.review}>
          <Checkbox
            label={`Mark the code review as reviewed (“${review.title}”)`}
            checked={choices.markReviewed}
            onChange={(markReviewed) => onChange({ ...choices, markReviewed })}
          />
          <ReviewStatusLink review={review} />
        </span>
      )}
      <Checkbox label="Hide the branch afterwards" checked={choices.hideBranch} onChange={(hideBranch) => onChange({ ...choices, hideBranch })} />
    </div>
  );
}

/** Where the review stands, as it isn't finished yet: in the conflict tone when it asks for rework. */
function ReviewStatusLink({ review }: { review: CodeReviewSummary }) {
  const rework = review.status === 'Rework required';
  return (
    <button type="button" className={styles.status} data-rework={rework} data-tip="Open the code review" onClick={() => openReview(review)}>
      {rework ? <RotateCcw size={12} /> : <CircleDot size={12} />}
      {review.status}
    </button>
  );
}
