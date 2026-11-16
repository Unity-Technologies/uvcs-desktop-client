import { CircleDot, GitPullRequest, RotateCcw } from 'lucide-react';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { Checkbox } from '../../ui/Checkbox';
import { openReview } from '../codeReviews/codeReviewOperations';
import { canMarkReviewed } from './mergeTaskSummary';
import type { TaskMergeChoices, TaskMergeRequest } from './taskMerge';
import styles from './TaskMergeOptions.module.css';

interface TaskMergeOptionsProps {
  /** The merge request the merge was opened from: named first, a link back to it. */
  mergeRequest: TaskMergeRequest | undefined;
  /** The task branch's review, when it has one. */
  review: CodeReviewSummary | undefined;
  /** Who finishes the task, on the place's server. */
  user: string | undefined;
  choices: TaskMergeChoices;
  onChange: (choices: TaskMergeChoices) => void;
}

/** What finishing a task does besides merging it, under the merge page's comment, after the merge request it merges. */
export function TaskMergeOptions({ mergeRequest, review, user, choices, onChange }: TaskMergeOptionsProps) {
  return (
    <div className={styles.options}>
      {mergeRequest && <MergeRequestLink request={mergeRequest} />}
      {canMarkReviewed(review, user) && (
        <span className={styles.review}>
          <Checkbox
            label={`Mark your review as reviewed (“${review.title}”)`}
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

/** "Merge request 12 · Add login", which opens it: the merge finishes it. */
function MergeRequestLink({ request }: { request: TaskMergeRequest }) {
  const name = `Merge request ${request.id} · ${request.title}`;
  return (
    <button type="button" className={styles.request} data-tip="Open the merge request" onClick={() => openReview(request)}>
      <GitPullRequest size={13} aria-hidden />
      <span className={styles.requestName}>{name}</span>
    </button>
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
