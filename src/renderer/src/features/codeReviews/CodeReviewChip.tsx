import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { openReview } from './codeReviewOperations';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { MERGE_REQUEST_STATE_ICONS } from './mergeRequestState';
import { reviewChipOf } from './reviewChip';
import styles from './CodeReviewStatusBadge.module.css';
import stateStyles from './MergeRequestStateIcon.module.css';

/**
 * A small chip for a row whose branch has a code review or a merge request (`reviewChipOf`): the request's state, then
 * the review's status; clicking it opens the review. `iconOnly` where room is short.
 */
export function CodeReviewChip({ review, iconOnly = false }: { review: CodeReviewSummary; iconOnly?: boolean }) {
  const chip = reviewChipOf(review, iconOnly);
  const StateIcon = chip.state && MERGE_REQUEST_STATE_ICONS[chip.state];
  return (
    <button
      type="button"
      className={styles.chip}
      data-tip={chip.tip}
      data-tip-sub={chip.tipSub}
      aria-label={chip.label}
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        openReview(review);
      }}
    >
      {StateIcon && (
        <span className={`${stateStyles.icon} ${styles.chipState}`} data-state={chip.state} aria-hidden>
          <StateIcon size={12} />
        </span>
      )}
      {chip.status && <CodeReviewStatusBadge status={chip.status} compact iconOnly={!chip.statusText} />}
    </button>
  );
}
