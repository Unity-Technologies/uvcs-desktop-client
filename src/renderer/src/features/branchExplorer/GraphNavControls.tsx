import { Home, Maximize, Minus, Plus } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { ZOOM_STEP } from './canvas/zoom';
import styles from './GraphNavControls.module.css';

interface GraphNavControlsProps {
  onGoHome: () => void;
  onFit: () => void;
  onZoom: (factor: number) => void;
}

/** The floating home / fit / zoom cluster in the corner of the graph. */
export function GraphNavControls({ onGoHome, onFit, onZoom }: GraphNavControlsProps) {
  return (
    <div className={styles.cluster}>
      <IconButton icon={<Home size={14} />} label="Go to workspace changeset" shortcut="h" onClick={onGoHome} />
      <IconButton icon={<Maximize size={14} />} label="Fit to window" shortcut="0" onClick={onFit} />
      <span className={styles.separator} />
      <IconButton icon={<Plus size={14} />} label="Zoom in" shortcut="plus" onClick={() => onZoom(ZOOM_STEP)} />
      <IconButton icon={<Minus size={14} />} label="Zoom out" shortcut="-" onClick={() => onZoom(1 / ZOOM_STEP)} />
    </div>
  );
}
