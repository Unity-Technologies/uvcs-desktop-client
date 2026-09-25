import { CheckCircle2, CircleDot, RotateCcw } from 'lucide-react';
import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { SHORT_STATUS } from './reviewsByBranch';
import styles from './CodeReviewStatusBadge.module.css';

const ICONS: Record<CodeReviewStatus, React.ReactNode> = {
  'Under review': <CircleDot size={12} />,
  Reviewed: <CheckCircle2 size={12} />,
  'Rework required': <RotateCcw size={12} />,
};

interface CodeReviewStatusBadgeProps {
  status: CodeReviewStatus;
  /** For chips next to a name: smaller, with a short status. */
  compact?: boolean;
  /** Just the icon, where there is no room for the status. */
  iconOnly?: boolean;
}

export function CodeReviewStatusBadge({ status, compact = false, iconOnly = false }: CodeReviewStatusBadgeProps) {
  return (
    <span className={styles.badge} data-status={status} data-compact={compact} data-icon-only={iconOnly} aria-label={iconOnly ? status : undefined}>
      {ICONS[status]}
      {!iconOnly && (compact ? SHORT_STATUS[status] : status)}
    </span>
  );
}
