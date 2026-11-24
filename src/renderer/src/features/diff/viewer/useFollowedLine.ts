import { useEffect, useRef, useState, type RefObject } from 'react';
import type { LineActionStore, LineHover } from './LineActionButton';
import { lineNumberCellSelector, type CodeLayout } from './lineActions';
import { lineActionSpot, type LineActionSpot } from './lineActionSpot';
import { pierreShadowRoot } from './pierreDom';

/** Where the button of the line whose number is `numberCell` goes in `container`'s scrolled content. */
export function spotIn(container: HTMLElement, numberCell: Element): LineActionSpot {
  return lineActionSpot(numberCell.getBoundingClientRect(), container.getBoundingClientRect(), { top: container.scrollTop, left: container.scrollLeft });
}

/**
 * Places the button again when the code moves under a pointer at rest: the layout or wrapping switched, comments shown
 * or hidden, a thread above the line grown, the window resized. Scrolling moves both together, as the button is in the
 * scrolled content. The line is found again by its number, since Pierre may draw it anew; a line no longer drawn takes
 * the button away. `watch` follows the pane of a line entered, and Pierre's host, as `useLineBoxes` does.
 */
export function useFollowedLine(hovered: LineActionStore, hover: LineHover, containerRef: RefObject<HTMLElement | null>, layout: CodeLayout): { watch: (numberCell: Element) => void } {
  const layoutNow = useRef(layout);
  layoutNow.current = layout;
  const [followed] = useState(() => {
    const observer = new ResizeObserver(() => {
      const shown = hovered.getState();
      const container = containerRef.current;
      if (!shown || !container) return;
      const cell = pierreShadowRoot(container)?.querySelector(lineNumberCellSelector(shown.line, layoutNow.current));
      if (!cell) return hover.enter(null);
      const spot = spotIn(container, cell);
      if (spot.top !== shown.spot.top || spot.left !== shown.spot.left) hovered.setState({ line: shown.line, spot }, true);
    });
    return {
      observer,
      watch: (numberCell: Element): void => {
        const pane = numberCell.closest('[data-code]');
        const host = containerRef.current?.querySelector('diffs-container');
        // Observing an element again does nothing.
        for (const element of [pane, host]) if (element) observer.observe(element);
      },
    };
  });
  useEffect(() => () => followed.observer.disconnect(), [followed]);
  return followed;
}
