import type { MergeRequestState } from '@shared/domain/codeReview';
import { MERGE_REQUEST_STATE_ICONS } from './mergeRequestState';
import styles from './MergeRequestStateBadge.module.css';

interface MergeRequestStateBadgeProps {
  state: MergeRequestState;
  /** For chips next to a name: smaller, as a compact review status badge. */
  compact?: boolean;
  /** Just the glyph, where there is no room for the name. */
  iconOnly?: boolean;
  /** The name goes in a narrow window (the top bar's, below 820px), the glyph staying. */
  nameHidesWhenNarrow?: boolean;
}

/**
 * A merge request's state, its glyph and its name ("Open") in a pill of its color: how a state shows everywhere (the
 * page, the lists, a branch's chip, the top bar, the summary card; the Branch Explorer draws the same, `drawReviewChip`).
 */
export function MergeRequestStateBadge({ state, compact = false, iconOnly = false, nameHidesWhenNarrow = false }: MergeRequestStateBadgeProps) {
  const Icon = MERGE_REQUEST_STATE_ICONS[state];
  return (
    <span className={styles.badge} data-state={state} data-compact={compact} data-icon-only={iconOnly} data-narrow-icon-only={nameHidesWhenNarrow || undefined} role={iconOnly ? 'img' : undefined} aria-label={iconOnly ? state : undefined}>
      <Icon size={12} aria-hidden />
      {!iconOnly && <span className={styles.name}>{state}</span>}
    </span>
  );
}
