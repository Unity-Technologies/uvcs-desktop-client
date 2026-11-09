import { MessageSquare } from 'lucide-react';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import { pluralize } from '../../../lib/text';
import type { EntryFlag } from '../../diff/entryFlag';
import type { ReviewThread } from '../conversation/reviewThreads';
import { fileThreadCount } from './fileAnnotation';
import { reviewDiffViewOf } from './fileThreads';

/**
 * The review's files with comments, in the Changes tab's list (`EntryFlagContext`): a comment icon by each one's status
 * letter, how many threads it holds in the diff shown in its tooltip, and a "Commented" chip showing only them.
 */
export function reviewFileFlag(threads: readonly ReviewThread[], review: CodeReviewTarget): EntryFlag {
  return {
    icon: MessageSquare,
    filterLabel: 'Commented',
    markOf: (target) => {
      const view = reviewDiffViewOf(review, target);
      return (entry) => {
        const count = fileThreadCount(threads, review, view, entry);
        return count > 0 ? pluralize(count, 'comment') : null;
      };
    },
  };
}
