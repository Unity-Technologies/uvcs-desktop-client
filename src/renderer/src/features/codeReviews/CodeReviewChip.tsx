import * as Popover from '@radix-ui/react-popover';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { MouseEvent, ReactNode } from 'react';
import { useHoverCard } from '../../lib/useHoverCard';
import { openReview } from './codeReviewOperations';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import type { MergeRequestReview } from './mergeRequestState';
import { MergeRequestStateBadge } from './MergeRequestStateBadge';
import { MergeRequestSummaryCard } from './MergeRequestSummaryCard';
import { reviewChipOf, type ReviewChip } from './reviewChip';
import { MergeVerdictIcon } from './MergeVerdictIcon';
import styles from './CodeReviewStatusBadge.module.css';
import cardStyles from './CodeReviewChip.module.css';

/**
 * A small chip for a row whose branch has a code review or a merge request (`reviewChipOf`): a merge request's state,
 * then its review's status; a code review's status. Clicking it opens the review. Hovering a merge request's shows its
 * summary (`MergeRequestSummaryCard`); a code review's, a tooltip. `iconOnly` where room is short.
 */
export function CodeReviewChip({ review, iconOnly = false }: { review: CodeReviewSummary; iconOnly?: boolean }) {
  const chip = reviewChipOf(review, iconOnly);
  const button = (hoverProps?: object): ReactNode => (
    <button
      type="button"
      className={styles.chip}
      data-tip={chip.hover.kind === 'tip' ? chip.hover.tip : undefined}
      data-tip-sub={chip.hover.kind === 'tip' ? chip.hover.tipSub : undefined}
      aria-label={chip.label}
      onMouseDown={stop}
      onDoubleClick={stop}
      onClick={(event) => {
        event.stopPropagation();
        openReview(review);
      }}
      {...hoverProps}
    >
      <ChipGlyphs chip={chip} />
    </button>
  );
  switch (chip.hover.kind) {
    case 'tip':
      return button();
    case 'summary':
      return <MergeRequestHoverCard request={chip.hover.request} trigger={button} />;
  }
}

function stop(event: MouseEvent): void {
  event.stopPropagation();
}

function ChipGlyphs({ chip }: { chip: ReviewChip }) {
  return (
    <>
      {chip.state && <MergeRequestStateBadge state={chip.state} compact iconOnly={!chip.stateText} />}
      {chip.verdict && (
        <span className={cardStyles.status}>
          <MergeVerdictIcon verdict={chip.verdict} />
        </span>
      )}
      {chip.status && <CodeReviewStatusBadge status={chip.status} compact iconOnly={!chip.statusText} />}
    </>
  );
}

/** A merge request's summary, shown while its chip is hovered; the chip's click still opens the request. */
function MergeRequestHoverCard({ request, trigger }: { request: MergeRequestReview; trigger: (hoverProps: object) => ReactNode }) {
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
