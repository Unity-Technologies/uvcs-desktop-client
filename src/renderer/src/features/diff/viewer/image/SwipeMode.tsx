// Swipe: both revisions stacked, with a draggable divider revealing before on
// the left and after on the right. The new layer is clipped at the divider in
// viewport space, so the split line stays put while the image pans and zooms
// underneath it — exactly how a film wipe behaves.

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AnchorMode, Size } from './imageDiff';
import { followDrag, isDragButton } from './pointerDrag';
import { ImageLayer, SideChip, Viewport, World } from './stage';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import styles from './SwipeMode.module.css';

/** The divider stays this far in from the edges, so it can always be grabbed again. */
const MIN_SPLIT = 0.02;
const MAX_SPLIT = 0.98;
const CENTERED_SPLIT = 0.5;
/** Below this size on screen, the image would be covered by the divider's 32px knob: only the line shows. */
const MIN_SIZE_FOR_KNOB = 96;

interface SwipeModeProps {
  oldImage: DecodedImage;
  newImage: DecodedImage;
  frame: Size;
  panZoom: PanZoom;
  anchor: AnchorMode;
}

export function SwipeMode({ oldImage, newImage, frame, panZoom, anchor }: SwipeModeProps) {
  /** Divider position as a fraction of the viewport width. */
  const [split, setSplit] = useState(CENTERED_SPLIT);
  const containerRef = useRef<HTMLDivElement>(null);

  // The whole divider drags (a 14px strip around the 2px line, as a splitter does), not just the knob.
  const onDividerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const container = containerRef.current;
    if (!isDragButton(event.button) || !container) return;
    followDrag(event.currentTarget, event.pointerId, (drag) => {
      const rect = container.getBoundingClientRect();
      setSplit(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, (drag.clientX - rect.left) / rect.width)));
    });
  }, []);

  const { scale } = panZoom.transform;
  const knobHidden = Math.min(frame.width * scale, frame.height * scale) < MIN_SIZE_FOR_KNOB;

  return (
    <div className={styles.swipe} ref={containerRef}>
      <Viewport panZoom={panZoom}>
        <World panZoom={panZoom} frame={frame}>
          <ImageLayer image={oldImage} frame={frame} side="old" anchor={anchor} />
        </World>
        {/* The new revision rides the same transform inside a viewport-level
            clip, so only the divider decides how much of it shows. */}
        <div className={styles.reveal} style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}>
          <World panZoom={panZoom} frame={frame}>
            <ImageLayer image={newImage} frame={frame} side="new" anchor={anchor} />
          </World>
        </div>
        {/* data-no-pan: the viewport's native pan listener fires before any
            React handler here could stopPropagation — the stage checks the
            attribute instead (`STAGE_CONTROLS`). Double-click
            snaps the split back to center. */}
        <div
          className={styles.divider}
          style={{ left: `${split * 100}%` }}
          data-no-pan
          onPointerDown={onDividerDown}
          onDoubleClick={() => setSplit(CENTERED_SPLIT)}
        >
          <div className={styles.handle} data-hidden={knobHidden || undefined}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M5 3 1.8 7 5 11M9 3l3.2 4L9 11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <SideChip side="old" />
        <SideChip side="new" corner="right" />
      </Viewport>
    </div>
  );
}
