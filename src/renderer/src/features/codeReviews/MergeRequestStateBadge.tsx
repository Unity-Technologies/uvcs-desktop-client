import type { MergeRequestState } from '@shared/domain/codeReview';
import { MERGE_REQUEST_STATE_ICONS } from './mergeRequestState';
import styles from './MergeRequestStateBadge.module.css';

/** A merge request's state, its glyph and its name ("Open"), where a review's status badge shows. */
export function MergeRequestStateBadge({ state }: { state: MergeRequestState }) {
  const Icon = MERGE_REQUEST_STATE_ICONS[state];
  return (
    <span className={styles.badge} data-state={state}>
      <Icon size={12} aria-hidden />
      {state}
    </span>
  );
}
