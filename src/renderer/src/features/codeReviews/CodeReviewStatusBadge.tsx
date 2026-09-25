import { CheckCircle2, CircleDot, RotateCcw } from 'lucide-react';
import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { SHORT_STATUS } from './reviewsByBranch';
import styles from './CodeReviewStatusBadge.module.css';

const ICONS: Record<CodeReviewStatus, React.ReactNode> = {
  'Under review': <CircleDot size={12} />,
  Reviewed: <CheckCircle2 size={12} />,
  'Rework required': <RotateCcw size={12} />,
};

/** `compact` is for chips next to a name: smaller, with a short status. */
export function CodeReviewStatusBadge({ status, compact = false }: { status: CodeReviewStatus; compact?: boolean }) {
  return (
    <span className={styles.badge} data-status={status} data-compact={compact}>
      {ICONS[status]}
      {compact ? SHORT_STATUS[status] : status}
    </span>
  );
}
