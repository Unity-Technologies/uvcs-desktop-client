import { CheckCircle2, CircleDot, RotateCcw } from 'lucide-react';
import type { CodeReviewStatus } from '@shared/domain/codeReview';
import styles from './CodeReviewStatusBadge.module.css';

const ICONS: Record<CodeReviewStatus, React.ReactNode> = {
  'Under review': <CircleDot size={12} />,
  Reviewed: <CheckCircle2 size={12} />,
  'Rework required': <RotateCcw size={12} />,
};

export function CodeReviewStatusBadge({ status }: { status: CodeReviewStatus }) {
  return (
    <span className={styles.badge} data-status={status}>
      {ICONS[status]}
      {status}
    </span>
  );
}
