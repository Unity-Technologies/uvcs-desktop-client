import { Maximize, Scan, SquareArrowUpLeft, SquareDot, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../../../../ui/IconButton';
import type { AnchorMode } from './composedFrame';
import { zoomLabel } from './viewTransform';
import type { PanZoom } from './usePanZoom';
import styles from './ZoomControls.module.css';
import { hotkey } from '../../../../lib/shortcutRegistry';

interface ZoomControlsProps {
  panZoom: PanZoom;
  /** Shown only for revisions of different sizes: centered (the UVCS convention) or by their top-left corners (how canvases usually grow). */
  anchor: AnchorMode | null;
  onAnchorChange: (anchor: AnchorMode) => void;
}

/** The zoom cluster floating at the bottom right of the stage (the UVCS spot). */
export function ZoomControls({ panZoom, anchor, onAnchorChange }: ZoomControlsProps) {
  return (
    <div className={styles.controls}>
      <button type="button" className={styles.percent} data-tip="Zoom to fit" onClick={panZoom.zoomToFit}>
        {zoomLabel(panZoom.transform.scale)}
      </button>
      <ZoomButton icon={<ZoomIn size={15} />} label="Zoom in" shortcut={hotkey('imageZoomIn')} onClick={panZoom.zoomIn} />
      <ZoomButton icon={<ZoomOut size={15} />} label="Zoom out" shortcut={hotkey('imageZoomOut')} onClick={panZoom.zoomOut} />
      <ZoomButton icon={<Maximize size={15} />} label="Zoom to fit" shortcut={hotkey('imageFit')} active={panZoom.fitted} onClick={panZoom.zoomToFit} />
      <ZoomButton icon={<Scan size={15} />} label="Actual size" shortcut={hotkey('imageActualSize')} onClick={panZoom.zoomToActualSize} />
      {anchor && (
        <>
          <div className={styles.separator} />
          <ZoomButton icon={<SquareDot size={15} />} label="Align centers" active={anchor === 'center'} onClick={() => onAnchorChange('center')} />
          <ZoomButton
            icon={<SquareArrowUpLeft size={15} />}
            label="Align top-left corners"
            active={anchor === 'top-left'}
            onClick={() => onAnchorChange('top-left')}
          />
        </>
      )}
    </div>
  );
}

interface ZoomButtonProps {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
}

function ZoomButton({ icon, label, shortcut, active = false, onClick }: ZoomButtonProps) {
  return <IconButton className={styles.button} data-active={active || undefined} icon={icon} label={label} shortcut={shortcut} onClick={onClick} />;
}
