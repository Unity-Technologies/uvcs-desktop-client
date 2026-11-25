import { useQuery } from '@tanstack/react-query';
import { GitPullRequestPlus } from '../../components/GitPullRequestPlus';
import type { BranchInfo } from '@shared/domain/branch';
import { usePlace } from '../../app/workspace/useWorkspace';
import { useSettled } from '../../lib/useSettled';
import { DetailsEmpty, DetailsSection, DetailsSectionAction, DetailsSkeleton } from '../../ui/DetailsSection';
import { openReview } from '../codeReviews/codeReviewOperations';
import { openCreateMergeRequestDialog } from '../codeReviews/CreateMergeRequestDialog';
import { MergeRequestSummaryCard } from '../codeReviews/MergeRequestSummaryCard';
import { branchReviewQuery } from '../codeReviews/useBranchReviews';
import { branchMergeRequestSectionOf } from './branchMergeRequestSection';

/**
 * A branch's merge request in its details (docs/features/merge-requests.md "A branch's merge request at a glance"): its
 * summary card, or "No merge request" with New at the title's right, as Attributes has Add (`branchMergeRequestSectionOf`).
 */
export function MergeRequestDetailsSection({ branch }: { branch: BranchInfo }) {
  const place = usePlace();
  // The review its chip shows, read with the branches in view (`branchReviewQuery`); its error too, to hide on a failure.
  const read = useQuery({ ...branchReviewQuery(place, branch.id), enabled: useSettled() });
  const section = branchMergeRequestSectionOf(branch, read.data, { failed: read.isError });
  if (section.body === 'hidden') return null;
  const action = section.canCreate && (
    <DetailsSectionAction icon={<GitPullRequestPlus size={12} />} aria-label="New merge request" onClick={() => openCreateMergeRequestDialog(place, branch)}>
      New
    </DetailsSectionAction>
  );
  return (
    <DetailsSection title="Merge request" action={action}>
      {section.body === 'reading' && <DetailsSkeleton rows={1} />}
      {section.body === 'none' && <DetailsEmpty>{section.text}</DetailsEmpty>}
      {section.body === 'card' && <MergeRequestSummaryCard request={section.request} onOpen={() => openReview(section.request)} />}
    </DetailsSection>
  );
}
