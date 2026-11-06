import { Eye, Flag, ThumbsUp, type LucideIcon } from 'lucide-react';
import type { CodeReviewStatus } from '@shared/domain/codeReview';
import styles from './ReviewStatusIcon.module.css';

/**
 * Each review status's icon, wherever a status shows: an eye while under review, a flag when rework is required, a
 * thumbs-up once reviewed (the official client's, which its users already read).
 */
export const REVIEW_STATUS_ICONS: Record<CodeReviewStatus, LucideIcon> = {
  'Under review': Eye,
  'Rework required': Flag,
  Reviewed: ThumbsUp,
};

interface ReviewStatusIconProps {
  status: CodeReviewStatus;
  size?: number;
  /** Named for a screen reader where the icon stands alone; hidden where the status is written beside it. */
  label?: string;
}

/** A status's icon in its color. */
export function ReviewStatusIcon({ status, size = 14, label }: ReviewStatusIconProps) {
  const Icon = REVIEW_STATUS_ICONS[status];
  return (
    <span className={styles.icon} data-status={status} role={label ? 'img' : undefined} aria-label={label} data-tip={label} aria-hidden={label ? undefined : true}>
      <Icon size={size} />
    </span>
  );
}
