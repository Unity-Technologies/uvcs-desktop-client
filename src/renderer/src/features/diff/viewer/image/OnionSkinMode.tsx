// Onion skin: the new revision is layered over the old one and the blend pill (`BlendPill`) mixes them — the classic
// way to spot what moved — or blinks between them.

import { BlendPill } from './BlendPill';
import type { AnchorMode, Size } from './composedFrame';
import { BOTH_SIDES, ImageLayer, Viewport, World, type StageOverlay } from './stage';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';

interface OnionSkinModeProps {
  oldImage: DecodedImage;
  newImage: DecodedImage;
  frame: Size;
  panZoom: PanZoom;
  anchor: AnchorMode;
  /** 0 = all before, 1 = all after. Owned by the viewer so it survives mode trips. */
  blend: number;
  onBlendChange: (blend: number) => void;
  /** What a place draws over each viewport, for the sides it shows (`ImageCommentsOverlay`). */
  overlay?: StageOverlay;
}

export function OnionSkinMode({ oldImage, newImage, frame, panZoom, anchor, blend, onBlendChange, overlay }: OnionSkinModeProps) {
  return (
    <Viewport panZoom={panZoom}>
      <World panZoom={panZoom} frame={frame}>
        <ImageLayer image={oldImage} frame={frame} side="old" anchor={anchor} />
        <ImageLayer image={newImage} frame={frame} side="new" anchor={anchor} opacity={blend} />
      </World>
      <BlendPill blend={blend} onBlendChange={onBlendChange} things="images" />
      {overlay?.(BOTH_SIDES)}
    </Viewport>
  );
}
