import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a card the pointer left stays, so crossing a gap (the node to its caption, the pointer into the card) never makes it flicker. */
const CLOSE_GRACE_MS = 200;

/**
 * The life of the graph's hover card: it opens at once, stays while the pointer is on what opened it or in the card
 * (to select and copy its text), and closes a moment after the pointer leaves both; the view moving or Escape close
 * it at once. A card shown again with the same key is kept as it is, so it doesn't move or re-render under the text
 * being selected.
 */
export function useHoverCard<T extends { key: string }>() {
  const [card, setCard] = useState<T | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const keepOpen = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  }, []);

  const show = useCallback(
    (next: T, followsPointer: boolean) => {
      keepOpen();
      setCard((current) => (current?.key === next.key && !followsPointer ? current : next));
    },
    [keepOpen],
  );

  const requestClose = useCallback(() => {
    if (closeTimer.current !== undefined) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = undefined;
      setCard(null);
    }, CLOSE_GRACE_MS);
  }, []);

  const close = useCallback(() => {
    keepOpen();
    setCard(null);
  }, [keepOpen]);

  const isOpen = card !== null;
  useEffect(() => {
    if (!isOpen) return;
    // Escape peels the card before anything else hears it (clearing the selection, the search or the focus).
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, close]);

  useEffect(() => keepOpen, [keepOpen]);

  return { card, show, keepOpen, requestClose, close };
}
