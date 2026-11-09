import { Home, Maximize, Minus, Plus, Settings2 } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { ZOOM_STEP } from './canvas/zoom';
import styles from './GraphNavControls.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

interface GraphNavControlsProps {
  onGoHome: () => void;
  onFit: () => void;
  onZoom: (factor: number) => void;
  onOpenOptions: () => void;
}

/** The floating home / fit / zoom cluster in the corner of the graph, with the display options' button beside it. */
export function GraphNavControls({ onGoHome, onFit, onZoom, onOpenOptions }: GraphNavControlsProps) {
  return (
    <div className={styles.corner}>
      <div className={styles.box}>
        <IconButton icon={<Settings2 size={14} />} label="Display options" onClick={onOpenOptions} />
      </div>
      <div className={styles.box}>
        <IconButton icon={<Home size={14} />} label="Go to the workspace" shortcut={hotkey('graphHome')} onClick={onGoHome} />
        <IconButton icon={<Maximize size={14} />} label="Fit to window" shortcut={hotkey('graphFit')} onClick={onFit} />
        <span className={styles.separator} />
        <IconButton icon={<Plus size={14} />} label="Zoom in" shortcut={hotkey('graphZoomIn')} onClick={() => onZoom(ZOOM_STEP)} />
        <IconButton icon={<Minus size={14} />} label="Zoom out" shortcut={hotkey('graphZoomOut')} onClick={() => onZoom(1 / ZOOM_STEP)} />
      </div>
    </div>
  );
}
