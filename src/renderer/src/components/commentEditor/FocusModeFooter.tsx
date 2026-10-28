import { KeyHints } from '../../ui/KeyHints';
import { focusModeHints } from './focusModeHints';
import styles from './LiveCommentEditor.module.css';

/** Focus mode's quiet footer: what the triggers write, and the key for a link (`focusModeHints`). */
export function FocusModeFooter() {
  return <KeyHints className={styles.footer} hints={focusModeHints()} />;
}
