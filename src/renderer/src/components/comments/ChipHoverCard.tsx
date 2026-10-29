import { cloneElement, useEffect, useRef, type ReactElement } from 'react';
import { formatRelativeDate } from '../../lib/formatDate';
import { HoverCard } from '../../ui/HoverCard';
import { AnchoredCard, useHoverOpen } from './AnchoredCard';
import type { ChipCard } from './chipContent';
import { CommentLine } from './CommentLine';

/** Dates in a chip's card, as the Branch Explorer's say them ("2 hours ago"). */
export const cardDate = (date: string): string => formatRelativeDate(date);

interface ChipHoverCardProps {
  card: ChipCard;
  /** The chip: hovered, or focused from the keyboard, it shows the card. */
  children: ReactElement<Record<string, unknown>>;
  /** The card opened or closed: a chip of another server's repository reads its object while it's open (`useRemoteObject`). */
  onOpenChange?: (open: boolean) => void;
}

/**
 * A chip's hover card (`chipCard`), the Branch Explorer's card (`HoverCard`): the comment drawn as a comment's line,
 * then what the object is, who and when. On hover after a moment, and at once on keyboard focus.
 */
export function ChipHoverCard({ card, children, onOpenChange }: ChipHoverCardProps) {
  const anchor = useRef<HTMLElement>(null);
  const { open, handlers } = useHoverOpen();
  useEffect(() => {
    onOpenChange?.(open);
  }, [open]);
  return (
    <>
      {cloneElement(children, { ref: anchor, ...handlers })}
      {open && (
        <AnchoredCard anchor={anchor}>
          <HoverCard title={card.comment ? <CommentLine comment={card.comment} interactive={false} /> : card.title} meta={card.meta.length > 0 ? card.meta.join(' · ') : undefined} />
        </AnchoredCard>
      )}
    </>
  );
}
