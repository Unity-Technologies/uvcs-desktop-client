import { useQuery } from '@tanstack/react-query';
import { GitMerge } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePlace } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { branchReviewsQuery } from '../codeReviews/changeRequests/useChangeRequests';
import { openReview } from '../codeReviews/codeReviewOperations';
import type { TaskMergeRequest } from '../mergeTask/taskMerge';
import { mergeRequestInto, mergeRuleNotice, type MergeRuleRefusal } from './mergeRuleRefusal';

interface MergeRuleRefusedProps {
  refusal: MergeRuleRefusal;
  /** The merge request the merge was opened from, when it was: no need to look for the branch's. */
  openedFrom: TaskMergeRequest | undefined;
  /** Previewing the merge again, once the rule may hold. */
  retry: ReactNode;
}

/**
 * The merge page when the server's merge rules refuse the merge: the rule in a plain sentence, and the way forward.
 * Only a review rule looks for the branch's merge request, and only when the merge wasn't opened from it: the branch's
 * reviews, the read Changes makes.
 */
export function MergeRuleRefused({ refusal, openedFrom, retry }: MergeRuleRefusedProps) {
  const place = usePlace();
  const looksForRequest = refusal.rule === 'needsReview' && openedFrom === undefined;
  const { data: reviewsOfBranch } = useQuery({ ...branchReviewsQuery(place, refusal.source), enabled: looksForRequest });
  const notice = mergeRuleNotice(refusal, openedFrom?.id ?? mergeRequestInto(reviewsOfBranch, refusal.destination));
  const { action } = notice;

  return (
    <EmptyState
      icon={<GitMerge size={22} />}
      title={notice.title}
      action={
        <>
          {action && (
            <Button variant="primary" onClick={() => openReview({ id: action.reviewId })}>
              {action.label}
            </Button>
          )}
          {retry}
        </>
      }
    />
  );
}
