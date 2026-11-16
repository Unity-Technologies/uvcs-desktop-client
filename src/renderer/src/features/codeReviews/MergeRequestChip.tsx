import * as Popover from '@radix-ui/react-popover';
import { useQuery } from '@tanstack/react-query';
import { useMemo, type SyntheticEvent } from 'react';
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
import { MergeVerdictIcon } from './MergeVerdictIcon';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import styles from './MergeRequestChip.module.css';
import { openMergeRequestMerge } from '../mergeTask/mergeTaskOperations';

/** The workspace's branch's merge request, as the top bar shows it, and the branch it merges from. */
export interface WorkspaceMergeRequest {
  request: MergeRequestReview;
  source: string;
}

/**
 * The merge request of the workspace's branch (`currentRequestOf`), none while it's read or when there is none. The
 * branch's reviews are one `cm find review` (`branchReviewsQuery`), the read Changes makes for the change requests a
 * check-in applies, asked once the first screen is in (the pending changes, which the sidebar's count reads in any view).
 */
export function useWorkspaceMergeRequest(): WorkspaceMergeRequest | undefined {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const branch = branchWorkedOn(workspace?.selector);
  const { isPending: firstScreenPending } = usePendingChanges();
  const { data: reviews } = useQuery({ ...branchReviewsQuery(place, branch ?? ''), enabled: asksForBranchReviews(workspace?.selector, !firstScreenPending) });
  const request = branch === undefined || !reviews ? undefined : currentRequestOf(reviews);
  return request && branch !== undefined ? { request, source: branch } : undefined;
}

/**
 * The workspace's branch's merge request in the branch pill, after the name, as a branch's chip shows it in the
 * Branches view: its state and, while Open, its verdict. Hovering shows where it stands, what's still open and, once
 * reviewed, Merge into main…; a click opens it. Inside the pill, itself the switcher's button, it is a span, and no
 * click on it or its card reaches the pill (it would open the switcher).
 */
export function MergeRequestChip({ request, source }: WorkspaceMergeRequest) {
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
        <span
          className={styles.chip}
          role="img"
          aria-label={chip.label}
          // The pill's own tooltip names the branch: none over the chip, whose card says more.
          data-tip=""
          {...card.hoverProps}
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={(event) => {
            event.stopPropagation();
            openIt();
          }}
        >
          <MergeRequestStateBadge state={chip.state} compact nameHidesWhenNarrow />
          {chip.verdict && <MergeVerdictIcon verdict={chip.verdict} />}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.card} align="start" sideOffset={6} {...card.hoverProps} onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()} onPointerDown={stop} onMouseDown={stop} onClick={stop}>
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

/** React carries the card's events, and the chip's, up to the pill: none of them may open the switcher. */
function stop(event: SyntheticEvent): void {
  event.stopPropagation();
}
