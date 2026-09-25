import { ListChecks, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import styles from './ReviewStrip.module.css';

interface ReviewModeHintProps {
  onTurnOn: () => void;
  onDismiss: () => void;
}

/** Offered once, when many files change at once (an agent at work, a big refactor): reviewing them one by one helps. */
export function ReviewModeHint({ onTurnOn, onDismiss }: ReviewModeHintProps) {
  return (
    <div className={styles.strip} data-hint>
      <ListChecks size={13} className={styles.icon} />
      <span className={styles.label}>Reviewing a lot of changes?</span>
      <Button size="small" variant="ghost" className={`${styles.push} ${styles.action}`} data-tip="Mark files as you review them: R marks, J/K move" onClick={onTurnOn}>
        Turn on review mode
      </Button>
      <IconButton size="small" icon={<X size={13} />} label="Don't show again" onClick={onDismiss} />
    </div>
  );
}
