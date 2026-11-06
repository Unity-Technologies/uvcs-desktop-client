import { Eye, Flag, ThumbsUp, type LucideIcon } from 'lucide-react';
import type { CodeReviewStatus } from '@shared/domain/codeReview';

/**
 * Each review status's icon, wherever a status shows as one: an eye while under review, a flag when rework is
 * required, a thumbs-up once reviewed (the official client's, which its users already read).
 */
export const REVIEW_STATUS_ICONS: Record<CodeReviewStatus, LucideIcon> = {
  'Under review': Eye,
  'Rework required': Flag,
  Reviewed: ThumbsUp,
};

/** Each review status's color, as `CodeReviewStatusBadge` shows it. */
export const REVIEW_STATUS_COLORS: Record<CodeReviewStatus, string> = {
  'Under review': 'var(--status-moved)',
  'Rework required': 'var(--status-changed)',
  Reviewed: 'var(--status-added)',
};
