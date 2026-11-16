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
   * Whether its title is a link that opens the request; off in a list to pick a branch from, whose popup or dialog
   * would stay over the page it opens.
   */
  opens?: boolean;
}

/**
 * A merge request's summary (`MergeRequestSummaryCard`), shown while `trigger` is hovered, its title a link that opens
 * the request; the trigger's click does what it did.
 */
export function MergeRequestHoverCard({ request, trigger, opens = true }: MergeRequestHoverCardProps) {
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
            onOpen={
              opens
                ? () => {
                    card.close();
                    openReview(request);
                  }
                : undefined
            }
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
