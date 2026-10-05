// Swipe: both revisions stacked, with a draggable divider revealing before on
// the left and after on the right. The new layer is clipped at the divider in
// viewport space, so the split line stays put while the image pans and zooms
// underneath it — exactly how a film wipe behaves.

import { useRef, useState } from 'react';
import type { AnchorMode, Size } from './composedFrame';
import { ImageLayer, SideChip, Viewport, World } from './stage';
import { CENTERED_SPLIT, SwipeDivider } from './SwipeDivider';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import styles from './SwipeMode.module.css';

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
        <SwipeDivider split={split} onSplitChange={setSplit} container={containerRef} knobHidden={knobHidden} />
        <SideChip side="old" />
        <SideChip side="new" corner="right" />
      </Viewport>
    </div>
  );
}
