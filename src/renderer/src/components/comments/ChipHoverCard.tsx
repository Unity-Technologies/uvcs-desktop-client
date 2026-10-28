import * as RadixPopover from '@radix-ui/react-popover';
import { cloneElement, useEffect, useRef, useState, type ReactElement } from 'react';
import { formatRelativeDate } from '../../lib/formatDate';
import { HoverCard } from '../../ui/HoverCard';
import type { ChipCard } from './chipContent';
import { CommentLine } from './CommentLine';
import styles from './ChipHoverCard.module.css';

/** How long the pointer rests on a chip before its card shows, as an image's chip waits (`CommentImage`). */
const HOVER_DELAY_MS = 350;

/** Dates in a chip's card, as the Branch Explorer's say them ("2 hours ago"). */
export const cardDate = (date: string): string => formatRelativeDate(date);

interface ChipHoverCardProps {
  card: ChipCard;
  /** The chip: hovered, or focused from the keyboard, it shows the card. */
  children: ReactElement<Record<string, unknown>>;
}

/**
 * A chip's hover card (`chipCard`), the Branch Explorer's card (`HoverCard`): the comment drawn as a comment's line,
 * then what the object is, who and when. On hover after a moment, and at once on keyboard focus.
 */
export function ChipHoverCard({ card, children }: ChipHoverCardProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (): void => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  };
  const hide = (): void => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  return (
    <RadixPopover.Root open={open}>
      <RadixPopover.Anchor asChild>{cloneElement(children, { onMouseEnter: show, onMouseLeave: hide, onFocus: () => setOpen(true), onBlur: hide })}</RadixPopover.Anchor>
      <RadixPopover.Portal>
        <RadixPopover.Content className={styles.layer} side="top" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(event) => event.preventDefault()}>
          <HoverCard title={card.comment ? <CommentLine comment={card.comment} interactive={false} /> : card.title} meta={card.meta.length > 0 ? card.meta.join(' · ') : undefined} />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
