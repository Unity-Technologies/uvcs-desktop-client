import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { MouseEvent, ReactNode } from 'react';
import { openReview } from './codeReviewOperations';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { MergeRequestStateBadge } from './MergeRequestStateBadge';
import { MergeRequestHoverCard } from './MergeRequestHoverCard';
import { reviewChipOf, type ReviewChip } from './reviewChip';
import { MergeVerdictIcon } from './MergeVerdictIcon';
import styles from './CodeReviewStatusBadge.module.css';
import chipStyles from './CodeReviewChip.module.css';

/**
 * A small chip for a row whose branch has a code review or a merge request (`reviewChipOf`): a merge request's state,
 * then its review's status; a code review's status. Clicking it opens the review. Hovering a merge request's shows its
 * summary (`MergeRequestSummaryCard`); a code review's, a tooltip. `iconOnly` where room is short.
 */
interface CodeReviewChipProps {
  review: CodeReviewSummary;
  iconOnly?: boolean;
  /** Runs before the review opens: a list to pick a branch from closes the popup or dialog holding it. */
  beforeOpen?: () => void;
  /** Drawn inside a row that is itself a button (a branch list's), where a button can't nest: the row keeps the keyboard. */
  insideButton?: boolean;
}

export function CodeReviewChip({ review, iconOnly = false, beforeOpen, insideButton = false }: CodeReviewChipProps) {
  const chip = reviewChipOf(review, iconOnly);
  const Element = insideButton ? 'span' : 'button';
  const open = (): void => {
    beforeOpen?.();
    openReview(review);
  };
  const button = (hoverProps?: object): ReactNode => (
    <Element
      type={insideButton ? undefined : 'button'}
      className={styles.chip}
      data-tip={chip.hover.kind === 'tip' ? chip.hover.tip : undefined}
      data-tip-sub={chip.hover.kind === 'tip' ? chip.hover.tipSub : undefined}
      aria-label={chip.label}
      onMouseDown={stop}
      onDoubleClick={stop}
      onClick={(event) => {
        event.stopPropagation();
        open();
      }}
      {...hoverProps}
    >
      <ChipGlyphs chip={chip} />
    </Element>
  );
  switch (chip.hover.kind) {
    case 'tip':
      return button();
    case 'summary':
      return <MergeRequestHoverCard request={chip.hover.request} trigger={button} beforeOpen={beforeOpen} />;
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
        <span className={chipStyles.status}>
          <MergeVerdictIcon verdict={chip.verdict} />
        </span>
      )}
      {chip.status && <CodeReviewStatusBadge status={chip.status} compact iconOnly={!chip.statusText} />}
    </>
  );
}
