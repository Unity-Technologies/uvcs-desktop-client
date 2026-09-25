import { ArrowDownToLine, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import styles from './CheckinAfterUpdateNotice.module.css';

interface CheckinAfterUpdateNoticeProps {
  message: string;
  busy: boolean;
  onCheckin: () => void;
  onDismiss: () => void;
}

/** Above the check-in, after updating past a rejected checkin: one button to check in now. */
export function CheckinAfterUpdateNotice({ message, busy, onCheckin, onDismiss }: CheckinAfterUpdateNoticeProps) {
  return (
    <div className={styles.notice} role="status">
      <ArrowDownToLine size={13} className={styles.icon} />
      <span className={styles.text}>{message}</span>
      <Button size="small" variant="primary" loading={busy} onClick={onCheckin}>
        Check in
      </Button>
      <IconButton size="small" icon={<X size={13} />} label="Dismiss" onClick={onDismiss} />
    </div>
  );
}
