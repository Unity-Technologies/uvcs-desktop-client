import * as Popover from '@radix-ui/react-popover';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { branchWorkedOn } from '../../components/workingObject';
import { useHoverCard } from '../../lib/useHoverCard';
import { Button } from '../../ui/Button';
import { branchReviewsQuery } from './changeRequests/useChangeRequests';
import { openReview } from './codeReviewOperations';
import { reviewConversationQuery } from './conversation/useReviewConversation';
import { openItemsOfConversation } from './mergeCard';
import { asksForBranchReviews, cardReadsOpenItems, mergeRequestChipOf, type TopBarRequestAction } from './mergeRequestChipState';
import type { MergeRequestReview } from './mergeRequestState';
import { MergeRequestStateBadge } from './MergeRequestStateBadge';
import { MergeRequestSummaryCard } from './MergeRequestSummaryCard';
import { currentRequestOf } from './reviewsByBranch';
import { ReviewStatusIcon } from './ReviewStatusIcon';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import styles from './MergeRequestChip.module.css';
import { openMergeRequestMerge } from '../mergeTask/mergeTaskOperations';

/**
 * A segment of the branch pill when the workspace's branch has a merge request (`currentRequestOf`): its state and,
 * while Open, its review's status. Hovering shows where it stands; a click opens it. The branch's reviews
 * are one `cm find review` (`branchReviewsQuery`), the read Changes makes for the change requests a check-in applies,
 * asked once the first screen is in (the pending changes, which the sidebar's count reads in any view).
 */
export function MergeRequestChip() {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const branch = branchWorkedOn(workspace?.selector);
  const { isPending: firstScreenPending } = usePendingChanges();
  const { data: reviews } = useQuery({ ...branchReviewsQuery(place, branch ?? ''), enabled: asksForBranchReviews(workspace?.selector, !firstScreenPending) });
  const request = branch === undefined || !reviews ? undefined : currentRequestOf(reviews);
  if (!request || branch === undefined) return null;
  return <MergeRequestSegment request={request} source={branch} />;
}

function MergeRequestSegment({ request, source }: { request: MergeRequestReview; source: string }) {
  const place = usePlace();
  const card = useHoverCard();
  const { data: conversation } = useQuery({ ...reviewConversationQuery(place, request.id), ...SLOW_CHANGING_QUERY, enabled: cardReadsOpenItems(request, card.open) });
  const open = useMemo(() => (conversation ? openItemsOfConversation(conversation.comments) : undefined), [conversation]);
  const chip = mergeRequestChipOf(request, open, source);

  const openIt = (): void => {
    card.close();
    openReview(request);
  };
  const run = (action: TopBarRequestAction): void => {
    card.close();
    openMergeRequestMerge(action.merge.request, action.merge.source);
  };

  return (
    <Popover.Root open={card.open} onOpenChange={(next) => !next && card.close()}>
      <Popover.Trigger asChild>
        <button type="button" className={styles.chip} aria-label={chip.label} {...card.hoverProps} onClick={openIt}>
          <MergeRequestStateBadge state={chip.state} compact nameHidesWhenNarrow />
          {chip.status && <ReviewStatusIcon status={chip.status} size={13} />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.card} align="start" sideOffset={6} {...card.hoverProps} onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()}>
          <div className={styles.summary}>
            <MergeRequestSummaryCard request={request} onOpen={openIt}>
              {chip.card.openItems && <p className={styles.openItems}>{chip.card.openItems}</p>}
            </MergeRequestSummaryCard>
          </div>
          {chip.card.actions.length > 0 && (
            <footer className={styles.footer}>
              {chip.card.actions.map((action) => (
                <Button key={action.kind} size="small" variant={action.primary ? 'primary' : 'secondary'} onClick={() => run(action)}>
                  {action.label}
                </Button>
              ))}
            </footer>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
