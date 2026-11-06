import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { SHORT_STATUS } from './reviewsByBranch';
import { REVIEW_STATUS_ICONS } from './reviewStatusIcons';
import styles from './CodeReviewStatusBadge.module.css';

interface CodeReviewStatusBadgeProps {
  status: CodeReviewStatus;
  /** For chips next to a name: smaller, with a short status. */
  compact?: boolean;
  /** Just the icon, where there is no room for the status. */
  iconOnly?: boolean;
}

export function CodeReviewStatusBadge({ status, compact = false, iconOnly = false }: CodeReviewStatusBadgeProps) {
  const Icon = REVIEW_STATUS_ICONS[status];
  return (
    <span className={styles.badge} data-status={status} data-compact={compact} data-icon-only={iconOnly} aria-label={iconOnly ? status : undefined}>
      <Icon size={12} aria-hidden />
      {!iconOnly && (compact ? SHORT_STATUS[status] : status)}
    </span>
  );
}
