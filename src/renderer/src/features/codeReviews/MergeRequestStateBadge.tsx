import type { MergeRequestState } from '@shared/domain/codeReview';
import { MERGE_REQUEST_STATE_ICONS } from './mergeRequestState';
import styles from './MergeRequestStateBadge.module.css';

interface MergeRequestStateBadgeProps {
  state: MergeRequestState;
  /** For chips next to a name: smaller, as a compact review status badge. */
  compact?: boolean;
  /** Just the glyph, where there is no room for the name. */
  iconOnly?: boolean;
}

/** A merge request's state, its glyph and its name ("Open"), where a review's status badge shows. */
export function MergeRequestStateBadge({ state, compact = false, iconOnly = false }: MergeRequestStateBadgeProps) {
  const Icon = MERGE_REQUEST_STATE_ICONS[state];
  return (
    <span className={styles.badge} data-state={state} data-compact={compact} data-icon-only={iconOnly} aria-label={iconOnly ? state : undefined}>
      <Icon size={12} aria-hidden />
      {!iconOnly && state}
    </span>
  );
}
