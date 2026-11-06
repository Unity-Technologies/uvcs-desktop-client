import { Eye, Flag, ThumbsUp, type LucideIcon } from 'lucide-react';
import type { CodeReviewStatus } from '@shared/domain/codeReview';

/**
 * Each review status's icon, wherever a status shows (its badge, `CodeReviewStatusBadge`; a reviewer's corner in a
 * stack): an eye while under review, a flag when rework is required, a thumbs-up once reviewed (the official
 * client's, which its users already read).
 */
export const REVIEW_STATUS_ICONS: Record<CodeReviewStatus, LucideIcon> = {
  'Under review': Eye,
  'Rework required': Flag,
  Reviewed: ThumbsUp,
};

/** Each review status's color, for an inline style: the same tokens `CodeReviewStatusBadge.module.css` reads. */
export const REVIEW_STATUS_COLORS: Record<CodeReviewStatus, string> = {
  'Under review': 'var(--status-moved)',
  'Rework required': 'var(--status-changed)',
  Reviewed: 'var(--status-added)',
};
