import { ArrowRightToLine } from 'lucide-react';
import { IconButton } from '../../../ui/IconButton';
import styles from './NewestEndButton.module.css';

interface NewestEndButtonProps {
  /** While the newest changesets are off screen to the right. */
  shown: boolean;
  onClick: () => void;
}

/**
 * A quiet way back to the newest history once the view went back in time: a small solid button on the right edge,
 * as the zoom controls are. It fades away at the newest end.
 */
export function NewestEndButton({ shown, onClick }: NewestEndButtonProps) {
  return (
    <div className={styles.edge} data-shown={shown} aria-hidden={!shown}>
      <IconButton icon={<ArrowRightToLine size={14} />} label="Go to the newest changesets" onClick={onClick} tabIndex={shown ? 0 : -1} className={styles.button} />
    </div>
  );
}
