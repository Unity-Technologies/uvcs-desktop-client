import { Maximize, Scan, SquareArrowUpLeft, SquareDot, ZoomIn, ZoomOut } from 'lucide-react';
import { hotkey } from '../../../../lib/shortcutRegistry';
import type { AnchorMode } from './composedFrame';
import { StageButton, StageControls, StageSeparator, StageTextButton } from './StageControls';
import { zoomLabel } from './viewTransform';
import type { PanZoom } from './usePanZoom';

interface ZoomControlsProps {
  panZoom: PanZoom;
  /** Shown only for revisions of different sizes: centered (the UVCS convention) or by their top-left corners (how canvases usually grow). */
  anchor: AnchorMode | null;
  onAnchorChange: (anchor: AnchorMode) => void;
}

/** The zoom cluster floating at the bottom right of the stage (the UVCS spot). */
export function ZoomControls({ panZoom, anchor, onAnchorChange }: ZoomControlsProps) {
  return (
    <StageControls>
      <StageTextButton tip="Zoom to fit" onClick={panZoom.zoomToFit}>
        {zoomLabel(panZoom.transform.scale)}
      </StageTextButton>
      <StageButton icon={<ZoomIn size={15} />} label="Zoom in" shortcut={hotkey('imageZoomIn')} onClick={panZoom.zoomIn} />
      <StageButton icon={<ZoomOut size={15} />} label="Zoom out" shortcut={hotkey('imageZoomOut')} onClick={panZoom.zoomOut} />
      <StageButton icon={<Maximize size={15} />} label="Zoom to fit" shortcut={hotkey('imageFit')} active={panZoom.fitted} onClick={panZoom.zoomToFit} />
      <StageButton icon={<Scan size={15} />} label="Actual size" shortcut={hotkey('imageActualSize')} onClick={panZoom.zoomToActualSize} />
      {anchor && (
        <>
          <StageSeparator />
          <StageButton icon={<SquareDot size={15} />} label="Align centers" active={anchor === 'center'} onClick={() => onAnchorChange('center')} />
          <StageButton icon={<SquareArrowUpLeft size={15} />} label="Align top-left corners" active={anchor === 'top-left'} onClick={() => onAnchorChange('top-left')} />
        </>
      )}
    </StageControls>
  );
}
