import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import type { FileDiffOptions } from '@pierre/diffs/react';
import type { FocusedLines } from '../../../app/navigation/pages';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ChangedLine } from './changeBlocks';
import type { LineAction } from './diffAnnotations';
import type { CodeLayout } from './lineActions';
import type { LineActionSpot } from './lineActionSpot';
import { lineActionTargetAt } from './lineMenu';
import { lineHover } from './lineHover';
import { spotIn, useFollowedLine } from './useFollowedLine';
import styles from './LineActionButton.module.css';

type LineHoverOptions = Pick<FileDiffOptions<undefined, undefined>, 'onLineEnter' | 'onLineLeave'>;

/** The line the button acts on, and where it's drawn. */
export interface HoveredLine {
  line: ChangedLine;
  spot: LineActionSpot;
}

export type LineActionStore = StoreApi<HoveredLine | null>;

export type LineHover = ReturnType<typeof lineHover<HoveredLine>>;

/**
 * The place's line action (`DiffAnnotations.lineAction`, a review's "Comment on line 42") as a button by the number of
 * the line under the pointer, on the lines it takes; on the lines `selected` when it's one of them. `hovers`: what else follows the pointer over the lines (the hint on
 * line numbers, `useLineLinks`), which Pierre takes as one pair of callbacks.
 *
 * The button is drawn over the diff, in its scrolling container (`overlay`), not in Pierre's gutter slot: Pierre
 * isolates its code (`isolation: isolate` on `[data-diff]` and `[data-code]`), so nothing in the slot can be drawn above
 * what the container draws over the code, and the outlines around commented lines (`LineBands`) crossed the button.
 * Being apart from its line, it's placed again when the code moves under it (`useFollowedLine`).
 */
export function useLineActionButton(
  action: LineAction | undefined,
  hovers: LineHoverOptions,
  containerRef: RefObject<HTMLElement | null>,
  layout: CodeLayout,
  selected: FocusedLines | null,
): { options: LineHoverOptions; overlay?: ReactNode } {
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
        if (!container || !action.offers(lineActionTargetAt(line, null))) return hover.enter(null);
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
  return { options, overlay: <LineActionOverlayButton hovered={hovered} hover={hover} action={action} selected={selected} /> };
}

interface LineActionOverlayButtonProps {
  hovered: LineActionStore;
  hover: LineHover;
  action: LineAction;
  selected: FocusedLines | null;
}

/**
 * The button of the line under the pointer, which keeps its line while the pointer is on it: it acts on the lines
 * selected when the line is one of them and the place takes them all, else on the line.
 */
function LineActionOverlayButton({ hovered, hover, action, selected }: LineActionOverlayButtonProps) {
  const shown = useStore(hovered);
  // Gone from under the pointer (the place stopped offering it), it never says it was left.
  useEffect(() => hover.release, [hover]);
  if (!shown) return null;
  const range = lineActionTargetAt(shown.line, selected);
  const target = action.offers(range) ? range : lineActionTargetAt(shown.line, null);
  const label = action.label(target);
  return (
    <button
      type="button"
      className={styles.button}
      style={shown.spot}
      data-tip={label}
      aria-label={label}
      onPointerEnter={hover.hold}
      onPointerLeave={hover.release}
      onClick={() => action.run(target)}
    >
      <Plus size={14} strokeWidth={2.75} aria-hidden />
    </button>
  );
}
