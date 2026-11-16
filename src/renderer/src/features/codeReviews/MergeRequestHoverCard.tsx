import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { useHoverCard } from '../../lib/useHoverCard';
import { openReview } from './codeReviewOperations';
import type { MergeRequestReview } from './mergeRequestState';
import { MergeRequestSummaryCard } from './MergeRequestSummaryCard';
import cardStyles from './MergeRequestHoverCard.module.css';

/**
 * A merge request's summary (`MergeRequestSummaryCard`), shown while `trigger` is hovered, its title a link that opens
 * the request; the trigger's click does what it did.
 */
export function MergeRequestHoverCard({ request, trigger }: { request: MergeRequestReview; trigger: (hoverProps: object) => ReactNode }) {
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
        >
          <MergeRequestSummaryCard
            request={request}
            framed
            onOpen={() => {
              card.close();
              openReview(request);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
