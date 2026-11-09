import { MessageSquare } from 'lucide-react';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import { pluralize } from '../../../lib/text';
import type { EntryFlag } from '../../diff/entryFlag';
import type { ReviewThread } from '../conversation/reviewThreads';
import { fileThreadCount } from './fileAnnotation';
import { anchorPath, isLineThread, reviewDiffViewOf } from './fileThreads';

/**
 * The review's files with comments, in the Changes tab's list (`EntryFlagContext`): a comment icon by each one's status
 * letter, how many threads it holds in the diff shown in its tooltip, and a "Commented" chip showing only them. The
 * threads are gathered by their file once per diff, so a list of thousands of files reads each thread a few times, not
 * once per row.
 */
export function reviewFileFlag(threads: readonly ReviewThread[], review: CodeReviewTarget): EntryFlag {
  return {
    icon: MessageSquare,
    filterLabel: 'Commented',
    markOf: (target) => {
      const view = reviewDiffViewOf(review, target);
      const byPath = threadsByPath(threads);
      return (entry) => {
        const candidates = [...(byPath.get(entry.path) ?? []), ...(entry.oldPath === undefined || entry.oldPath === entry.path ? [] : (byPath.get(entry.oldPath) ?? []))];
        const count = candidates.length === 0 ? 0 : fileThreadCount(candidates, review, view, entry);
        return count > 0 ? pluralize(count, 'comment') : null;
      };
    },
  };
}

/** The threads on lines, by the path they name as a diff names its files (`anchorPath`). */
function threadsByPath(threads: readonly ReviewThread[]): Map<string, ReviewThread[]> {
  const byPath = new Map<string, ReviewThread[]>();
  for (const thread of threads) {
    if (!isLineThread(thread)) continue;
    const path = anchorPath(thread.root.anchor);
    const onPath = byPath.get(path);
    if (onPath) onPath.push(thread);
    else byPath.set(path, [thread]);
  }
  return byPath;
}
