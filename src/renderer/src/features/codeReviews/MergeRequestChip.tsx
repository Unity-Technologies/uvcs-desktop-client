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
import { asksForBranchReviews, cardReadsOpenItems, mergeRequestChipOf, topBarRequestOf, type TopBarRequestAction, type MergeRequestReview } from './mergeRequestChipState';
import { MERGE_REQUEST_STATE_ICONS } from './mergeRequestState';
import { ReviewerStack } from './ReviewerStack';
import { ReviewStatusIcon } from './ReviewStatusIcon';
import { usePendingChanges } from '../pendingChanges/usePendingChanges';
import stateColors from './mergeRequestStateColors.module.css';
import styles from './MergeRequestChip.module.css';

/**
 * A segment of the branch pill when the workspace's branch has a merge request (`topBarRequestOf`): its state, its
 * number and, while Open, its review's status. Hovering shows where it stands; a click opens it. The branch's reviews
 * are one `cm find review` (`branchReviewsQuery`), the read Changes makes for the change requests a check-in applies,
 * asked once the first screen is in (the pending changes, which the sidebar's count reads in any view).
 */
export function MergeRequestChip() {
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const branch = branchWorkedOn(workspace?.selector);
  const { isPending: firstScreenPending } = usePendingChanges();
  const { data: reviews } = useQuery({ ...branchReviewsQuery(place, branch ?? ''), enabled: asksForBranchReviews(workspace?.selector, !firstScreenPending) });
  const request = branch === undefined || !reviews ? undefined : topBarRequestOf(reviews);
  if (!request) return null;
  return <MergeRequestSegment request={request} />;
}

function MergeRequestSegment({ request }: { request: MergeRequestReview }) {
  const place = usePlace();
  const card = useHoverCard();
  const { data: conversation } = useQuery({ ...reviewConversationQuery(place, request.id), ...SLOW_CHANGING_QUERY, enabled: cardReadsOpenItems(request, card.open) });
  const open = useMemo(() => (conversation ? openItemsOfConversation(conversation.comments) : undefined), [conversation]);
  const chip = mergeRequestChipOf(request, open);
  const StateIcon = MERGE_REQUEST_STATE_ICONS[chip.state];

  const openIt = (): void => {
    card.close();
    openReview(request);
  };
  const run = (action: TopBarRequestAction): void => {
    switch (action.kind) {
      case 'open':
        openIt();
        return;
    }
  };

  return (
    <Popover.Root open={card.open} onOpenChange={(next) => !next && card.close()}>
      <Popover.Trigger asChild>
        <button type="button" className={styles.chip} data-muted={chip.muted || undefined} aria-label={chip.label} {...card.hoverProps} onClick={openIt}>
          <span className={`${styles.state} ${stateColors.stateColor}`} data-state={chip.state} aria-hidden>
            <StateIcon size={14} />
          </span>
          <span className={styles.number}>{chip.number}</span>
          {chip.status && <ReviewStatusIcon status={chip.status} size={13} />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.card} align="start" sideOffset={6} {...card.hoverProps} onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()}>
          <header className={styles.header}>
            <span className={`${styles.state} ${stateColors.stateColor}`} data-state={chip.state} aria-hidden>
              <StateIcon size={15} />
            </span>
            <span className={styles.title}>{chip.card.title}</span>
            <span className={styles.cardNumber}>{chip.number}</span>
          </header>
          <p className={styles.where}>{chip.card.where}</p>
          {(chip.card.review || chip.card.showsReviewers) && (
            <div className={styles.review}>
              {chip.card.review && (
                <span className={styles.reviewText}>
                  <ReviewStatusIcon status={chip.card.review.status} size={13} />
                  <span className={styles.reviewLines}>
                    <span>{chip.card.review.title}</span>
                    {chip.card.review.detail && <span className={styles.detail}>{chip.card.review.detail}</span>}
                  </span>
                </span>
              )}
              {chip.card.showsReviewers && (
                <span className={styles.reviewers}>
                  <ReviewerStack reviewers={request.reviewers} />
                </span>
              )}
            </div>
          )}
          {chip.card.openItems && <p className={styles.openItems}>{chip.card.openItems}</p>}
          <footer className={styles.footer}>
            {chip.card.actions.map((action) => (
              <Button key={action.kind} size="small" variant={action.primary ? 'primary' : 'secondary'} onClick={() => run(action)}>
                {action.label}
              </Button>
            ))}
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
