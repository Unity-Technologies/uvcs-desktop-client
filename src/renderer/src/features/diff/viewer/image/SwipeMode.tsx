// Swipe: both revisions stacked, with a draggable divider revealing before on
// the left and after on the right. The new layer is clipped at the divider in
// viewport space, so the split line stays put while the image pans and zooms
// underneath it — exactly how a film wipe behaves.

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AnchorMode } from './imageDiff';
import { ImageLayer, SideChip, Viewport, World } from './stage';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import styles from './SwipeMode.module.css';

interface SwipeModeProps {
  oldImage: DecodedImage;
  newImage: DecodedImage;
  frame: { width: number; height: number };
  panZoom: PanZoom;
  anchor: AnchorMode;
}

export function SwipeMode({ oldImage, newImage, frame, panZoom, anchor }: SwipeModeProps) {
  /** Divider position as a fraction of the viewport width. */
  const [split, setSplit] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // The whole divider is the drag surface (a 14px invisible strip around the
  // 2px line — splitter-style tolerance), not just the knob.
  const onDividerDown = useCallback((event: ReactPointerEvent) => {
    // Left or middle button, matching the stage's pan (middle acts as
    // primary across the image viewer); never the context-menu button.
    if (event.button !== 0 && event.button !== 1) return;
    const container = containerRef.current;
    if (!container) return;
    const strip = event.currentTarget as HTMLElement;
    strip.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      setSplit(Math.min(0.98, Math.max(0.02, (moveEvent.clientX - rect.left) / rect.width)));
    };
    const up = () => {
      strip.removeEventListener('pointermove', move);
      strip.removeEventListener('pointerup', up);
      strip.removeEventListener('pointercancel', up);
      strip.removeEventListener('lostpointercapture', up);
    };
    strip.addEventListener('pointermove', move);
    strip.addEventListener('pointerup', up);
    strip.addEventListener('pointercancel', up);
    // Same safety net as the stage pan: end the drag whenever the capture is
    // lost, even if the release lands outside the window.
    strip.addEventListener('lostpointercapture', up);
  }, []);

  // At far-out zoom the 32px knob would cover the whole picture — fade it
  // away and let the (fully draggable) line carry the interaction.
  const { scale } = panZoom.transform;
  const handleHidden = Math.min(frame.width * scale, frame.height * scale) < 96;

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
            attribute instead (see usePanZoom NO_PAN_TARGETS). Double-click
            snaps the split back to center. */}
        <div
          className={styles.divider}
          style={{ left: `${split * 100}%` }}
          data-no-pan
          onPointerDown={onDividerDown}
          onDoubleClick={() => setSplit(0.5)}
        >
          <div className={styles.handle} data-hidden={handleHidden || undefined}>
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
