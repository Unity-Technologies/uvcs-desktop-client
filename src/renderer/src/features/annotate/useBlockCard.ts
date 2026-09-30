import { useEffect, useState } from 'react';
import { useHoverCard } from '../../lib/useHoverCard';

export type BlockCardState = ReturnType<typeof useBlockCard>;

/**
 * Which block's card shows, and whether: hovering a block's label opens it, a click or Space pins it. A card follows its
 * label only while nothing scrolls under it.
 */
export function useBlockCard(scroller: HTMLElement | null) {
  const [block, setBlock] = useState(-1);
  const card = useHoverCard();

  useEffect(() => {
    if (!scroller || !card.open) return;
    const close = (): void => card.close();
    scroller.addEventListener('scroll', close, { passive: true, once: true });
    return () => scroller.removeEventListener('scroll', close);
  }, [scroller, card.open]);

  return {
    /** The block the card is of (-1 before any). */
    block,
    card,
    /** Pins the card of block `index` open, or closes it if it's pinned already. */
    toggle: (index: number): void => {
      setBlock(index);
      card.toggle();
    },
    /** The pointer came on block `index`'s label, or left it (null). A pinned card stays on its block. */
    hover: (index: number | null): void => {
      if (index === null) return card.hoverProps.onMouseLeave();
      if (!card.pinned) setBlock(index);
      card.hoverProps.onMouseEnter();
    },
  };
}
