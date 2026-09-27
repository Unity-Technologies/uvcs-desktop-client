import { CircleDot, ExternalLink, Trash2, UserPlus } from 'lucide-react';
import { CODE_REVIEW_STATUSES, type CodeReviewSummary } from '@shared/domain/codeReview';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { deleteReviews, openReview, reassignReview, setReviewStatus } from './codeReviewOperations';

export function codeReviewMenu(workspacePath: string, reviews: CodeReviewSummary[]): MenuEntry[] {
  const single = reviews.length === 1 ? reviews[0]! : null;

  return groupedMenu({
    primary: [single && { id: 'open', label: 'Open review', icon: ExternalLink, run: () => openReview(single) }],
    act: [
      single && {
        label: 'Set status',
        icon: CircleDot,
        entries: CODE_REVIEW_STATUSES.map((status) => ({
          id: `status.${status}`,
          label: status,
          disabled: status === single.status,
          run: () => void setReviewStatus(workspacePath, single, status),
        })),
      },
      single && { id: 'assign', label: 'Assign reviewer…', icon: UserPlus, run: () => void reassignReview(workspacePath, single) },
    ],
    danger: [
      {
        id: 'delete',
        label: reviews.length === 1 ? 'Delete review…' : `Delete ${reviews.length} reviews…`,
        icon: Trash2,
        danger: true,
        run: () => void deleteReviews(workspacePath, reviews),
      },
    ],
  });
}
