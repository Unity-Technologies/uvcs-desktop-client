import { useQuery } from '@tanstack/react-query';
import { GitMerge } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePlace } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { branchReviewsQuery } from '../codeReviews/changeRequests/useChangeRequests';
import { openReview } from '../codeReviews/codeReviewOperations';
import { openCreateMergeRequestDialog } from '../codeReviews/CreateMergeRequestDialog';
import type { TaskMergeRequest } from '../mergeTask/taskMerge';
import { mergeRuleNotice, needsBranchReviews, type MergeRuleRefusal } from './mergeRuleRefusal';

interface MergeRuleRefusedProps {
  refusal: MergeRuleRefusal;
  /** The merge request the merge was opened from, when it was: no need to look for the branch's. */
  openedFrom: TaskMergeRequest | undefined;
  /** Previewing the merge again, once the rule may hold. */
  retry: ReactNode;
}

/**
 * The merge page when the server's merge rules refuse the merge: the rule in a plain sentence, and the way forward
 * (`mergeRuleNotice`). The branch's reviews, the read Changes makes, only when `needsBranchReviews`.
 */
export function MergeRuleRefused({ refusal, openedFrom, retry }: MergeRuleRefusedProps) {
  const place = usePlace();
  const { data: reviewsOfBranch } = useQuery({ ...branchReviewsQuery(place, refusal.source), enabled: needsBranchReviews(refusal, openedFrom) });
  const notice = mergeRuleNotice(refusal, openedFrom, reviewsOfBranch);
  const { action } = notice;

  return (
    <EmptyState
      icon={<GitMerge size={22} />}
      title={notice.title}
      action={
        <>
          {action && (
            <Button variant="primary" onClick={() => (action.kind === 'openMergeRequest' ? openReview({ id: action.reviewId }) : openCreateMergeRequestDialog(place, action.branch))}>
              {action.label}
            </Button>
          )}
          {retry}
        </>
      }
    />
  );
}
