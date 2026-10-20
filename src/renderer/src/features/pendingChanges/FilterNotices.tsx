import { EyeOff } from 'lucide-react';
import { pluralize } from '../../lib/text';
import styles from './FilterNotices.module.css';

/** Check in takes every checked change, shown or not; this says so when the filter hides some of them. */
export function HiddenCheckedNotice({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <div className={styles.hiddenChecked}>
      <EyeOff size={13} className={styles.icon} />
      <span className={styles.text}>{pluralize(count, 'checked change')} hidden by the filter</span>
      <span className={styles.dot}>·</span>
      <button type="button" className={styles.link} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
