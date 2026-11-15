import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ChangedLine } from './changeBlocks';
import type { LineAction } from './diffAnnotations';
import { lineNumberCellSelector, type CodeLayout } from './lineActions';
import { lineActionSpot, type LineActionSpot } from './lineActionSpot';
import { lineHover } from './lineHover';
import { pierreShadowRoot } from './pierreDom';
import styles from './LineActionButton.module.css';

type LineHoverOptions = Pick<FileDiffOptions<undefined, undefined>, 'onLineEnter' | 'onLineLeave'>;

/** The line the button acts on, and where it's drawn. */
interface HoveredLine {
  line: ChangedLine;
  spot: LineActionSpot;
}

type LineActionStore = StoreApi<HoveredLine | null>;

type LineHover = ReturnType<typeof lineHover<HoveredLine>>;

/**
 * The place's line action (`DiffAnnotations.lineAction`, a review's "Comment on line 42") as a button by the number of
 * the line under the pointer, on the lines it takes. `hovers`: what else follows the pointer over the lines (the hint on
 * line numbers, `useLineLinks`), which Pierre takes as one pair of callbacks.
 *
 * The button is drawn over the diff, in its scrolling container (`overlay`), not in Pierre's gutter slot: Pierre
 * isolates its code (`isolation: isolate` on `[data-diff]` and `[data-code]`), so nothing in the slot can be drawn above
 * what the container draws over the code, and the outlines around commented lines (`LineBands`) crossed the button.
 * Being apart from its line, it's placed again when the code moves under it (`useFollowedLine`).
 */
export function useLineActionButton(action: LineAction | undefined, hovers: LineHoverOptions, containerRef: RefObject<HTMLElement | null>, layout: CodeLayout): { options: LineHoverOptions; overlay?: ReactNode } {
  const [hovered] = useState<LineActionStore>(() => createStore<HoveredLine | null>(() => null));
  // The line under the pointer, kept as it goes from line to line, and while it's on the button (`lineHover`).
  const [hover] = useState<LineHover>(() => lineHover<HoveredLine>((shown) => hovered.setState(shown, true)));
  useEffect(() => hover.dispose, [hover]);
  const followed = useFollowedLine(hovered, hover, containerRef, layout);
  const options = useMemo<LineHoverOptions>(() => {
    if (!action) return {};
    return {
      onLineEnter: (props) => {
        hovers.onLineEnter?.(props);
        const line = { side: props.annotationSide, lineNumber: props.lineNumber };
        const container = containerRef.current;
        if (!container || !action.offers(line)) return hover.enter(null);
        followed.watch(props.numberElement);
        hover.enter({ line, spot: spotIn(container, props.numberElement) });
      },
      onLineLeave: (props) => {
        hovers.onLineLeave?.(props);
        hover.leave();
      },
    };
  }, [action, hovers, hover, containerRef, followed]);
  if (!action) return { options };
  return { options, overlay: <LineActionOverlayButton hovered={hovered} hover={hover} action={action} /> };
}

/** Where the button of the line whose number is `numberCell` goes in `container`'s scrolled content. */
function spotIn(container: HTMLElement, numberCell: Element): LineActionSpot {
  return lineActionSpot(numberCell.getBoundingClientRect(), container.getBoundingClientRect(), { top: container.scrollTop, left: container.scrollLeft });
}

/**
 * Places the button again when the code moves under a pointer at rest: the layout or wrapping switched, comments shown
 * or hidden, a thread above the line grown, the window resized. Scrolling moves both together, as the button is in the
 * scrolled content. The line is found again by its number, since Pierre may draw it anew; a line no longer drawn takes
 * the button away. `watch` follows the pane of a line entered, and Pierre's host, as `useLineBoxes` does.
 */
function useFollowedLine(hovered: LineActionStore, hover: LineHover, containerRef: RefObject<HTMLElement | null>, layout: CodeLayout): { watch: (numberCell: Element) => void } {
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

interface LineActionOverlayButtonProps {
  hovered: LineActionStore;
  hover: LineHover;
  action: LineAction;
}

/** The button of the line under the pointer, which keeps its line while the pointer is on it. */
function LineActionOverlayButton({ hovered, hover, action }: LineActionOverlayButtonProps) {
  const shown = useStore(hovered);
  // Gone from under the pointer (the place stopped offering it), it never says it was left.
  useEffect(() => hover.release, [hover]);
  if (!shown) return null;
  const label = action.label(shown.line);
  return (
    <button
      type="button"
      className={styles.button}
      style={shown.spot}
      data-tip={label}
      aria-label={label}
      onPointerEnter={hover.hold}
      onPointerLeave={hover.release}
      onClick={() => action.run(shown.line)}
    >
      <Plus size={14} strokeWidth={2.75} aria-hidden />
    </button>
  );
}
