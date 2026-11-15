import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ChangedLine } from './changeBlocks';
import type { LineAction } from './diffAnnotations';
import { lineActionSpot, type LineActionSpot } from './lineActionSpot';
import { lineHover } from './lineHover';
import styles from './LineActionButton.module.css';

type LineHoverOptions = Pick<FileDiffOptions<undefined, undefined>, 'onLineEnter' | 'onLineLeave'>;

/** The line the button acts on, and where it's drawn. */
interface HoveredLine {
  line: ChangedLine;
  spot: LineActionSpot;
}

type HoveredLineStore = StoreApi<HoveredLine | null>;

type LineHover = ReturnType<typeof lineHover<HoveredLine>>;

/**
 * The place's line action (`DiffAnnotations.lineAction`, a review's "Comment on line 42") as a button by the number of
 * the line under the pointer, on the lines it takes. `hovers`: what else follows the pointer over the lines (the hint on
 * line numbers, `useLineLinks`), which Pierre takes as one pair of callbacks.
 *
 * The button is drawn over the diff, in its scrolling container (`overlay`), not in Pierre's gutter slot: Pierre
 * isolates its code (`isolation: isolate` on `[data-diff]` and `[data-code]`), so nothing in the slot can be drawn above
 * what the container draws over the code, and the outlines around commented lines (`LineBands`) crossed the button.
 */
export function useLineActionButton(action: LineAction | undefined, hovers: LineHoverOptions, containerRef: RefObject<HTMLElement | null>): { options: LineHoverOptions; overlay?: ReactNode } {
  const [hovered] = useState<HoveredLineStore>(() => createStore<HoveredLine | null>(() => null));
  // The line under the pointer, kept as it goes from line to line, and while it's on the button (`lineHover`).
  const [hover] = useState<LineHover>(() => lineHover<HoveredLine>((shown) => hovered.setState(shown, true)));
  useEffect(() => hover.dispose, [hover]);
  const options = useMemo<LineHoverOptions>(() => {
    if (!action) return {};
    return {
      onLineEnter: (props) => {
        hovers.onLineEnter?.(props);
        const line = { side: props.annotationSide, lineNumber: props.lineNumber };
        const container = containerRef.current;
        if (!container || !action.offers(line)) return hover.enter(null);
        const scroll = { top: container.scrollTop, left: container.scrollLeft };
        hover.enter({ line, spot: lineActionSpot(props.numberElement.getBoundingClientRect(), container.getBoundingClientRect(), scroll) });
      },
      onLineLeave: (props) => {
        hovers.onLineLeave?.(props);
        hover.leave();
      },
    };
  }, [action, hovers, hover, containerRef]);
  if (!action) return { options };
  return { options, overlay: <LineActionOverlayButton hovered={hovered} hover={hover} action={action} /> };
}

interface LineActionOverlayButtonProps {
  hovered: HoveredLineStore;
  hover: LineHover;
  action: LineAction;
}

/** The button of the line under the pointer, which keeps its line while the pointer is on it. */
function LineActionOverlayButton({ hovered, hover, action }: LineActionOverlayButtonProps) {
  const shown = useStore(hovered);
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
