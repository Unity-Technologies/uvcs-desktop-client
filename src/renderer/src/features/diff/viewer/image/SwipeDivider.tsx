// The swipe modes' divider: a strip that drags like a splitter across the stage, its knob in the middle. Image and
// model swipes both use it, so the two feel like one tool.

import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { followDrag, isDragButton } from './pointerDrag';
import styles from './SwipeDivider.module.css';

/** The divider stays this far in from the edges, so it can always be grabbed again. */
const MIN_SPLIT = 0.02;
const MAX_SPLIT = 0.98;
export const CENTERED_SPLIT = 0.5;

interface SwipeDividerProps {
  /** Where the divider is, as a fraction of the container's width. */
  split: number;
  onSplitChange: (split: number) => void;
  /** The element the split is a fraction of. */
  container: RefObject<HTMLElement | null>;
  /** Hides the knob where it would cover what is compared (an image shown tiny): only the line shows. */
  knobHidden?: boolean;
}

export function SwipeDivider({ split, onSplitChange, container, knobHidden = false }: SwipeDividerProps) {
  // The whole divider drags (a 14px strip around the 2px line, as a splitter does), not just the knob.
  const onDividerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const element = container.current;
      if (!isDragButton(event.button) || !element) return;
      followDrag(event.currentTarget, event.pointerId, (drag) => {
        const rect = element.getBoundingClientRect();
        onSplitChange(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, (drag.clientX - rect.left) / rect.width)));
      });
    },
    [container, onSplitChange],
  );

  // data-no-pan: the viewport's native pan listener fires before any React handler here could stopPropagation — the
  // stage checks the attribute instead (`STAGE_CONTROLS`). Double-click snaps the split back to center.
  return (
    <div className={styles.divider} style={{ left: `${split * 100}%` }} data-no-pan onPointerDown={onDividerDown} onDoubleClick={() => onSplitChange(CENTERED_SPLIT)}>
      <div className={styles.handle} data-hidden={knobHidden || undefined}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M5 3 1.8 7 5 11M9 3l3.2 4L9 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
