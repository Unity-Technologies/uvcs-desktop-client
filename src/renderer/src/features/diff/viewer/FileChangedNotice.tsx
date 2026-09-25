import { RefreshCw } from 'lucide-react';
import { Button } from '../../../ui/Button';
import styles from './FileChangedNotice.module.css';

/** While the user edits a file, a change on disk waits here instead of replacing their edits. */
export function FileChangedNotice({ onReload }: { onReload: () => void }) {
  return (
    <div className={styles.notice}>
      <RefreshCw size={13} className={styles.icon} />
      <span className={styles.text}>File changed on disk. Reload to see the new version; your unsaved edits are discarded.</span>
      <Button size="small" onClick={onReload}>
        Reload
      </Button>
    </div>
  );
}
