import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ChangedLine } from './changeBlocks';
import type { LineAction } from './diffAnnotations';
import type { HoveredLineStore } from './LineDiscardButton';
import { keepPointerDownToItself } from './pierreDom';
import { useShadowStyle } from './useShadowStyle';
import styles from './LineActionButton.module.css';

type LineHoverOptions = Pick<FileDiffOptions<undefined, undefined>, 'onLineEnter' | 'onLineLeave'>;

type LineActionOptions = Pick<FileDiffOptions<undefined, undefined>, 'enableGutterUtility'> & LineHoverOptions;

/**
 * The button sits just past the line's number, over the edge into its code, as a pull request's "+" does: over the number
 * alone it hid it, and read as part of it. Above the code, which Pierre lays out after the number.
 */
const GUTTER_CSS = '[data-gutter-utility-slot]{right:-21px;z-index:3}';

/**
 * The place's line action (`DiffAnnotations.lineAction`, a review's "Comment on line 42") as a button in the gutter of
 * the line under the pointer, on the lines it takes. `hovers`: what else follows the pointer over the lines (the hint on
 * line numbers, `useLineLinks`), which Pierre takes as one pair of callbacks.
 */
export function useLineActionButton(action: LineAction | undefined, hovers: LineHoverOptions, containerRef: RefObject<HTMLElement | null>): { options: LineActionOptions; renderGutterUtility?: () => ReactNode } {
  const [hovered] = useState<HoveredLineStore>(() => createStore<ChangedLine | null>(() => null));
  useShadowStyle(containerRef, action ? GUTTER_CSS : '');
  // Leaving a line clears the button a frame later, unless another line is entered meanwhile: moving from line to line,
  // it stays, never gone for a frame in between.
  const clearing = useRef<number | null>(null);
  const keep = (): void => {
    if (clearing.current !== null) cancelAnimationFrame(clearing.current);
    clearing.current = null;
  };
  useEffect(() => keep, []);
  const options = useMemo<LineActionOptions>(() => {
    if (!action) return {};
    return {
      enableGutterUtility: true,
      onLineEnter: (props) => {
        hovers.onLineEnter?.(props);
        keep();
        const line = { side: props.annotationSide, lineNumber: props.lineNumber };
        hovered.setState(action.offers(line) ? line : null, true);
      },
      onLineLeave: (props) => {
        hovers.onLineLeave?.(props);
        keep();
        clearing.current = requestAnimationFrame(() => {
          clearing.current = null;
          hovered.setState(null, true);
        });
      },
    };
  }, [action, hovers, hovered]);
  if (!action) return { options };
  return { options, renderGutterUtility: () => <LineActionGutterButton hovered={hovered} action={action} /> };
}

function LineActionGutterButton({ hovered, action }: { hovered: HoveredLineStore; action: LineAction }) {
  const line = useStore(hovered);
  if (!line) return null;
  const label = action.label(line);
  return (
    <div className={styles.slot}>
      <button type="button" ref={keepPointerDownToItself} className={styles.button} data-tip={label} aria-label={label} onClick={() => action.run(line)}>
        <Plus size={14} strokeWidth={2.75} aria-hidden />
      </button>
    </div>
  );
}
