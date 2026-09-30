// Side by side: before and after in two synchronized panes. Both halves bind
// the same PanZoom, so zooming or panning either one moves both — comparing
// the same region never needs manual re-alignment.

import type { AnchorMode, Size } from './imageDiff';
import { ImageLayer, SideChip, Viewport, World } from './stage';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import styles from './SideBySideMode.module.css';

interface SideBySideModeProps {
  oldImage: DecodedImage;
  newImage: DecodedImage;
  frame: Size;
  panZoom: PanZoom;
  anchor: AnchorMode;
}

export function SideBySideMode({ oldImage, newImage, frame, panZoom, anchor }: SideBySideModeProps) {
  return (
    <div className={styles.panes}>
      <Viewport panZoom={panZoom}>
        <World panZoom={panZoom} frame={frame}>
          <ImageLayer image={oldImage} frame={frame} side="old" anchor={anchor} />
        </World>
        <SideChip side="old" />
      </Viewport>
      <Viewport panZoom={panZoom}>
        <World panZoom={panZoom} frame={frame}>
          <ImageLayer image={newImage} frame={frame} side="new" anchor={anchor} />
        </World>
        <SideChip side="new" corner="right" />
      </Viewport>
    </div>
  );
}
