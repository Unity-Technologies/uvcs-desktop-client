import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { REVIEW_STATUS_ICONS } from './reviewStatusIcons';
import styles from './ReviewStatusIcon.module.css';

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
