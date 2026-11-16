import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { useHoverCard } from '../../lib/useHoverCard';
import { openReview } from './codeReviewOperations';
import type { MergeRequestReview } from './mergeRequestState';
import { MergeRequestSummaryCard } from './MergeRequestSummaryCard';
import cardStyles from './MergeRequestHoverCard.module.css';

interface MergeRequestHoverCardProps {
  request: MergeRequestReview;
  trigger: (hoverProps: object) => ReactNode;
  /**
   * Runs as its title opens the request, before the page shows: a list to pick a branch from closes the popup or
   * dialog holding it, which would otherwise stay over the page.
   */
  beforeOpen?: () => void;
}

/**
 * A merge request's summary (`MergeRequestSummaryCard`), shown while `trigger` is hovered, its title a link that opens
 * the request; the trigger's click does what it did.
 */
export function MergeRequestHoverCard({ request, trigger, beforeOpen }: MergeRequestHoverCardProps) {
  const card = useHoverCard();
  return (
    <Popover.Root open={card.open} onOpenChange={(next) => !next && card.close()}>
      <Popover.Trigger asChild>{trigger(card.hoverProps)}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cardStyles.popover}
          align="start"
          sideOffset={6}
          {...card.hoverProps}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // React carries a portal's events up to the trigger's parents: a click on the card never reaches the row it
          // hovers (a branch list's row would switch to the branch).
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <MergeRequestSummaryCard
            request={request}
            framed
            onOpen={() => {
              card.close();
              beforeOpen?.();
              openReview(request);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
